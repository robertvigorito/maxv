"""Indexing API endpoints."""

import logging
import os
import platform
import subprocess
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pymongo.database import Database

from backend.app.config import settings
from backend.app.db.mongodb import get_database, mongodb
from backend.app.models.asset import ScanRequest, ScanResponse
from backend.app.services.asset_service import AssetService
from backend.app.services.scanner import MediaScanner

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/index", tags=["indexing"])

SCAN_STATE = {
    "path": None,
    "status": "idle",
    "total": 0,
    "processed": 0,
    "stats": {},
}


def get_asset_service(db: Database = Depends(get_database)) -> AssetService:
    """Dependency to get asset service."""
    return AssetService(db, mongodb.active_collection_name)


def perform_scan(scan_path: Path, service: AssetService, project_id: Optional[str] = None):
    """Perform the actual scan operation, reporting progress via SCAN_STATE."""
    global SCAN_STATE
    SCAN_STATE = {
        "path": str(scan_path),
        "status": "running",
        "total": 0,
        "processed": 0,
        "stats": {},
    }

    def progress(processed: int, total: int, stats: dict) -> None:
        SCAN_STATE.update({"processed": processed, "total": total, "stats": stats})

    scanner = MediaScanner()
    stats = scanner.scan_and_index(
        scan_path, service, recursive=True, progress_callback=progress, project_id=project_id
    )
    SCAN_STATE.update({"status": "done", "stats": stats, "processed": SCAN_STATE["total"]})
    logger.info(f"Background scan completed for {scan_path}: {stats}")


def _list_subdirectories(parent: Path) -> List[Path]:
    """Return the immediate subdirectories of ``parent``, skipping errors."""
    results = []
    try:
        for entry in parent.iterdir():
            if entry.is_dir():
                results.append(entry)
    except (PermissionError, OSError):
        pass
    return results


@router.get("/complete")
def complete_path(
    path: str = Query("", description="Partial path to complete (zsh-style)"),
):
    """Return directory completions for a partial filesystem path.

    Mirrors tab-completion in a shell: an empty path lists the home directory,
    a path ending in "/" lists that directory's subdirectories, and any other
    partial lists the directories under its parent that share its prefix.
    """
    partial = path.strip()

    # Expand a leading "~" to the user's home directory.
    if partial.startswith("~"):
        partial = str(Path.home()) + partial[1:]

    # Resolve relative paths against the current working directory.
    if partial and not partial.startswith("/"):
        partial = str(Path.cwd() / partial)

    if not partial:
        items = [str(d) + os.sep for d in _list_subdirectories(Path.home())]
        return {"items": sorted(items)[:100]}

    target = Path(partial)

    if partial.endswith(os.sep):
        subdirs = _list_subdirectories(target)
        items = [str(d) + os.sep for d in subdirs]
    else:
        parent = target.parent
        prefix = target.name
        subdirs = [d for d in _list_subdirectories(parent) if d.name.startswith(prefix)]
        if target.is_dir():
            # Include the fully-typed directory so Tab can descend into it.
            subdirs.append(target)
        items = [str(d) + os.sep for d in subdirs]

    return {"items": sorted(items)[:100]}


@router.get("/default")
def default_scan_path():
    """Default path for new scans: the last scanned path, else the server cwd."""
    return {"path": SCAN_STATE.get("path") or str(Path.cwd())}


@router.post("/scan", response_model=ScanResponse)
def scan_directory(
    request: ScanRequest,
    background_tasks: BackgroundTasks,
    service: AssetService = Depends(get_asset_service),
):
    """Trigger a directory scan to index media files."""
    scan_path = Path(request.path)

    # Resolve relative paths (e.g. dropped folders) against the media path.
    if not scan_path.is_absolute():
        scan_path = settings.media_path / scan_path

    # Validate path
    if not scan_path.exists():
        raise HTTPException(status_code=400, detail=f"Path does not exist: {request.path}")

    if not scan_path.is_dir():
        raise HTTPException(status_code=400, detail=f"Path is not a directory: {request.path}")

    # Perform scan in background
    background_tasks.add_task(perform_scan, scan_path, service, request.project_id)

    return ScanResponse(
        status="started",
        path=str(scan_path.absolute()),
        message=f"Scan started for {scan_path}",
    )


@router.post("/open")
def open_folder(path: str = Query(...)):
    """Open a folder in the OS file explorer."""
    folder = Path(path)
    if not folder.exists() or not folder.is_dir():
        raise HTTPException(status_code=400, detail=f"Folder not found: {path}")
    try:
        system = platform.system()
        if system == "Windows":
            subprocess.Popen(["explorer", str(folder)])
        elif system == "Darwin":
            subprocess.Popen(["open", str(folder)])
        else:
            subprocess.Popen(["xdg-open", str(folder)])
        return {"status": "opened", "path": str(folder)}
    except Exception as e:
        logger.error(f"Failed to open folder {path}: {e}")
        raise HTTPException(status_code=500, detail="Failed to open folder")


@router.post("/refresh", response_model=ScanResponse)
def refresh_media(
    background_tasks: BackgroundTasks,
    service: AssetService = Depends(get_asset_service),
):
    """Re-scan the configured media path to refresh all media in the database."""
    scan_path = settings.media_path
    if not scan_path.exists() or not scan_path.is_dir():
        raise HTTPException(status_code=400, detail=f"Media path not found: {scan_path}")

    background_tasks.add_task(perform_scan, scan_path, service)
    return ScanResponse(
        status="started",
        path=str(scan_path.absolute()),
        message=f"Refresh started for {scan_path}",
    )


@router.get("/status")
def get_scan_status():
    """Get scan progress."""
    return SCAN_STATE
