"""MongoDB connection and initialization."""

import logging
import re
from typing import Optional

from pymongo import ASCENDING, DESCENDING, MongoClient, TEXT
from pymongo.database import Database

from backend.app.config import settings

logger = logging.getLogger(__name__)


class MongoDB:
    """MongoDB connection manager."""

    client: Optional[MongoClient] = None
    db: Optional[Database] = None
    active_database_name: str = ""
    active_collection_name: str = "assets"

    def connect(self) -> None:
        """Connect to MongoDB and initialize database."""
        logger.info(f"Connecting to MongoDB at {settings.mongodb_uri}")
        self.client = MongoClient(settings.mongodb_uri)
        self.active_database_name = settings.mongodb_db_name
        self.db = self.client[self.active_database_name]

        # Create indexes
        self.create_indexes()
        logger.info("MongoDB connection established")

    def create_indexes(self) -> None:
        """Create required indexes on collections."""
        if self.db is None:
            return

        assets_collection = self.db[self.active_collection_name]

        # Create indexes
        assets_collection.create_index("path", unique=True)
        assets_collection.create_index("type")
        assets_collection.create_index("hash")
        assets_collection.create_index([("filename", TEXT)])
        assets_collection.create_index([("modified_at", ASCENDING), ("size", ASCENDING)])
        # Supports the "sort by most recently indexed" listing in list_assets.
        assets_collection.create_index([("indexed_at", DESCENDING)])
        self.db.projects.create_index("name", unique=True)
        self.db.project_assets.create_index([("project_id", 1), ("asset_id", 1)], unique=True)
        self.db.project_assets.create_index("project_id")
        logger.info("Database indexes created")

    def disconnect(self) -> None:
        """Disconnect from MongoDB."""
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed")

    def get_collection(self, name: Optional[str] = None):
        """Get a collection by name."""
        if self.db is None:
            raise RuntimeError("Database not connected")
        return self.db[name or self.active_collection_name]

    def switch_database(self, database_name: str) -> None:
        """Select the database used by asset API dependencies."""
        if not re.fullmatch(r"[A-Za-z0-9_-]+", database_name):
            raise ValueError("Database names may only contain letters, numbers, '_' or '-'.")
        if self.client is None:
            raise RuntimeError("Database not connected")
        self.active_database_name = database_name
        self.db = self.client[database_name]
        self.create_indexes()


# Global MongoDB instance
mongodb = MongoDB()


def get_database() -> Database:
    """Dependency to get database instance."""
    if mongodb.db is None:
        raise RuntimeError("Database not connected")
    return mongodb.db
