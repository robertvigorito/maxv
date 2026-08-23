"""Asset service for CRUD operations."""

import logging
import re
from datetime import datetime
from fnmatch import translate
from typing import Dict, List, Optional

from bson import ObjectId
from pymongo.database import Database

from backend.app.models.asset import Asset, AssetCreate, AssetList

logger = logging.getLogger(__name__)

SIZE_UNITS = {"b": 1, "kb": 1024, "mb": 1024**2, "gb": 1024**3, "tb": 1024**4}


def build_search_filter(query: Optional[str]) -> Dict:
    """Build a MongoDB filter from free text and fielded search clauses."""
    if not query or not query.strip():
        return {}

    clause_pattern = re.compile(r"(?:^|\s)(name|size|tag)\s*:\s*([^\s]+)", re.IGNORECASE)
    conditions = []
    consumed = set()

    for match in clause_pattern.finditer(query):
        consumed.update(range(match.start(), match.end()))
        field = match.group(1).lower()
        value = match.group(2)
        if field == "name":
            conditions.append({"filename": {"$regex": translate(value), "$options": "i"}})
        elif field == "tag":
            conditions.append({"tags": {"$regex": translate(value), "$options": "i"}})
        else:
            conditions.append({"size": parse_size_filter(value)})

    plain_terms = []
    index = 0
    while index < len(query):
        if index in consumed or query[index].isspace():
            index += 1
            continue
        end = index
        while end < len(query) and end not in consumed and not query[end].isspace():
            end += 1
        plain_terms.append(query[index:end])
        index = end

    conditions.extend({"filename": {"$regex": re.escape(term), "$options": "i"}} for term in plain_terms)
    if len(conditions) == 1:
        return conditions[0]
    return {"$and": conditions} if conditions else {}


def parse_size_filter(value: str) -> Dict:
    """Parse sizes such as ``4mb>`` or ``>4mb`` into a Mongo comparison."""
    match = re.fullmatch(
        r"(?:(>=|<=|>|<|=))?(\d+(?:\.\d+)?)(b|kb|mb|gb|tb)?(>=|<=|>|<|=)?",
        value.lower(),
    )
    if not match:
        raise ValueError(f"Invalid size query: {value}")

    prefix_operator, amount, unit, suffix_operator = match.groups()
    operator = prefix_operator or suffix_operator or "="
    size = int(float(amount) * SIZE_UNITS.get(unit or "b", 1))
    mongo_operator = {">": "$gt", ">=": "$gte", "<": "$lt", "<=": "$lte", "=": "$eq"}[operator]
    return {mongo_operator: size}


