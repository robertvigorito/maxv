"""Media scanner service for filesystem indexing."""

import hashlib
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set

from backend.app.config import settings
from backend.app.models.asset import AssetCreate, AssetType
from backend.app.services.metadata import MetadataExtractor
from backend.app.services.thumbnails import ThumbnailGenerator

logger = logging.getLogger(__name__)


class MediaScanner:
    """Scan filesystem for media files and index them."""

    def __init__(self):
        self.metadata_extractor = MetadataExtractor()
        self.thumbnail_generator = ThumbnailGenerator()
        self.supported_extensions = settings.all_supported_extensions
        self.video_extensions = settings.supported_video_extensions

    def is_supported_file(self, file_path: Path) -> bool:
        """Check if file has a supported extension."""
        return file_path.suffix.lower() in self.supported_extensions

    def is_video_file(self, file_path: Path) -> bool:
        """Check if file is a video."""
        return file_path.suffix.lower() in self.video_extensions

    def calculate_file_hash(self, file_path: Path) -> str:
        """Calculate SHA256 hash of a file."""
        sha256_hash = hashlib.sha256()
        try:
            with open(file_path, "rb") as f:
                # Read in 64kb chunks
                for byte_block in iter(lambda: f.read(65536), b""):
                    sha256_hash.update(byte_block)
            return f"sha256:{sha256_hash.hexdigest()}"
        except Exception as e:
            logger.error(f"Failed to calculate hash for {file_path}: {e}")
            # Fallback to path-based hash if file read fails
            return f"sha256:{hashlib.sha256(str(file_path).encode()).hexdigest()}"

    def should_reindex_file(self, file_path: Path, existing_asset: Optional[Dict]) -> bool:
        """Determine if file needs to be reindexed."""
        if not existing_asset:
            return True

        # Check if file modification time or size changed
        stat = file_path.stat()
        modified_at = datetime.fromtimestamp(stat.st_mtime)
        size = stat.st_size

        existing_modified = existing_asset.get("modified_at")
        existing_size = existing_asset.get("size")

        # Convert existing_modified to datetime if it's not already
        if existing_modified and not isinstance(existing_modified, datetime):
            if hasattr(existing_modified, "replace"):
                existing_modified = existing_modified.replace(tzinfo=None)

        if existing_size != size:
            return True

        if existing_modified:
            # Compare timestamps (ignore microseconds)
            time_diff = abs((modified_at - existing_modified).total_seconds())
            if time_diff > 1:  # More than 1 second difference
                return True

        return False

    def scan_file(self, file_path: Path) -> Optional[AssetCreate]:
        """Scan a single file and create asset data."""
        try:
            # Get file stats
            stat = file_path.stat()
            modified_at = datetime.fromtimestamp(stat.st_mtime)
            size = stat.st_size

            # Calculate file hash
            file_hash = self.calculate_file_hash(file_path)

            # Determine if video
            is_video = self.is_video_file(file_path)

            # Extract metadata
            metadata = self.metadata_extractor.extract_metadata(file_path, is_video)

            # Generate thumbnail
            thumbnail_path = self.thumbnail_generator.generate_thumbnail(
                file_path,
                file_hash.split(":")[1],  # Remove 'sha256:' prefix
                is_video,
                metadata.get("duration"),
            )

            # Create asset object
            asset = AssetCreate(
                path=str(file_path.absolute()),
                filename=file_path.name,
                type=metadata["type"],
                mime=metadata["mime"],
                size=size,
                modified_at=modified_at,
                width=metadata.get("width"),
                height=metadata.get("height"),
                duration=metadata.get("duration"),
                thumbnail_path=thumbnail_path,
                hash=file_hash,
                metadata=metadata.get("metadata", {}),
            )

            return asset
        except Exception as e:
            logger.error(f"Failed to scan file {file_path}: {e}")
            return None

    def scan_directory(self, directory: Path, recursive: bool = True) -> List[Path]:
        """Scan directory for supported media files."""
        media_files = []

        try:
            if not directory.exists():
                logger.error(f"Directory does not exist: {directory}")
                return media_files

            if not directory.is_dir():
                logger.error(f"Path is not a directory: {directory}")
                return media_files

            # Use rglob for recursive, glob for non-recursive
            pattern = "**/*" if recursive else "*"

            for item in directory.glob(pattern):
                if item.is_file() and self.is_supported_file(item):
                    media_files.append(item)

            logger.info(f"Found {len(media_files)} media files in {directory}")
        except Exception as e:
            logger.error(f"Error scanning directory {directory}: {e}")

        return media_files

    def scan_and_index(
        self,
        directory: Path,
        asset_service,
        recursive: bool = True,
    ) -> Dict[str, int]:
        """Scan directory and index all media files."""
        stats = {
            "scanned": 0,
            "indexed": 0,
            "updated": 0,
            "skipped": 0,
            "errors": 0,
        }

        # Find all media files
        media_files = self.scan_directory(directory, recursive)
        stats["scanned"] = len(media_files)

        # Track processed file paths
        processed_paths: Set[str] = set()

        # Process each file
        for file_path in media_files:
            try:
                abs_path = str(file_path.absolute())
                processed_paths.add(abs_path)

                # Check if file already exists in database
                existing_asset = asset_service.get_asset_by_path(abs_path)

                # Determine if we need to reindex
                if not self.should_reindex_file(file_path, existing_asset):
                    stats["skipped"] += 1
                    continue

                # Scan file and get asset data
                asset_data = self.scan_file(file_path)
                if not asset_data:
                    stats["errors"] += 1
                    continue

                # Create or update asset in database
                if existing_asset:
                    asset_service.update_asset(existing_asset["_id"], asset_data)
                    stats["updated"] += 1
                else:
                    asset_service.create_asset(asset_data)
                    stats["indexed"] += 1

            except Exception as e:
                logger.error(f"Error processing {file_path}: {e}")
                stats["errors"] += 1

        # Find deleted files (in DB but not on filesystem)
        try:
            all_assets = asset_service.list_all_assets_in_directory(str(directory.absolute()))
            for asset in all_assets:
                if asset["path"] not in processed_paths:
                    # File was deleted from filesystem
                    asset_service.delete_asset(asset["_id"])
                    logger.info(f"Deleted asset for missing file: {asset['path']}")
        except Exception as e:
            logger.error(f"Error cleaning up deleted files: {e}")

        logger.info(
            f"Scan complete: scanned={stats['scanned']}, "
            f"indexed={stats['indexed']}, updated={stats['updated']}, "
            f"skipped={stats['skipped']}, errors={stats['errors']}"
        )

        return stats
