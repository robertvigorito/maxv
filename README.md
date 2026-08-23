# maxv — Agentic Media Asset Explorer

**maxv** is a local-first media asset exploration and viewing tool with bubble-style thumbnails, fast search, and agentic workflow for natural-language media exploration.

## Features

- **Local-First Architecture**: Original media stays on your local disk, never uploaded
- **Fast Indexing**: Incremental filesystem scanning with MongoDB metadata index
- **Bubble-Style UI**: Modern visual explorer with responsive bubble thumbnails
- **Smart Search**: Fast text search with filters for type, dimensions, and date
- **Video & Image Support**: `.mov`, `.jpg`, `.jpeg`, `.png` files
- **Video Playback**: Browser-based HTML5 video with HTTP range support + VLC fallback
- **Thumbnail Caching**: Fast loading with pre-generated thumbnails
- **Keyboard Navigation**: Quick shortcuts for search, navigation, and playback
- **Future: Agentic Exploration**: Natural language queries with AI-powered asset discovery

## Technology Stack

### Backend
- **Python 3.11+** with `uv` for dependency management
- **FastAPI** for REST API
- **Motor** (async MongoDB driver)
- **Pillow** for image processing
- **FFmpeg** for video metadata and thumbnails
- **Pydantic** for data validation

### Frontend
- **React** with Vite
- **Tailwind CSS** for styling
- **react-window** for virtualized rendering

### Storage
- **MongoDB** for asset metadata and search index
- **Local filesystem** for original media files
- **Local cache** for generated thumbnails

## Quick Start

### Prerequisites

- Python 3.11 or higher
- MongoDB (local or Docker)
- FFmpeg (for video processing)
- Node.js 18+ (for frontend)
- `uv` Python package manager

### Backend Setup

```bash
# 1. Clone the repository
cd /path/to/maxv

# 2. Install uv if not already installed
curl -LsSf https://astral.sh/uv/install.sh | sh

# 3. Install Python dependencies
uv sync

# 4. Start MongoDB (using Docker)
docker run -d -p 27017:27017 --name maxv-mongo mongo:latest

# Or start local MongoDB
# mongod --dbpath /path/to/data

# 5. Create .env file (copy from .env.example)
cp .env.example .env

# 6. Create data directories
mkdir -p data/media data/thumbnails data/cache

# 7. Start the backend
uv run uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

API documentation: `http://localhost:8000/docs`

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be available at `http://localhost:5173`

## Usage

### 1. Index Media Files

Add media files to `data/media/` directory, then trigger a scan:

```bash
curl -X POST http://localhost:8000/api/index/scan \
  -H "Content-Type: application/json" \
  -d '{"path": "./data/media"}'
```

Or use the API docs interface at `/docs`

### 2. Browse Assets

Open the frontend at `http://localhost:5173` and:
- View bubble-style thumbnails of all indexed media
- Use the search bar to filter by filename
- Use fielded search syntax such as `name:_A* size:4mb> tag:travel`
- Click any bubble to open the asset viewer
- Navigate with arrow keys
- Play videos with space bar

### 3. Search and Filter

The search bar accepts plain filename terms and machine-readable field clauses. Clauses are combined with AND:

```text
name:_A*       # filename glob, with * and ? wildcards
size:4mb>      # larger than 4 MiB; also supports <, <=, >=, and =
tag:travel     # case-insensitive match against the asset tags array
```

```bash
# List all assets
GET http://localhost:8000/api/assets

# Search by filename
GET http://localhost:8000/api/assets?q=interview

# Filter by type
GET http://localhost:8000/api/assets?type=video

# Pagination
GET http://localhost:8000/api/assets?page=2&limit=50
```

## Project Structure