class AssetService:
    """Service for asset CRUD operations."""

    def __init__(self, db: Database):
        self.db = db
        self.collection = db.assets

    def create_asset(self, asset: AssetCreate) -> str:
        """Create a new asset."""
        asset_dict = asset.model_dump()
        asset_dict["indexed_at"] = datetime.utcnow()

        result = self.collection.insert_one(asset_dict)
        logger.info(f"Created asset: {asset.path}")
        return str(result.inserted_id)

    def get_asset_by_id(self, asset_id: str) -> Optional[Dict]:
        """Get asset by ID."""
        try:
            result = self.collection.find_one({"_id": ObjectId(asset_id)})
            if result:
                result["_id"] = str(result["_id"])
            return result
        except Exception as e:
            logger.error(f"Error fetching asset {asset_id}: {e}")
            return None

    def get_asset_by_path(self, path: str) -> Optional[Dict]:
        """Get asset by filesystem path."""
        try:
            result = self.collection.find_one({"path": path})
            if result:
                result["_id"] = str(result["_id"])
            return result
        except Exception as e:
            logger.error(f"Error fetching asset by path {path}: {e}")
            return None

    def update_asset(self, asset_id: str, asset: AssetCreate) -> bool:
        """Update an existing asset."""
        try:
            asset_dict = asset.model_dump()
            asset_dict["indexed_at"] = datetime.utcnow()

            result = self.collection.update_one(
                {"_id": ObjectId(asset_id)},
                {"$set": asset_dict},
            )
            if result.modified_count > 0:
                logger.info(f"Updated asset: {asset.path}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error updating asset {asset_id}: {e}")
            return False

    def delete_asset(self, asset_id: str) -> bool:
        """Delete an asset."""
        try:
            result = self.collection.delete_one({"_id": ObjectId(asset_id)})
            if result.deleted_count > 0:
                logger.info(f"Deleted asset: {asset_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting asset {asset_id}: {e}")
            return False

    def add_tags(self, asset_ids: List[str], tags: List[str]) -> int:
        """Add tags to multiple assets without removing existing tags."""
        try:
            object_ids = [ObjectId(asset_id) for asset_id in asset_ids]
        except Exception as e:
            logger.error(f"Invalid asset ID while adding tags: {e}")
            return 0

        normalized_tags = sorted({tag.strip() for tag in tags if tag.strip()})
        if not normalized_tags:
            return 0

        result = self.collection.update_many(
            {"_id": {"$in": object_ids}},
            {"$addToSet": {"tags": {"$each": normalized_tags}}},
        )
        return result.matched_count

    def remove_tags(self, asset_ids: List[str], tags: List[str]) -> int:
        """Remove tags from multiple assets without affecting other tags."""
        try:
            object_ids = [ObjectId(asset_id) for asset_id in asset_ids]
        except Exception as e:
            logger.error(f"Invalid asset ID while removing tags: {e}")
            return 0

        normalized_tags = sorted({tag.strip() for tag in tags if tag.strip()})
        if not normalized_tags:
            return 0

        result = self.collection.update_many(
            {"_id": {"$in": object_ids}},
            {"$pull": {"tags": {"$in": normalized_tags}}},
        )
        return result.matched_count

    def clear_tags(self, asset_ids: List[str]) -> int:
        """Remove all tags from multiple assets."""
        try:
            object_ids = [ObjectId(asset_id) for asset_id in asset_ids]
        except Exception as e:
            logger.error(f"Invalid asset ID while clearing tags: {e}")
            return 0

        if not object_ids:
            return 0

        result = self.collection.update_many(
            {"_id": {"$in": object_ids}},
            {"$set": {"tags": []}},
        )
        return result.matched_count

    def list_tags(self) -> List[str]:
        """Return all distinct tags currently assigned to assets."""
        return sorted(self.collection.distinct("tags"))

    def list_assets(
        self,
        page: int = 1,
        limit: int = 100,
        query: Optional[str] = None,
        asset_type: Optional[str] = None,
    ) -> AssetList:
        """List assets with pagination and filters."""
        # Build filter query
        filter_query = build_search_filter(query)

        if asset_type:
            filter_query["type"] = asset_type

        # Count total documents
        total = self.collection.count_documents(filter_query)

        # Calculate pagination
        skip = (page - 1) * limit
        pages = (total + limit - 1) // limit

        # Fetch documents
        cursor = self.collection.find(filter_query).skip(skip).limit(limit)
        cursor = cursor.sort("indexed_at", -1)  # Most recently indexed first

        assets = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            # Add URL fields
            doc["thumbnail_url"] = f"/api/assets/{doc['_id']}/thumbnail"
            doc["file_url"] = f"/api/assets/{doc['_id']}/file"
            assets.append(Asset(**doc))

        return AssetList(
            items=assets,
            total=total,
            page=page,
            limit=limit,
            pages=pages,
        )

    def search_assets(self, query: str, limit: int = 50) -> List[Asset]:
        """Search assets by text query."""
        filter_query = {"$text": {"$search": query}}

        cursor = self.collection.find(filter_query).limit(limit)
        cursor = cursor.sort([("score", {"$meta": "textScore"})])

        assets = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            doc["thumbnail_url"] = f"/api/assets/{doc['_id']}/thumbnail"
            doc["file_url"] = f"/api/assets/{doc['_id']}/file"
            assets.append(Asset(**doc))

        return assets

    def list_all_assets_in_directory(self, directory_path: str) -> List[Dict]:
        """List all assets within a directory path (for cleanup)."""
        # Find assets where path starts with directory_path
        filter_query = {"path": {"$regex": f"^{directory_path}"}}

        assets = []
        for doc in self.collection.find(filter_query):
            doc["_id"] = str(doc["_id"])
            assets.append(doc)

        return assets
