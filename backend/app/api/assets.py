"""Asset API endpoints."""

import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, StreamingResponse
from pymongo.database import Database

from backend.app.db.mongodb import get_database
from backend.app.models.asset import Asset, AssetIdsUpdate, AssetList, AssetTagsUpdate
from backend.app.services.asset_service import AssetService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/assets", tags=["assets"])


def get_asset_service(db: Database = Depends(get_database)) -> AssetService:
    """Dependency to get asset service."""
    return AssetService(db)


@router.get("", response_model=AssetList)
def list_assets(
    q: Optional[str] = Query(None, description="Search query"),
    type: Optional[str] = Query(None, description="Filter by asset type (image/video)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(100, ge=1, le=500, description="Items per page"),
    service: AssetService = Depends(get_asset_service),
):
    """List assets with pagination and optional filters."""
    return service.list_assets(page=page, limit=limit, query=q, asset_type=type)


@router.get("/tags")
def list_tags(service: AssetService = Depends(get_asset_service)):
    """List tags previously assigned to assets."""
    return {"tags": service.list_tags()}


@router.patch("/tags")
def add_tags(
    update: AssetTagsUpdate,
    service: AssetService = Depends(get_asset_service),
):
    """Add tags to all selected assets."""
    updated = service.add_tags(update.asset_ids, update.tags)
    return {"updated": updated}


@router.delete("/tags")
def remove_tags(
    update: AssetTagsUpdate,
    service: AssetService = Depends(get_asset_service),
):
    """Remove tags from all selected assets."""
    updated = service.remove_tags(update.asset_ids, update.tags)
    return {"updated": updated}


@router.delete("/tags/clear")
def clear_tags(
    update: AssetIdsUpdate,
    service: AssetService = Depends(get_asset_service),
):
    """Clear all tags from the selected assets."""
    updated = service.clear_tags(update.asset_ids)
    return {"updated": updated}


@router.get("/search")
def search_assets(
    q: str = Query(..., description="Search query"),
    limit: int = Query(50, ge=1, le=500, description="Maximum results"),
    service: AssetService = Depends(get_asset_service),
):
    """Search assets by text query."""
    assets = service.search_assets(query=q, limit=limit)
    return {"items": assets, "total": len(assets)}


@router.get("/{asset_id}", response_model=Asset)
def get_asset(
    asset_id: str,
    service: AssetService = Depends(get_asset_service),
):
    """Get a single asset by ID."""
    asset = service.get_asset_by_id(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    # Add URL fields
    asset["thumbnail_url"] = f"/api/assets/{asset_id}/thumbnail"
    asset["file_url"] = f"/api/assets/{asset_id}/file"

    return Asset(**asset)


@router.get("/{asset_id}/thumbnail")
def get_thumbnail(
    asset_id: str,
    service: AssetService = Depends(get_asset_service),
):
    """Get thumbnail image for an asset."""
    asset = service.get_asset_by_id(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    thumbnail_path = asset.get("thumbnail_path")
    if not thumbnail_path or not Path(thumbnail_path).exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found")

    return FileResponse(
        thumbnail_path,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "public, max-age=31536000",  # Cache for 1 year
        },
    )


@router.get("/{asset_id}/file")
def get_file(
    asset_id: str,
    request: Request,
    service: AssetService = Depends(get_asset_service),
):
    """Get original media file with HTTP range support for video streaming."""
    asset = service.get_asset_by_id(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    file_path = Path(asset["path"])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on filesystem")

    # Get file size
    file_size = file_path.stat().st_size

    # Check for Range header
    range_header = request.headers.get("range")

    if not range_header:
        # Return full file
        return FileResponse(
            file_path,
            media_type=asset["mime"],
            filename=asset["filename"],
        )

    # Parse Range header (format: "bytes=start-end")
    try:
        range_value = range_header.replace("bytes=", "")
        range_parts = range_value.split("-")
        start = int(range_parts[0]) if range_parts[0] else 0
        end = int(range_parts[1]) if len(range_parts) > 1 and range_parts[1] else file_size - 1

        # Validate range
        if start >= file_size or end >= file_size or start > end:
            raise HTTPException(
                status_code=416,
                detail="Requested range not satisfiable",
                headers={"Content-Range": f"bytes */{file_size}"},
            )

        # Calculate content length
        content_length = end - start + 1

        # Create streaming response
        def file_iterator():
            with open(file_path, "rb") as f:
                f.seek(start)
                remaining = content_length
                chunk_size = 65536  # 64KB chunks

                while remaining > 0:
                    chunk = f.read(min(chunk_size, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        headers = {
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Accept-Ranges": "bytes",
            "Content-Length": str(content_length),
            "Content-Type": asset["mime"],
        }

        return StreamingResponse(
            file_iterator(),
            status_code=206,
            headers=headers,
            media_type=asset["mime"],
        )

    except ValueError as e:
        logger.error(f"Invalid range header: {range_header}, error: {e}")
        raise HTTPException(status_code=400, detail="Invalid range header")
