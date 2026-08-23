"""FastAPI main application."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api import assets, index
from backend.app.config import settings
from backend.app.db.mongodb import mongodb

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager."""
    # Startup
    logger.info("Starting maxv backend...")

    # Ensure data directories exist
    settings.ensure_directories()
    logger.info("Data directories initialized")

    # Connect to MongoDB
    mongodb.connect()

    yield

    # Shutdown
    logger.info("Shutting down maxv backend...")
    mongodb.disconnect()


# Create FastAPI application
app = FastAPI(
    title="maxv API",
    description="Agentic Media Asset Explorer API",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(assets.router)
app.include_router(index.router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "name": "maxv API",
        "version": "0.1.0",
        "description": "Agentic Media Asset Explorer",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_reload,
    )
