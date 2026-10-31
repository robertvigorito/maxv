"""Scanning into a selected project only adds assets to that project."""

from pathlib import Path

import pytest
from pymongo import MongoClient

from backend.app.services.asset_service import AssetService
from backend.app.services.scanner import MediaScanner

FIXTURES = Path(__file__).parent / "fixtures" / "exr"


@pytest.fixture
def service():
    client = MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=2000)
    db = client.maxv_test_scan_project
    try:
        client.admin.command("ping")
    except Exception:
        pytest.skip("MongoDB not available")
    client.drop_database("maxv_test_scan_project")
    yield AssetService(db, "assets")
    client.drop_database("maxv_test_scan_project")
    client.close()


def _project_asset_ids(service, project_id):
    return set(service.db.project_assets.distinct("asset_id", {"project_id": project_id}))


def test_scan_adds_assets_only_to_selected_project(service):
    MediaScanner().scan_and_index(FIXTURES, service, project_id="project-a")

    all_ids = {str(doc["_id"]) for doc in service.collection.find({}, {"_id": 1})}
    assert all_ids
    assert _project_asset_ids(service, "project-a") == all_ids
    assert _project_asset_ids(service, "project-b") == set()


def test_scan_without_project_assigns_nothing(service):
    MediaScanner().scan_and_index(FIXTURES, service)

    assert service.collection.count_documents({}) > 0
    assert service.db.project_assets.count_documents({}) == 0


def test_project_count_ignores_deleted_assets(service):
    MediaScanner().scan_and_index(FIXTURES, service, project_id="project-a")
    total = service.collection.count_documents({})
    assert service.count_project_assets("project-a") == total

    # Assets removed from the database must not linger in the project count.
    doomed = [str(doc["_id"]) for doc in service.collection.find({}, {"_id": 1}).limit(2)]
    service.delete_assets_db_only(doomed)

    assert service.count_project_assets("project-a") == total - 2
    assert len(_project_asset_ids(service, "project-a")) == total - 2
