"""Application configuration management."""

import os
import sys
from pathlib import Path
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def user_cache_dir() -> Path:
    """Return maxv's per-user cache directory, outside the installed package."""
    if os.name == "nt":
        return Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "maxv" / "Cache"
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Caches" / "maxv"
    return Path(os.environ.get("XDG_CACHE_HOME", Path.home() / ".cache")) / "maxv"


def default_thumbnail_path() -> Path:
    """Store generated thumbnails in the user's cache, never in the package tree."""
    return user_cache_dir() / "thumbnails"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # MongoDB Configuration
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "maxv"

    # Media Configuration
    media_path: Path = Path("./data/media")
    thumbnail_path: Path = Field(default_factory=default_thumbnail_path)
    cache_path: Path = Path("./data/cache")

    # Thumbnail Settings
    thumbnail_max_size: int = 400
    thumbnail_quality: int = 85

    # Supported file extensions
    supported_image_extensions: List[str] = [".jpg", ".jpeg", ".png", ".exr"]
    supported_video_extensions: List[str] = [".mov"]

    # API Configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_reload: bool = True

    # CORS Origins
    cors_origins: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Logging
    log_level: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @field_validator("thumbnail_path", mode="before")
    @classmethod
    def resolve_thumbnail_path(cls, value: Path | str) -> Path:
        """Resolve relative overrides under the user cache, not the current directory."""
        path = Path(value).expanduser()
        if not path.is_absolute():
            path = user_cache_dir() / path
        return path.resolve()

    @property
    def all_supported_extensions(self) -> List[str]:
        """Get all supported file extensions."""
        return self.supported_image_extensions + self.supported_video_extensions

    def ensure_directories(self) -> None:
        """Ensure required directories exist."""
        self.media_path.mkdir(parents=True, exist_ok=True)
        self.thumbnail_path.mkdir(parents=True, exist_ok=True)
        self.cache_path.mkdir(parents=True, exist_ok=True)


# Global settings instance
settings = Settings()