```
maxv/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application
│   │   ├── config.py            # Configuration management
│   │   ├── api/
│   │   │   ├── assets.py        # Asset endpoints
│   │   │   └── index.py         # Indexing endpoints
│   │   ├── models/
│   │   │   └── asset.py         # Pydantic models
│   │   ├── services/
│   │   │   ├── scanner.py       # Filesystem scanner
│   │   │   ├── metadata.py      # Metadata extraction
│   │   │   ├── thumbnails.py    # Thumbnail generation
│   │   │   └── asset_service.py # Asset CRUD operations
│   │   └── db/
│   │       └── mongodb.py       # MongoDB connection
│   └── tests/                   # Backend tests
├── frontend/                    # React frontend (to be created)
├── data/
│   ├── media/                   # Original media files
│   ├── thumbnails/              # Generated thumbnails
│   └── cache/                   # Cache directory
├── pyproject.toml               # Python dependencies
├── .env.example                 # Environment variables template
└── README.md                    # This file
```

## API Endpoints

### Assets
- `GET /api/assets` - List assets (paginated, filterable)
- `GET /api/assets/{id}` - Get single asset metadata
- `GET /api/assets/{id}/thumbnail` - Get thumbnail image
- `GET /api/assets/{id}/file` - Get original file (with range support)
- `GET /api/assets/search?q=query` - Search assets

### Indexing
- `POST /api/index/scan` - Trigger directory scan
- `GET /api/index/status` - Get scan status

### Health
- `GET /` - API information
- `GET /health` - Health check

## Configuration

Edit `.env` file or set environment variables:

```bash
# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=maxv

# Media paths
MEDIA_PATH=./data/media
THUMBNAIL_PATH=./data/thumbnails
CACHE_PATH=./data/cache

# Thumbnail settings
THUMBNAIL_MAX_SIZE=400
THUMBNAIL_QUALITY=85

# API
API_HOST=0.0.0.0
API_PORT=8000

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

## Development

### Run Tests

```bash
# Backend tests
uv run pytest

# Frontend tests (when implemented)
cd frontend && npm test
```

### Code Formatting

```bash
# Format Python code with ruff
uv run ruff format backend/

# Lint Python code
uv run ruff check backend/
```

## Keyboard Shortcuts (Frontend)

- `/` - Focus search bar
- `←` / `→` - Navigate between assets in viewer
- `Space` - Play/pause video
- `Enter` - Open selected asset
- `Esc` - Close viewer
- `F` - Toggle fullscreen (video)

## MongoDB Schema

Assets are stored with the following structure:

```json
{
  "_id": "ObjectId",
  "path": "/absolute/path/to/video.mov",
  "filename": "video.mov",
  "type": "video",
  "mime": "video/quicktime",
  "size": 182736182,
  "modified_at": "2026-08-21T12:00:00Z",
  "width": 3840,
  "height": 2160,
  "duration": 124.5,
  "thumbnail_path": "data/thumbnails/abc123.jpg",
  "hash": "sha256:abc123...",
  "metadata": {
    "codec": "h264",
    "fps": 30.0
  },
  "indexed_at": "2026-08-21T12:00:00Z"
}
```

## Roadmap

### Phase 1: Backend Foundation ✅ (Current)
- Filesystem scanner
- Metadata extraction
- MongoDB indexing
- Thumbnail generation
- REST API

### Phase 2: Frontend Viewer (Next)
- React application with bubble UI
- Search and filtering
- Asset viewer with image/video support
- Keyboard navigation
- Virtualized rendering

### Phase 3: VLC Integration
- Player abstraction layer
- VLC external playback
- Codec detection and fallback

### Phase 4: Agentic Layer
- Natural language queries
- Agent tools and planner
- Semantic search
- Similar asset discovery

### Phase 5: Advanced Features
- CLIP embeddings for semantic search
- Scene detection
- OCR and speech-to-text
- Collections and tagging
- Batch operations

## Troubleshooting

### MongoDB Connection Issues

```bash
# Check if MongoDB is running
docker ps | grep maxv-mongo

# View MongoDB logs
docker logs maxv-mongo

# Connect to MongoDB shell
docker exec -it maxv-mongo mongosh
```

### FFmpeg Not Found

Install FFmpeg:
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Verify installation
ffmpeg -version
```

### Port Already in Use

Change the port in `.env`:
```bash
API_PORT=8001
```

## Contributing

This is a personal project but suggestions and feedback are welcome!

## License

MIT License - See LICENSE file for details

---

**maxv** — Maximum Velocity for Media Exploration 🚀
