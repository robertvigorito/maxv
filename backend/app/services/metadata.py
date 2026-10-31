"""Metadata extraction service for images and videos."""

import json
import logging
import mimetypes
import subprocess
from pathlib import Path
from typing import Dict, Optional

from PIL import Image

from backend.app.models.asset import AssetMetadata, AssetType

logger = logging.getLogger(__name__)


class MetadataExtractor:
    """Extract metadata from media files."""

    @staticmethod
    def get_mime_type(file_path: Path) -> str:
        """Get MIME type for a file."""
        mime_type, _ = mimetypes.guess_type(str(file_path))
        return mime_type or "application/octet-stream"

    @staticmethod
    def extract_image_metadata(file_path: Path) -> Dict:
        """Extract metadata from image file using Pillow."""
        try:
            with Image.open(file_path) as img:
                return {
                    "width": img.width,
                    "height": img.height,
                    "mime": MetadataExtractor.get_mime_type(file_path),
                    "type": AssetType.IMAGE,
                }
        except Exception as e:
            if file_path.suffix.lower() == ".exr":
                try:
                    import OpenEXR

                    with OpenEXR.File(str(file_path)) as exr_file:
                        window_min, window_max = exr_file.header()["dataWindow"]
                        return {
                            "width": int(window_max[0] - window_min[0] + 1),
                            "height": int(window_max[1] - window_min[1] + 1),
                            "mime": "image/x-exr",
                            "type": AssetType.IMAGE,
                        }
                except Exception as exr_error:
                    logger.error(f"Failed to read EXR metadata from {file_path}: {exr_error}")
            logger.error(f"Failed to extract image metadata from {file_path}: {e}")
            return {
                "width": None,
                "height": None,
                "mime": MetadataExtractor.get_mime_type(file_path),
                "type": AssetType.IMAGE,
            }

    @staticmethod
    def extract_video_metadata(file_path: Path) -> Dict:
        """Extract metadata from video file using ffprobe (subprocess)."""
        try:
            # Use ffprobe to extract video metadata as JSON
            result = subprocess.run(
                [
                    "ffprobe",
                    "-v",
                    "quiet",
                    "-print_format",
                    "json",
                    "-show_format",
                    "-show_streams",
                    str(file_path),
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode != 0:
                logger.error(f"ffprobe failed for {file_path}: {result.stderr}")
                return {
                    "width": None,
                    "height": None,
                    "duration": None,
                    "mime": MetadataExtractor.get_mime_type(file_path),
                    "type": AssetType.VIDEO,
                    "metadata": AssetMetadata(),
                }

            probe = json.loads(result.stdout)

            # Find video stream
            video_stream = next((s for s in probe["streams"] if s["codec_type"] == "video"), None)

            if not video_stream:
                logger.warning(f"No video stream found in {file_path}")
                return {
                    "width": None,
                    "height": None,
                    "duration": None,
                    "mime": MetadataExtractor.get_mime_type(file_path),
                    "type": AssetType.VIDEO,
                    "metadata": AssetMetadata(),
                }

            # Extract duration from format or stream
            duration = None
            if "duration" in probe.get("format", {}):
                duration = float(probe["format"]["duration"])
            elif "duration" in video_stream:
                duration = float(video_stream["duration"])

            # Extract codec and fps
            codec = video_stream.get("codec_name")
            fps = None
            if "r_frame_rate" in video_stream:
                try:
                    num, den = map(int, video_stream["r_frame_rate"].split("/"))
                    if den > 0:
                        fps = num / den
                except (ValueError, ZeroDivisionError):
                    pass

            return {
                "width": video_stream.get("width"),
                "height": video_stream.get("height"),
                "duration": duration,
                "mime": MetadataExtractor.get_mime_type(file_path),
                "type": AssetType.VIDEO,
                "metadata": AssetMetadata(
                    codec=codec,
                    fps=fps,
                    bitrate=probe.get("format", {}).get("bit_rate"),
                ),
            }
        except subprocess.TimeoutExpired:
            logger.error(f"ffprobe timeout for {file_path}")
            return {
                "width": None,
                "height": None,
                "duration": None,
                "mime": MetadataExtractor.get_mime_type(file_path),
                "type": AssetType.VIDEO,
                "metadata": AssetMetadata(),
            }
        except FileNotFoundError:
            logger.error("ffprobe not found. Please install ffmpeg.")
            return {
                "width": None,
                "height": None,
                "duration": None,
                "mime": MetadataExtractor.get_mime_type(file_path),
                "type": AssetType.VIDEO,
                "metadata": AssetMetadata(),
            }
        except Exception as e:
            logger.error(f"Failed to extract video metadata from {file_path}: {e}")
            return {
                "width": None,
                "height": None,
                "duration": None,
                "mime": MetadataExtractor.get_mime_type(file_path),
                "type": AssetType.VIDEO,
                "metadata": AssetMetadata(),
            }

    @staticmethod
    def extract_metadata(file_path: Path, is_video: bool = False) -> Dict:
        """Extract metadata from media file."""
        if is_video:
            return MetadataExtractor.extract_video_metadata(file_path)
        else:
            return MetadataExtractor.extract_image_metadata(file_path)
