"""Test configuration and fixtures."""

import asyncio
import os
from pathlib import Path

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

# Set test environment
os.environ["MONGODB_DB_NAME"] = "maxv_test"
os.environ["MEDIA_PATH"] = "./test_data/media"
os.environ["THUMBNAIL_PATH"] = "./test_data/thumbnails"
os.environ["CACHE_PATH"] = "./test_data/cache"


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def test_db():
    """Create a test database connection."""
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.maxv_test

    # Clear the test database
    await db.assets.delete_many({})

    yield db

    # Cleanup
    await db.assets.delete_many({})
    client.close()


@pytest.fixture
def test_media_dir(tmp_path):
    """Create a temporary media directory for tests."""
    media_dir = tmp_path / "media"
    media_dir.mkdir()
    return media_dir


@pytest.fixture
def test_thumbnail_dir(tmp_path):
    """Create a temporary thumbnail directory for tests."""
    thumbnail_dir = tmp_path / "thumbnails"
    thumbnail_dir.mkdir()
    return thumbnail_dir
