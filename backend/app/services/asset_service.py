"""Asset service for CRUD operations."""

import logging
import re
import shutil
from datetime import datetime
from fnmatch import translate
from pathlib import Path
from typing import Dict, List, Optional

from bson import ObjectId
from pymongo import UpdateOne
from pymongo.database import Database
from pymongo.errors import BulkWriteError

from backend.app.models.asset import Asset, AssetCreate, AssetList, AssetMetadata, AssetType

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
            for tag in value.split(","):
                tag = tag.strip()
                if tag:
                    conditions.append({"tags": {"$regex": translate(tag), "$options": "i"}})
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

    def __init__(self, db: Database, collection_name: str = "assets"):
        self.db = db
        self.collection = db[collection_name]

    def create_asset(self, asset: AssetCreate) -> str:
        """Create a new asset."""
        asset_dict = asset.model_dump()
        asset_dict["indexed_at"] = datetime.utcnow()

        result = self.collection.insert_one(asset_dict)
        logger.info(f"Created asset: {asset.path}")
        return str(result.inserted_id)

    def create_assets(self, assets: List[AssetCreate], chunk_size: int = 500) -> int:
        """Create multiple assets in batched inserts (fast indexing path)."""
        if not assets:
            return 0

        created = 0
        indexed_at = datetime.utcnow()
        for i in range(0, len(assets), chunk_size):
            chunk = assets[i : i + chunk_size]
            docs = []
            for asset in chunk:
                asset_dict = asset.model_dump()
                asset_dict["indexed_at"] = indexed_at
                docs.append(asset_dict)
            try:
                result = self.collection.insert_many(docs, ordered=False)
                created += len(result.inserted_ids)
            except BulkWriteError as e:
                created += e.details.get("nInserted", 0)
                logger.error(f"Partial batch insert error: {e}")
        return created

    def update_assets(self, updates: List[tuple], chunk_size: int = 500) -> int:
        """Update multiple assets in one bulk write (fast re-indexing path).

        ``updates`` is a list of ``(asset_id_str, AssetCreate)`` pairs.
        """
        if not updates:
            return 0

        updated = 0
        indexed_at = datetime.utcnow()
        for i in range(0, len(updates), chunk_size):
            operations = []
            for asset_id, asset in updates[i : i + chunk_size]:
                asset_dict = asset.model_dump()
                asset_dict["indexed_at"] = indexed_at
                operations.append(UpdateOne({"_id": ObjectId(asset_id)}, {"$set": asset_dict}))
            if operations:
                try:
                    result = self.collection.bulk_write(operations, ordered=False)
                    updated += result.matched_count
                except BulkWriteError as e:
                    logger.error(f"Partial batch update error: {e}")
        return updated

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

    def delete_assets_db_only(self, asset_ids: List[str]) -> int:
        """Delete assets from the database only, leaving files on disk."""
        try:
            object_ids = [ObjectId(asset_id) for asset_id in asset_ids]
        except Exception as e:
            logger.error(f"Invalid asset ID while deleting: {e}")
            return 0

        if not object_ids:
            return 0

        result = self.collection.delete_many({"_id": {"$in": object_ids}})
        return result.deleted_count

    def clear_assets_db_only(self) -> int:
        """Delete every asset from the database, leaving files on disk."""
        try:
            result = self.collection.delete_many({})
            return result.deleted_count
        except Exception as e:
            logger.error(f"Error clearing assets: {e}")
            return 0

    def rename_items(self, items: List[Dict[str, str]]) -> int:
        """Rename indexed files, frame sequences, or directories on disk and in MongoDB."""
        plans = []
        target_paths = set()

        for item in items:
            source = Path(item["path"]).absolute()
            new_name = item["new_name"].strip()
            if not new_name or new_name in {".", ".."} or "/" in new_name or "\\" in new_name:
                raise ValueError(f"Invalid destination name: {new_name}")
            if not source.exists():
                raise FileNotFoundError(f"Source not found: {source}")

            if source.is_dir():
                target = source.with_name(new_name)
                descendants = list(self.collection.find(
                    {"path": {"$regex": f"^{re.escape(str(source))}(/|\\\\)"}},
                    {"_id": 1, "path": 1},
                ))
                if not descendants:
                    raise ValueError(f"Directory contains no indexed media: {source}")
                plans.append({"kind": "directory", "source": source, "target": target, "docs": descendants})
                target_paths.add(str(target))
                continue

            doc = self.collection.find_one({"path": str(source)})
            if not doc:
                raise ValueError(f"File is not indexed: {source}")

            if doc.get("is_sequence"):
                pattern = doc.get("sequence_pattern") or doc.get("filename", "")
                match = re.fullmatch(r"(?P<base>.+)\.%0(?P<width>\d+)d(?P<ext>\.[^.]+)", pattern)
                if not match:
                    raise ValueError(f"Unsupported sequence naming pattern: {pattern}")
                width = int(match.group("width"))
                extension = match.group("ext")
                first_frame = int(doc.get("frame_start") or 0)
                last_frame = int(doc.get("frame_end") or first_frame)
                frame_plans = []
                for frame in range(first_frame, last_frame + 1):
                    old_frame = source.parent / f"{match.group('base')}.{frame:0{width}d}{extension}"
                    if old_frame.exists():
                        frame_plans.append((old_frame, old_frame.with_name(f"{new_name}.{frame:0{width}d}{extension}")))
                if not frame_plans:
                    raise FileNotFoundError(f"No sequence frames found for: {source}")
                target = source.parent / f"{new_name}.{first_frame:0{width}d}{extension}"
                plans.append({
                    "kind": "sequence", "source": source, "target": target, "doc": doc,
                    "frames": frame_plans, "filename": f"{new_name}.%0{width}d{extension}",
                })
                target_paths.update(str(dest) for _, dest in frame_plans)
            else:
                target = source.with_name(new_name + source.suffix)
                plans.append({"kind": "file", "source": source, "target": target, "doc": doc})
                target_paths.add(str(target))

        if len(target_paths) != sum(
            len(plan["frames"]) if plan["kind"] == "sequence" else 1 for plan in plans
        ):
            raise ValueError("Two selected items would have the same destination name")

        # Reject overlapping folder selections and destinations that would overwrite
        # anything other than another selected source (which is still rejected below).
        directories = [plan["source"] for plan in plans if plan["kind"] == "directory"]
        for i, directory in enumerate(directories):
            if any(other != directory and directory in other.parents for other in directories[:i] + directories[i + 1 :]):
                raise ValueError("Do not select a folder and one of its subfolders together")
            if any(
                plan["kind"] != "directory" and directory in plan["source"].parents
                for plan in plans
            ):
                raise ValueError("Do not select a folder and files inside it together")
        for plan in plans:
            destinations = [plan["target"]] if plan["kind"] != "sequence" else [dest for _, dest in plan["frames"]]
            for dest in destinations:
                if dest.exists():
                    raise FileExistsError(f"Destination already exists: {dest}")
                if dest == plan["source"]:
                    raise ValueError("The destination name is unchanged")

        moved = []
        try:
            for plan in plans:
                if plan["kind"] == "directory":
                    plan["source"].rename(plan["target"])
                    moved.append((plan["target"], plan["source"]))
                elif plan["kind"] == "sequence":
                    for old_frame, new_frame in plan["frames"]:
                        old_frame.rename(new_frame)
                        moved.append((new_frame, old_frame))
                else:
                    plan["source"].rename(plan["target"])
                    moved.append((plan["target"], plan["source"]))

            updates = []
            for plan in plans:
                if plan["kind"] == "directory":
                    old_root, new_root = str(plan["source"]), str(plan["target"])
                    for doc in plan["docs"]:
                        new_path = new_root + doc["path"][len(old_root):]
                        updates.append(UpdateOne({"_id": doc["_id"]}, {"$set": {"path": new_path}}))
                elif plan["kind"] == "sequence":
                    updates.append(UpdateOne(
                        {"_id": plan["doc"]["_id"]},
                        {"$set": {"path": str(plan["target"]), "filename": plan["filename"], "sequence_pattern": plan["filename"]}},
                    ))
                else:
                    updates.append(UpdateOne(
                        {"_id": plan["doc"]["_id"]},
                        {"$set": {"path": str(plan["target"]), "filename": plan["target"].name}},
                    ))
            if updates:
                self.collection.bulk_write(updates, ordered=True)
        except Exception:
            for current, original in reversed(moved):
                if current.exists():
                    current.rename(original)
            raise

        return len(plans)

    def plate_assets(self, asset_ids: List[str]) -> int:
        """Merge selected frame assets into single sequence assets (plates).

        Returns the number of sequences created. Frame assets are matched by the
        ``name.####.ext`` pattern; each group becomes one sequence asset built
        from its first frame, and the individual frame assets are removed from
        the database (files stay on disk).
        """
        try:
            object_ids = [ObjectId(asset_id) for asset_id in asset_ids]
        except Exception as e:
            logger.error(f"Invalid asset ID while plating: {e}")
            return 0
        if not object_ids:
            return 0

        docs = list(self.collection.find({"_id": {"$in": object_ids}}))
        if not docs:
            return 0

        frame_pattern = re.compile(r"^(?P<base>.+)\.(?P<frame>\d{4,})(?P<ext>\.[^.]+)$")
        groups = {}
        for doc in docs:
            name = Path(doc["path"]).name
            match = frame_pattern.match(name)
            if match:
                key = (str(Path(doc["path"]).parent), match.group("base"), match.group("ext"))
                groups.setdefault(key, []).append(doc)

        created = 0
        for key, frames in groups.items():
            if len(frames) < 2:
                continue
            base = key[1]
            ext = key[2]
            numbered = []
            for doc in frames:
                m = frame_pattern.match(Path(doc["path"]).name)
                numbered.append((int(m.group("frame")), m.group("frame"), doc))
            numbered.sort()
            first = numbered[0][2]
            width = max(len(digits) for _, digits, _ in numbered)
            pattern = f"{base}.%0{width}d{ext}"
            sequence = AssetCreate(
                path=first["path"],
                filename=pattern,
                type=first.get("type", AssetType.IMAGE),
                mime=first.get("mime"),
                size=first.get("size", 0),
                modified_at=first.get("modified_at") or datetime.utcnow(),
                width=first.get("width"),
                height=first.get("height"),
                thumbnail_path=first.get("thumbnail_path"),
                hash=first.get("hash"),
                metadata=AssetMetadata(**(first.get("metadata") or {})),
                is_sequence=True,
                frame_count=len(numbered),
                frame_start=numbered[0][0],
                frame_end=numbered[-1][0],
                sequence_pattern=pattern,
            )
            self.create_asset(sequence)
            self.delete_assets_db_only([str(doc["_id"]) for doc in frames])
            created += 1

        return created

    @staticmethod
    def _move_to_trash(path: str) -> bool:
        """Send a file to the OS trash/recycle bin, falling back to a local trash folder."""
        try:
            from send2trash import send2trash

            send2trash(path)
            return True
        except Exception:
            # Fallback (e.g. Linux/WSL without a desktop trash backend):
            # move into a local trash folder so the file is removed but recoverable.
            try:
                from backend.app.config import settings

                trash_dir = settings.cache_path / "trash"
                trash_dir.mkdir(parents=True, exist_ok=True)

                source = Path(path)
                if not source.exists():
                    return False

                dest = trash_dir / source.name
                counter = 1
                while dest.exists():
                    dest = trash_dir / f"{source.stem}_{counter}{source.suffix}"
                    counter += 1

                shutil.move(str(source), str(dest))
                logger.info(f"Moved {path} to local trash: {dest}")
                return True
            except Exception as e:
                logger.error(f"Failed to send {path} to trash: {e}")
                return False

    def delete_assets(self, asset_ids: List[str]) -> int:
        """Delete assets from the database and send their files to the trash."""
        try:
            object_ids = [ObjectId(asset_id) for asset_id in asset_ids]
        except Exception as e:
            logger.error(f"Invalid asset ID while deleting: {e}")
            return 0

        if not object_ids:
            return 0

        # Collect file paths before deleting the records
        files_to_delete = []
        for doc in self.collection.find({"_id": {"$in": object_ids}}, {"path": 1}):
            if doc.get("path"):
                files_to_delete.append(doc["path"])

        result = self.collection.delete_many({"_id": {"$in": object_ids}})

        # Send files to trash (recycle bin)
        for path in files_to_delete:
            file_path = Path(path).resolve()
            if file_path.exists() and file_path.is_file():
                self._move_to_trash(str(file_path))

        return result.deleted_count

    def delete_assets_by_path(self, path: str) -> int:
        """Delete assets matching a file path (or under a directory), sending files to trash."""
        target = Path(path).resolve()
        pattern = re.escape(str(target))
        query = {
            "$or": [
                {"path": str(target)},
                {"path": {"$regex": f"^{pattern}(/|\\\\)"}},
            ]
        }
        docs = list(self.collection.find(query, {"path": 1}))
        if not docs:
            return 0

        paths = [doc["path"] for doc in docs if doc.get("path")]
        result = self.collection.delete_many({"_id": {"$in": [doc["_id"] for doc in docs]}})

        if target.is_dir():
            self._move_to_trash(str(target))
        else:
            for p in paths:
                file_path = Path(p).resolve()
                if file_path.exists() and file_path.is_file():
                    self._move_to_trash(str(file_path))

        return result.deleted_count

    def delete_assets_by_path_db_only(self, path: str) -> int:
        """Delete assets matching a file path or directory without touching disk."""
        target = Path(path).resolve()
        pattern = re.escape(str(target))
        query = {
            "$or": [
                {"path": str(target)},
                {"path": {"$regex": f"^{pattern}(/|\\\\)"}},
            ]
        }
        result = self.collection.delete_many(query)
        return result.deleted_count

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
        directory: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> AssetList:
        """List assets with pagination and filters."""
        # Build filter query
        filter_query = build_search_filter(query)

        if asset_type:
            filter_query["type"] = asset_type

        if directory:
            # Assets strictly under the directory (avoids prefix collisions).
            pattern = re.escape(str(directory))
            filter_query["path"] = {"$regex": f"^{pattern}(/|\\\\)"}

        if project_id:
            project_asset_ids = self.db.project_assets.distinct("asset_id", {"project_id": project_id})
            valid_asset_ids = []
            for asset_id in project_asset_ids:
                try:
                    valid_asset_ids.append(ObjectId(asset_id))
                except Exception:
                    continue
            filter_query["_id"] = {"$in": valid_asset_ids}

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
        # Match the directory itself and anything under it, but not sibling
        # directories that merely share a path prefix (e.g. "media" vs "media2").
        pattern = re.escape(str(directory_path))
        filter_query = {"path": {"$regex": f"^{pattern}(/|\\\\)?"}}

        assets = []
        for doc in self.collection.find(filter_query, {"path": 1, "_id": 1}):
            doc["_id"] = str(doc["_id"])
            assets.append(doc)

        return assets

    def count_project_assets(self, project_id: str) -> int:
        """Count assets in a project, dropping references to assets that no longer exist."""
        referenced = self.db.project_assets.distinct("asset_id", {"project_id": project_id})
        object_ids = []
        for asset_id in referenced:
            try:
                object_ids.append(ObjectId(asset_id))
            except Exception:
                continue
        existing = {str(doc["_id"]) for doc in self.collection.find({"_id": {"$in": object_ids}}, {"_id": 1})}
        stale = [asset_id for asset_id in referenced if asset_id not in existing]
        if stale:
            self.db.project_assets.delete_many({"project_id": project_id, "asset_id": {"$in": stale}})
        return len(existing)

    def add_directory_to_project(self, project_id: str, directory_path: str) -> int:
        """Assign every asset strictly under ``directory_path`` to a project."""
        pattern = re.escape(str(directory_path).rstrip("/\\"))
        cursor = self.collection.find({"path": {"$regex": f"^{pattern}(/|\\\\)"}}, {"_id": 1})
        operations = [
            UpdateOne(
                {"project_id": project_id, "asset_id": str(doc["_id"])},
                {"$setOnInsert": {"project_id": project_id, "asset_id": str(doc["_id"])}},
                upsert=True,
            )
            for doc in cursor
        ]
        if not operations:
            return 0
        self.db.project_assets.bulk_write(operations, ordered=False)
        return len(operations)
