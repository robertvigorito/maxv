"""Filesystem and index consistency for batch asset renaming."""

from datetime import datetime

import pytest
from pymongo import MongoClient

from backend.app.services.asset_service import AssetService


@pytest.fixture
def service():
    client = MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=2000)
    db = client.maxv_test_asset_rename
    try:
        client.admin.command("ping")
    except Exception:
        pytest.skip("MongoDB not available")
    client.drop_database("maxv_test_asset_rename")
    yield AssetService(db, "assets")
    client.drop_database("maxv_test_asset_rename")
    client.close()


def _insert_asset(service, path, **extra):
    return service.collection.insert_one(
        {
            "path": str(path),
            "filename": path.name,
            "type": "image",
            "mime": "image/png",
            "size": 1,
            "modified_at": datetime.utcnow(),
            "hash": "test-hash",
            **extra,
        }
    ).inserted_id


def test_rename_file_updates_path_and_filename(service, tmp_path):
    source = tmp_path / "old.png"
    source.write_bytes(b"image")
    asset_id = _insert_asset(service, source)

    assert service.rename_items([{"path": str(source), "new_name": "new_001"}]) == 1

    target = tmp_path / "new_001.png"
    asset = service.collection.find_one({"_id": asset_id})
    assert target.read_bytes() == b"image"
    assert not source.exists()
    assert asset["path"] == str(target)
    assert asset["filename"] == target.name


def test_rename_directory_updates_indexed_descendant_paths(service, tmp_path):
    source_dir = tmp_path / "old_folder"
    source_dir.mkdir()
    source = source_dir / "image.png"
    source.write_bytes(b"image")
    asset_id = _insert_asset(service, source)

    service.rename_items([{"path": str(source_dir), "new_name": "new_folder"}])

    target = tmp_path / "new_folder" / "image.png"
    assert target.exists()
    assert service.collection.find_one({"_id": asset_id})["path"] == str(target)


def test_rename_sequence_renames_all_frames_and_pattern(service, tmp_path):
    source_frames = [tmp_path / f"plate.{frame:04d}.exr" for frame in (1, 2)]
    for frame in source_frames:
        frame.write_bytes(b"exr")
    asset_id = _insert_asset(
        service,
        source_frames[0],
        filename="plate.%04d.exr",
        is_sequence=True,
        sequence_pattern="plate.%04d.exr",
        frame_start=1,
        frame_end=2,
    )

    service.rename_items([{"path": str(source_frames[0]), "new_name": "shot_001"}])

    new_frames = [tmp_path / f"shot_001.{frame:04d}.exr" for frame in (1, 2)]
    assert all(frame.exists() for frame in new_frames)
    asset = service.collection.find_one({"_id": asset_id})
    assert asset["path"] == str(new_frames[0])
    assert asset["filename"] == "shot_001.%04d.exr"
    assert asset["sequence_pattern"] == "shot_001.%04d.exr"


def test_rename_rejects_existing_destination(service, tmp_path):
    source = tmp_path / "old.png"
    target = tmp_path / "taken.png"
    source.write_bytes(b"source")
    target.write_bytes(b"target")
    _insert_asset(service, source)

    with pytest.raises(FileExistsError):
        service.rename_items([{"path": str(source), "new_name": "taken"}])

    assert source.read_bytes() == b"source"
    assert target.read_bytes() == b"target"
