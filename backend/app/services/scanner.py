"""Media scanner service for filesystem indexing."""

import hashlib
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from threading import Lock
from typing import Dict, List, Optional

from backend.app.config import settings
from backend.app.models.asset import AssetCreate, AssetType
from backend.app.services.metadata import MetadataExtractor
from backend.app.services.thumbnails import ThumbnailGenerator

logger = logging.getLogger(__name__)

# Matches sequence frame names like "frame.0001.png" (4+ padded digits).
SEQUENCE_FRAME_PATTERN = re.compile(r"^(?P<base>.+)\.(?P<frame>\d{4,})(?P<ext>\.[^.]+)$")


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
        """Compute a fast content fingerprint without reading the whole file.

        Reads only the head and tail of the file (64 KB each) combined with the
        file's size and mtime. This is O(128 KB) per file instead of O(file
        size), which matters a lot for large video files. It remains
        deterministic for a given file, so it still works as a thumbnail cache
        key and dedup fingerprint.
        """
        sample_size = 64 * 1024
        try:
            stat = file_path.stat()
            sha256_hash = hashlib.sha256()
            # Seed with size + mtime so changes outside the sampled regions
            # still alter the fingerprint.
            sha256_hash.update(f"{stat.st_size}:{stat.st_mtime_ns}".encode())
            with open(file_path, "rb") as f:
                sha256_hash.update(f.read(sample_size))
                if stat.st_size > sample_size:
                    f.seek(-sample_size, os.SEEK_END)
                    sha256_hash.update(f.read(sample_size))
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
                path=str(file_path.resolve()),
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
                is_sequence=False,
                frame_count=None,
                frame_start=None,
                frame_end=None,
                sequence_pattern=None,
            )

            return asset
        except Exception as e:
            logger.error(f"Failed to scan file {file_path}: {e}")
            return None

    def _group_sequences(self, media_files: List[Path]):
        """Partition media files into ``(sequences, standalone_files)``.

        Files matching ``name.####.ext`` are grouped by (directory, base name,
        extension); each group with 2 or more frames becomes a single sequence.
        """
        frame_map = {}  # (parent, base, ext) -> list[(frame_number, frame_digits, path)]
        standalone = []
        for file_path in media_files:
            match = SEQUENCE_FRAME_PATTERN.match(file_path.name)
            if match:
                key = (str(file_path.parent), match.group("base"), match.group("ext"))
                frame_map.setdefault(key, []).append((int(match.group("frame")), match.group("frame"), file_path))
            else:
                standalone.append(file_path)

        sequences = []
        for (parent, base, ext), frames in frame_map.items():
            if len(frames) < 2:
                # A single numbered file isn't a sequence.
                standalone.extend(path for _, _, path in frames)
                continue
            frames.sort()
            # Pad width comes from the digits in the filenames (e.g. 0001 -> 4).
            width = max(len(digits) for _, digits, _ in frames)
            pattern = f"{base}.%0{width}d{ext}"
            sequences.append(
                {
                    "first_path": frames[0][2],
                    "count": len(frames),
                    "start": frames[0][0],
                    "end": frames[-1][0],
                    "pattern": pattern,
                }
            )
        return sequences, standalone

    def scan_sequence(self, sequence: Dict) -> Optional[AssetCreate]:
        """Scan a frame sequence as a single asset (metadata from first frame)."""
        try:
            first = sequence["first_path"]
            frame_asset = self.scan_file(first)
            if not frame_asset:
                return None
            return AssetCreate(
                path=frame_asset.path,
                filename=sequence["pattern"],
                type=frame_asset.type,
                mime=frame_asset.mime,
                size=frame_asset.size,
                modified_at=frame_asset.modified_at,
                width=frame_asset.width,
                height=frame_asset.height,
                duration=None,
                thumbnail_path=frame_asset.thumbnail_path,
                hash=frame_asset.hash,
                metadata=frame_asset.metadata,
                is_sequence=True,
                frame_count=sequence["count"],
                frame_start=sequence["start"],
                frame_end=sequence["end"],
                sequence_pattern=sequence["pattern"],
            )
        except Exception as e:
            logger.error(f"Failed to scan sequence {sequence.get('pattern')}: {e}")
            return None

    def _scan_item(self, kind: str, item) -> Optional[AssetCreate]:
        """Scan a pending item (a single file or a frame sequence)."""
        if kind == "sequence":
            return self.scan_sequence(item)
        return self.scan_file(item)

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
        progress_callback=None,
        max_workers: Optional[int] = None,
        project_id: Optional[str] = None,
    ) -> Dict[str, int]:
        """Scan directory and index all media files.

        Processing is split into three phases so the expensive per-file work
        (hashing, ffprobe, ffmpeg/PIL thumbnail generation) runs concurrently
        instead of serially:

        1. Cheap indexed DB lookups decide which items need (re)indexing.
        2. ``scan_file`` runs in a thread pool (subprocesses and PIL release
           the GIL while doing I/O, so threads scale well here).
        3. New/changed assets are persisted to MongoDB in batched writes.

        Frame sequences (``name.0001.ext``, ``name.0002.ext``, ...) are grouped
        into a single asset, so an image sequence appears once rather than once
        per frame.

        Scans are append-only: they add new files and update changed ones, but
        never delete existing assets. Re-scanning a folder (or the whole media
        path) therefore always leaves already-indexed media intact.
        """
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
        total = len(media_files)

        if progress_callback:
            progress_callback(0, total, stats)

        # Partition files into standalone media and frame sequences, so a
        # sequence like name.0001.png..name.1200.png becomes one asset.
        sequences, standalone = self._group_sequences(media_files)

        # Phase 1 (cheap, single-threaded): look up existing assets and decide
        # which items actually need reindexing. get_asset_by_path uses the
        # unique "path" index, so this stays fast even for large libraries.
        pending: list[tuple] = []  # (kind, item, existing_asset or None)
        skipped = 0
        for file_path in standalone:
            existing_asset = asset_service.get_asset_by_path(str(file_path.absolute()))
            if self.should_reindex_file(file_path, existing_asset):
                pending.append(("file", file_path, existing_asset))
            else:
                stats["skipped"] += 1
                skipped += 1
        for sequence in sequences:
            existing_asset = asset_service.get_asset_by_path(str(sequence["first_path"].absolute()))
            if self.should_reindex_file(sequence["first_path"], existing_asset):
                pending.append(("sequence", sequence, existing_asset))
            else:
                stats["skipped"] += 1
                skipped += 1

        if progress_callback:
            progress_callback(skipped, total, stats)

        # Phase 2 (parallel): run the expensive per-item work concurrently.
        # Mongo writes are deferred to Phase 3 so they can be batched.
        scanned_assets: list[dict] = []
        lock = Lock()
        workers = max_workers or min(32, (os.cpu_count() or 4) + 4)

        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(self._scan_item, kind, item): (kind, item, existing_asset)
                for kind, item, existing_asset in pending
            }

            processed = skipped
            for future in as_completed(futures):
                _, item, existing_asset = futures[future]
                try:
                    asset_data = future.result()
                except Exception as e:
                    label = item if isinstance(item, Path) else item.get("pattern")
                    logger.error(f"Error scanning {label}: {e}")
                    asset_data = None

                if asset_data is None:
                    with lock:
                        stats["errors"] += 1
                else:
                    with lock:
                        scanned_assets.append(
                            {
                                "existing_asset": existing_asset,
                                "asset": asset_data,
                            }
                        )

                with lock:
                    processed += 1
                    snapshot = dict(stats)
                if progress_callback:
                    progress_callback(processed, total, snapshot)

        # Phase 3 (batch writes): persist new/updated assets.
        to_create = [entry["asset"] for entry in scanned_assets if not entry["existing_asset"]]
        to_update = [
            (entry["existing_asset"]["_id"], entry["asset"]) for entry in scanned_assets if entry["existing_asset"]
        ]

        if to_create:
            stats["indexed"] += asset_service.create_assets(to_create)
        if to_update:
            stats["updated"] += asset_service.update_assets(to_update)

        # Assets are global; a project only holds references. Put everything
        # found under the scanned directory (new and already indexed) into the
        # selected project, and into no other.
        if project_id:
            asset_service.add_directory_to_project(project_id, str(directory.absolute()))

        if progress_callback:
            progress_callback(total, total, stats)

        logger.info(
            f"Scan complete: scanned={stats['scanned']}, "
            f"indexed={stats['indexed']}, updated={stats['updated']}, "
            f"skipped={stats['skipped']}, errors={stats['errors']}"
        )

        return stats
