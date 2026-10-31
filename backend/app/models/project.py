"""Project data models."""

from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)


class Project(BaseModel):
    id: str = Field(..., alias="_id")
    name: str
    created_at: datetime
    asset_count: int = 0

    class Config:
        populate_by_name = True
