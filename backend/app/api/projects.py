"""Project management API endpoints."""

from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pymongo import UpdateOne
from pymongo.database import Database

from backend.app.db.mongodb import get_database, mongodb
from backend.app.models.asset import AssetIdsUpdate
from backend.app.models.project import Project, ProjectCreate
from backend.app.services.asset_service import AssetService

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _project(document: dict, db: Database) -> Project:
    project_id = str(document["_id"])
    document["_id"] = project_id
    document["asset_count"] = AssetService(db, mongodb.active_collection_name).count_project_assets(project_id)
    return Project(**document)


@router.get("", response_model=list[Project])
def list_projects(db: Database = Depends(get_database)):
    return [_project(document, db) for document in db.projects.find().sort("created_at", 1)]


@router.post("", response_model=Project, status_code=201)
def create_project(request: ProjectCreate, db: Database = Depends(get_database)):
    if db.projects.find_one({"name": request.name}):
        raise HTTPException(status_code=409, detail="A project with that name already exists.")
    document = {"name": request.name, "created_at": datetime.utcnow()}
    result = db.projects.insert_one(document)
    document["_id"] = result.inserted_id
    return _project(document, db)


@router.post("/{project_id}/assets")
def add_project_assets(project_id: str, update: AssetIdsUpdate, db: Database = Depends(get_database)):
    try:
        object_id = ObjectId(project_id)
    except Exception as error:
        raise HTTPException(status_code=400, detail="Invalid project ID") from error
    if not db.projects.find_one({"_id": object_id}):
        raise HTTPException(status_code=404, detail="Project not found")

    asset_ids = []
    for asset_id in update.asset_ids:
        try:
            if db.assets.find_one({"_id": ObjectId(asset_id)}, {"_id": 1}):
                asset_ids.append(asset_id)
        except Exception:
            continue
    if asset_ids:
        db.project_assets.bulk_write(
            [
                UpdateOne(
                    {"project_id": project_id, "asset_id": asset_id},
                    {"$setOnInsert": {"project_id": project_id, "asset_id": asset_id}},
                    upsert=True,
                )
                for asset_id in asset_ids
            ],
            ordered=False,
        )
    return {"added": len(asset_ids)}