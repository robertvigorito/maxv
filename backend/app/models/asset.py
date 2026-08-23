"""Asset data models and schemas."""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AssetType(str, Enum):
    """Asset type enumeration."""

    IMAGE = "image"
    VIDEO = "video"


class AssetMetadata(BaseModel):
    """Additional metadata for assets."""

    codec: Optional[str] = None
    fps: Optional[float] = None
    bitrate: Optional[int] = None


class AssetBase(BaseModel):
    """Base asset model with common fields."""

    path: str = Field(..., description="Absolute filesystem path to the asset")
    filename: str = Field(..., description="Filename without directory path")
    type: AssetType = Field(..., description="Asset type (image or video)")
    mime: str = Field(..., description="MIME type of the asset")
    size: int = Field(..., description="File size in bytes")
    modified_at: datetime = Field(..., description="Last modification time")
    width: Optional[int] = Field(None, description="Width in pixels")
    height: Optional[int] = Field(None, description="Height in pixels")
    duration: Optional[float] = Field(None, description="Duration in seconds (video only)")
    thumbnail_path: Optional[str] = Field(None, description="Path to thumbnail image")
    hash: str = Field(..., description="SHA256 hash of the file")
    metadata: AssetMetadata = Field(default_factory=AssetMetadata, description="Additional metadata")
    tags: List[str] = Field(default_factory=list, description="User-defined tags")


class AssetCreate(AssetBase):
    """Asset creation model."""

    pass


class AssetInDB(AssetBase):
    """Asset model as stored in database."""

    id: str = Field(..., alias="_id", description="MongoDB ObjectId as string")
    indexed_at: datetime = Field(default_factory=datetime.utcnow, description="Indexing timestamp")

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}


class Asset(AssetInDB):
    """Asset model for API responses."""

    thumbnail_url: Optional[str] = None
    file_url: Optional[str] = None


class AssetList(BaseModel):
    """Paginated list of assets."""

    items: list[Asset]
    total: int
    page: int
    limit: int
    pages: int


class ScanRequest(BaseModel):
    """Request to scan a directory."""

    path: str = Field(..., description="Directory path to scan")


class ScanResponse(BaseModel):
    """Response from scan operation."""

    status: str
    path: str
    message: str
    scanned: int = 0
    indexed: int = 0
    updated: int = 0
    deleted: int = 0


class AssetTagsUpdate(BaseModel):
    """Tags to add to a set of assets."""

    asset_ids: list[str] = Field(..., min_length=1)
    tags: list[str] = Field(..., min_length=1)


class AssetIdsUpdate(BaseModel):
    """A set of asset IDs to operate on."""

    asset_ids: list[str] = Field(..., min_length=1)
