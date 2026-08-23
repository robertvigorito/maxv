"""Tests for the asset service."""

import pytest

from backend.app.models.asset import AssetCreate, AssetType, AssetMetadata
from backend.app.services.asset_service import AssetService


@pytest.mark.asyncio
async def test_create_asset(test_db):
    """Test creating an asset."""
    service = AssetService(test_db)

    asset_data = AssetCreate(
        path="/test/path/image.jpg",
        filename="image.jpg",
        type=AssetType.IMAGE,
        mime="image/jpeg",
        size=1024,
        modified_at="2026-08-21T12:00:00",
        width=1920,
        height=1080,
        hash="sha256:abc123",
        metadata=AssetMetadata(),
    )

    asset_id = await service.create_asset(asset_data)

    assert asset_id is not None

    # Verify asset was created
    asset = await service.get_asset_by_id(asset_id)
    assert asset is not None
    assert asset["filename"] == "image.jpg"
    assert asset["type"] == "image"


@pytest.mark.asyncio
async def test_get_asset_by_path(test_db):
    """Test getting an asset by path."""
    service = AssetService(test_db)

    asset_data = AssetCreate(
        path="/unique/path/video.mov",
        filename="video.mov",
        type=AssetType.VIDEO,
        mime="video/quicktime",
        size=2048,
        modified_at="2026-08-21T12:00:00",
        width=3840,
        height=2160,
        duration=60.0,
        hash="sha256:def456",
        metadata=AssetMetadata(),
    )

    await service.create_asset(asset_data)

    # Get by path
    asset = await service.get_asset_by_path("/unique/path/video.mov")
    assert asset is not None
    assert asset["filename"] == "video.mov"
    assert asset["duration"] == 60.0


@pytest.mark.asyncio
async def test_list_assets(test_db):
    """Test listing assets with pagination."""
    service = AssetService(test_db)

    # Create multiple assets
    for i in range(5):
        asset_data = AssetCreate(
            path=f"/test/image{i}.jpg",
            filename=f"image{i}.jpg",
            type=AssetType.IMAGE,
            mime="image/jpeg",
            size=1024 * i,
            modified_at="2026-08-21T12:00:00",
            width=1920,
            height=1080,
            hash=f"sha256:hash{i}",
            metadata=AssetMetadata(),
        )
        await service.create_asset(asset_data)

    # List assets
    result = await service.list_assets(page=1, limit=3)

    assert result.total == 5
    assert len(result.items) == 3
    assert result.pages == 2


@pytest.mark.asyncio
async def test_delete_asset(test_db):
    """Test deleting an asset."""
    service = AssetService(test_db)

    asset_data = AssetCreate(
        path="/test/delete.jpg",
        filename="delete.jpg",
        type=AssetType.IMAGE,
        mime="image/jpeg",
        size=1024,
        modified_at="2026-08-21T12:00:00",
        hash="sha256:delete",
        metadata=AssetMetadata(),
    )

    asset_id = await service.create_asset(asset_data)

    # Delete asset
    success = await service.delete_asset(asset_id)
    assert success

    # Verify deletion
    asset = await service.get_asset_by_id(asset_id)
    assert asset is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
