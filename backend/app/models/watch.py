"""Watch folder models and schemas."""

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class WatchCreate(BaseModel):
    """Request to add a folder watch."""

    path: str = Field(..., description="Directory path to watch (absolute, or relative to media path)")
    interval: int = Field(10, ge=1, le=3600, description="Poll interval in seconds")


class WatchUpdate(BaseModel):
    """Request to update a folder watch (identified by path)."""

    path: str = Field(..., description="Path of the watch to update")
    interval: Optional[int] = Field(None, ge=1, le=3600, description="Poll interval in seconds")
    enabled: Optional[bool] = Field(None, description="Whether the watch is active")


class Watch(BaseModel):
    """Watch folder state as reported to the client."""

    id: str = Field(..., alias="_id", description="MongoDB ObjectId as string")
    path: str = Field(..., description="Absolute directory path being watched")
    interval: int = Field(..., description="Poll interval in seconds")
    enabled: bool = Field(..., description="Whether the watch is active")
    created_at: Optional[datetime] = Field(None, description="When the watch was created")
    last_scan_at: Optional[datetime] = Field(None, description="When the last scan completed")
    next_scan_at: Optional[datetime] = Field(None, description="When the next scan is scheduled")
    scanning: bool = Field(False, description="True while a scan is running")
    last_stats: Dict[str, Any] = Field(default_factory=dict, description="Stats from the last scan")

    class Config:
        populate_by_name = True
        json_encoders = {datetime: lambda v: v.isoformat()}
