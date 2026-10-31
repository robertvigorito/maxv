"""Application cache paths must not resolve inside the package checkout."""

from pathlib import Path

from backend.app.config import Settings, default_thumbnail_path, user_cache_dir


def test_default_thumbnail_path_uses_user_cache():
    thumbnail_path = default_thumbnail_path()

    assert thumbnail_path.is_absolute()
    assert thumbnail_path == user_cache_dir() / "thumbnails"
    assert Path(__file__).resolve().parents[2] not in thumbnail_path.parents


def test_relative_thumbnail_override_resolves_under_user_cache():
    settings = Settings(_env_file=None, thumbnail_path="data/thumbnails")

    assert settings.thumbnail_path == (user_cache_dir() / "data/thumbnails").resolve()
    assert Path(__file__).resolve().parents[2] not in settings.thumbnail_path.parents