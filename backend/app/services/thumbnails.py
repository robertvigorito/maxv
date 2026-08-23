"""Thumbnail generation service for images and videos."""

import logging
import subprocess
from pathlib import Path
from typing import Optional

from PIL import Image

from backend.app.config import settings

logger = logging.getLogger(__name__)


class ThumbnailGenerator:
    """Generate thumbnails for media files."""

    def __init__(self):
        self.thumbnail_path = settings.thumbnail_path
        self.max_size = settings.thumbnail_max_size
        self.quality = settings.thumbnail_quality

    def get_thumbnail_path(self, file_hash: str) -> Path:
        """Get thumbnail path for a given file hash."""
        return self.thumbnail_path / f"{file_hash}.jpg"

    def generate_image_thumbnail(self, source_path: Path, thumbnail_path: Path) -> bool:
        """Generate thumbnail for an image file."""
        try:
            with Image.open(source_path) as img:
                # Convert to RGB if necessary (for PNG with transparency)
                if img.mode in ("RGBA", "LA", "P"):
                    background = Image.new("RGB", img.size, (255, 255, 255))
                    if img.mode == "P":
                        img = img.convert("RGBA")
                    background.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
                    img = background
                elif img.mode != "RGB":
                    img = img.convert("RGB")

                # Calculate thumbnail size maintaining aspect ratio
                img.thumbnail((self.max_size, self.max_size), Image.Resampling.LANCZOS)

                # Save thumbnail
                img.save(thumbnail_path, "JPEG", quality=self.quality, optimize=True)

            logger.debug(f"Generated image thumbnail: {thumbnail_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to generate image thumbnail for {source_path}: {e}")
            return False

    def generate_video_thumbnail(
        self, source_path: Path, thumbnail_path: Path, duration: Optional[float] = None
    ) -> bool:
        """Generate thumbnail for a video file by extracting a frame using ffmpeg subprocess."""
        try:
            # Extract frame at 25% of duration, or at 1 second if duration unknown
            seek_time = 1.0
            if duration and duration > 4:
                seek_time = duration * 0.25

            # Use ffmpeg subprocess to extract frame
            result = subprocess.run(
                [
                    "ffmpeg",
                    "-ss",
                    str(seek_time),
                    "-i",
                    str(source_path),
                    "-vf",
                    f"scale={self.max_size}:-1",
                    "-vframes",
                    "1",
                    "-f",
                    "image2",
                    "-c:v",
                    "mjpeg",
                    "-y",  # Overwrite output file
                    str(thumbnail_path),
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode != 0:
                logger.error(f"ffmpeg error generating thumbnail for {source_path}: {result.stderr}")
                return False

            logger.debug(f"Generated video thumbnail: {thumbnail_path}")
            return True
        except subprocess.TimeoutExpired:
            logger.error(f"ffmpeg timeout generating thumbnail for {source_path}")
            return False
        except FileNotFoundError:
            logger.error("ffmpeg not found. Please install ffmpeg.")
            return False
        except Exception as e:
            logger.error(f"Failed to generate video thumbnail for {source_path}: {e}")
            return False

    def generate_thumbnail(
        self, source_path: Path, file_hash: str, is_video: bool = False, duration: Optional[float] = None
    ) -> Optional[str]:
        """Generate thumbnail for a media file."""
        thumbnail_path = self.get_thumbnail_path(file_hash)

        # Check if thumbnail already exists
        if thumbnail_path.exists():
            logger.debug(f"Thumbnail already exists: {thumbnail_path}")
            return str(thumbnail_path)

        # Generate thumbnail
        success = False
        if is_video:
            success = self.generate_video_thumbnail(source_path, thumbnail_path, duration)
        else:
            success = self.generate_image_thumbnail(source_path, thumbnail_path)

        return str(thumbnail_path) if success else None
