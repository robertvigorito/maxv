"""Storage settings API endpoints."""

import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.app.db.mongodb import get_database, mongodb

router = APIRouter(prefix="/api/settings", tags=["settings"])


class StorageSelection(BaseModel):
    database: str = Field(min_length=1, max_length=64)


def _validate_name(value: str) -> str:
    if not re.fullmatch(r"[A-Za-z0-9_-]+", value):
        raise HTTPException(status_code=400, detail="Names may only contain letters, numbers, '_' or '-'.")
    return value


def _storage_payload() -> dict:
    if mongodb.client is None or mongodb.db is None:
        raise HTTPException(status_code=503, detail="Database not connected")
    databases = []
    for database_name in sorted(mongodb.client.list_database_names()):
        if database_name in {"admin", "local", "config"}:
            continue
        database = mongodb.client[database_name]
        databases.append({"name": database_name})
    return {
        "active_database": mongodb.active_database_name,
        "databases": databases,
    }


@router.get("/storage")
def get_storage_settings():
    """Return available databases and the active selection."""
    return _storage_payload()


@router.post("/storage/select")
def select_storage(selection: StorageSelection):
    """Switch the active asset database; required collections remain app-managed."""
    database = _validate_name(selection.database)
    mongodb.switch_database(database)
    return _storage_payload()
