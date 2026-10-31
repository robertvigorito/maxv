"""Watch folder API endpoints."""

import logging

from fastapi import APIRouter, HTTPException, Query

from backend.app.models.watch import Watch, WatchCreate, WatchUpdate
from backend.app.services.watch_service import watch_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/watches", tags=["watches"])


@router.get("", response_model=dict)
def list_watches():
    """List all folder watches with their scheduling state."""
    return {"items": watch_manager.list_watches()}


@router.post("", response_model=Watch)
def add_watch(body: WatchCreate):
    """Add a folder watch (scans immediately, then polls on its own timer)."""
    try:
        return watch_manager.add_watch(body.path, body.interval)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("", response_model=Watch)
def update_watch(body: WatchUpdate):
    """Update a watch's poll interval and/or enabled state."""
    try:
        return watch_manager.update_watch(body.path, interval=body.interval, enabled=body.enabled)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("")
def remove_watch(path: str = Query(..., description="Path of the watch to remove")):
    """Remove a folder watch."""
    try:
        watch_manager.remove_watch(path)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"removed": True, "path": path}


@router.post("/scan")
def scan_watch(path: str = Query(..., description="Path of the watch to scan now")):
    """Trigger an immediate scan of a watch."""
    try:
        watch_manager.trigger_scan(path)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"status": "started", "path": path}
