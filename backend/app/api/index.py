"""Indexing API endpoints."""

import logging
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pymongo.database import Database

from backend.app.config import settings
from backend.app.db.mongodb import get_database
from backend.app.models.asset import ScanRequest, ScanResponse
from backend.app.services.asset_service import AssetService
from backend.app.services.scanner import MediaScanner

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/index", tags=["indexing"])


def get_asset_service(db: Database = Depends(get_database)) -> AssetService:
    """Dependency to get asset service."""
    return AssetService(db)


def perform_scan(scan_path: Path, service: AssetService):
    """Perform the actual scan operation."""
    scanner = MediaScanner()
    stats = scanner.scan_and_index(scan_path, service, recursive=True)
    logger.info(f"Background scan completed for {scan_path}: {stats}")


@router.post("/scan", response_model=ScanResponse)
def scan_directory(
    request: ScanRequest,
    background_tasks: BackgroundTasks,
    service: AssetService = Depends(get_asset_service),
):
    """Trigger a directory scan to index media files."""
    scan_path = Path(request.path)

    # Validate path
    if not scan_path.exists():
        raise HTTPException(status_code=400, detail=f"Path does not exist: {request.path}")

    if not scan_path.is_dir():
        raise HTTPException(status_code=400, detail=f"Path is not a directory: {request.path}")

    # Perform scan in background
    background_tasks.add_task(perform_scan, scan_path, service)

    return ScanResponse(
        status="started",
        path=str(scan_path.absolute()),
        message=f"Scan started for {scan_path}",
    )


@router.get("/status")
def get_scan_status():
    """Get scan status (placeholder for future implementation)."""
    return {
        "status": "idle",
        "message": "No active scans. Use POST /api/index/scan to start scanning.",
    }
