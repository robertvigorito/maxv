"""MongoDB connection and initialization."""

import logging
from typing import Optional

from pymongo import MongoClient, ASCENDING, TEXT
from pymongo.database import Database

from backend.app.config import settings

logger = logging.getLogger(__name__)


class MongoDB:
    """MongoDB connection manager."""

    client: Optional[MongoClient] = None
    db: Optional[Database] = None

    def connect(self) -> None:
        """Connect to MongoDB and initialize database."""
        logger.info(f"Connecting to MongoDB at {settings.mongodb_uri}")
        self.client = MongoClient(settings.mongodb_uri)
        self.db = self.client[settings.mongodb_db_name]

        # Create indexes
        self.create_indexes()
        logger.info("MongoDB connection established")

    def create_indexes(self) -> None:
        """Create required indexes on collections."""
        if self.db is None:
            return

        assets_collection = self.db.assets

        # Create indexes
        assets_collection.create_index("path", unique=True)
        assets_collection.create_index("type")
        assets_collection.create_index("hash")
        assets_collection.create_index([("filename", TEXT)])
        assets_collection.create_index([("modified_at", ASCENDING), ("size", ASCENDING)])
        logger.info("Database indexes created")

    def disconnect(self) -> None:
        """Disconnect from MongoDB."""
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed")

    def get_collection(self, name: str):
        """Get a collection by name."""
        if self.db is None:
            raise RuntimeError("Database not connected")
        return self.db[name]


# Global MongoDB instance
mongodb = MongoDB()


def get_database() -> Database:
    """Dependency to get database instance."""
    if mongodb.db is None:
        raise RuntimeError("Database not connected")
    return mongodb.db
