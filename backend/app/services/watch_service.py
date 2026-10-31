"""Watch folder manager.

Polls one or more watched directories on independent timers, scanning them for
new/changed media (recursively) and appending to the asset database. Scans are
append-only and path-deduplicated (see ``MediaScanner``), so watching a folder
never creates duplicate assets.

Each watch has its own poll interval (in seconds) and can be paused/resumed.
Watches persist in the ``watches`` MongoDB collection so they survive restarts.
"""

import logging
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional

from pymongo.database import Database

from backend.app.config import settings
from backend.app.services.asset_service import AssetService
from backend.app.services.scanner import MediaScanner

logger = logging.getLogger(__name__)

DEFAULT_INTERVAL = 10
TICK_SECONDS = 0.5


def resolve_watch_path(path: str) -> str:
    """Resolve a watch path to an absolute, normalized filesystem path."""
    p = Path(path).expanduser()
    if not p.is_absolute():
        p = settings.media_path / p
    return str(p.resolve())


class WatchManager:
    """Schedules and runs scans for a set of watched folders."""

    def __init__(self):
        self._db: Optional[Database] = None
        self._lock = threading.RLock()
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="watch")
        # path -> persistent watch document (path, interval, enabled, ...)
        self._cache: Dict[str, dict] = {}
        # path -> next scheduled scan time (unix seconds)
        self._next_due: Dict[str, float] = {}
        # set of paths currently being scanned (in-memory only)
        self._scanning: set = set()

    # ------------------------------------------------------------------ life

    def start(self, db: Database) -> None:
        """Load persisted watches and start the scheduler thread."""
        self._db = db
        self._load()
        self._stop.clear()
        self._thread = threading.Thread(target=self._run_loop, name="watch-scheduler", daemon=True)
        self._thread.start()
        logger.info("Watch manager started")

    def stop(self) -> None:
        """Stop the scheduler and wait for in-flight scans to finish."""
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=2)
        self._executor.shutdown(wait=False)
        logger.info("Watch manager stopped")

    def _collection(self):
        if self._db is None:
            raise RuntimeError("Watch manager not started")
        return self._db["watches"]

    def _load(self) -> None:
        with self._lock:
            for doc in self._collection().find({}):
                path = doc.get("path")
                if not path:
                    continue
                self._cache[path] = doc
                # Scan soon after startup so existing media gets indexed.
                self._next_due[path] = time.time()
            logger.info("Loaded %d watched folder(s)", len(self._cache))

    # ------------------------------------------------------------------ api

    def list_watches(self) -> List[dict]:
        """Return all watches with live scheduling state."""
        now = datetime.utcnow()
        with self._lock:
            return sorted(
                (self._serialize(doc, now) for doc in self._cache.values()),
                key=lambda w: w["path"],
            )

    def add_watch(self, path: str, interval: int = DEFAULT_INTERVAL) -> dict:
        """Add a watch for ``path`` (upsert by path) and scan it immediately."""
        resolved = resolve_watch_path(path)
        p = Path(resolved)
        if not p.exists():
            raise ValueError(f"Path does not exist: {path}")
        if not p.is_dir():
            raise ValueError(f"Path is not a directory: {path}")
        interval = max(1, min(3600, int(interval)))

        with self._lock:
            existing = self._cache.get(resolved)
            if existing:
                existing["interval"] = interval
                existing["enabled"] = True
                self._collection().update_one(
                    {"path": resolved},
                    {"$set": {"interval": interval, "enabled": True}},
                )
                doc = existing
            else:
                doc = {
                    "path": resolved,
                    "interval": interval,
                    "enabled": True,
                    "created_at": datetime.utcnow(),
                    "last_scan_at": None,
                    "last_stats": {},
                }
                inserted = self._collection().insert_one(doc)
                doc["_id"] = inserted.inserted_id
                self._cache[resolved] = doc
            # Schedule an immediate first scan.
            self._next_due[resolved] = time.time()

        logger.info("Added watch for %s every %ds", resolved, interval)
        return self._serialize(doc, datetime.utcnow())

    def update_watch(
        self,
        path: str,
        interval: Optional[int] = None,
        enabled: Optional[bool] = None,
    ) -> dict:
        """Update a watch's interval and/or enabled flag (identified by path)."""
        resolved = resolve_watch_path(path)
        with self._lock:
            doc = self._cache.get(resolved)
            if doc is None:
                raise ValueError(f"Watch not found: {path}")

            update: dict = {}
            if interval is not None:
                interval = max(1, min(3600, int(interval)))
                doc["interval"] = interval
                update["interval"] = interval
            if enabled is not None:
                doc["enabled"] = bool(enabled)
                update["enabled"] = bool(enabled)

            if update:
                self._collection().update_one({"path": resolved}, {"$set": update})

            # Re-enabling (or changing the timer) schedules a scan promptly.
            if doc["enabled"]:
                self._next_due[resolved] = time.time()

            return self._serialize(doc, datetime.utcnow())

    def remove_watch(self, path: str) -> bool:
        """Remove a watch (identified by path)."""
        resolved = resolve_watch_path(path)
        with self._lock:
            if resolved not in self._cache:
                raise ValueError(f"Watch not found: {path}")
            self._collection().delete_one({"path": resolved})
            self._cache.pop(resolved, None)
            self._next_due.pop(resolved, None)
            self._scanning.discard(resolved)
        logger.info("Removed watch for %s", resolved)
        return True

    def trigger_scan(self, path: str) -> bool:
        """Schedule an immediate scan of a watch (works even when paused)."""
        resolved = resolve_watch_path(path)
        with self._lock:
            if resolved not in self._cache:
                raise ValueError(f"Watch not found: {path}")
            self._next_due[resolved] = time.time()
        return True

    # --------------------------------------------------------------- internal

    def _serialize(self, doc: dict, now: datetime) -> dict:
        path = doc.get("path")
        due = self._next_due.get(path)
        next_at = None
        if due:
            remaining = max(0.0, due - time.time())
            next_at = now + timedelta(seconds=remaining)
        return {
            "_id": str(doc.get("_id")),
            "path": path,
            "interval": doc.get("interval", DEFAULT_INTERVAL),
            "enabled": bool(doc.get("enabled", True)),
            "created_at": doc.get("created_at"),
            "last_scan_at": doc.get("last_scan_at"),
            "next_scan_at": next_at,
            "scanning": path in self._scanning,
            "last_stats": doc.get("last_stats", {}) or {},
        }

    def _run_loop(self) -> None:
        while not self._stop.is_set():
            try:
                self._tick()
            except Exception as e:  # noqa: BLE001 - scheduler must survive
                logger.error("Watch scheduler tick failed: %s", e)
            self._stop.wait(TICK_SECONDS)

    def _tick(self) -> None:
        now = time.time()
        with self._lock:
            for path, doc in list(self._cache.items()):
                if not doc.get("enabled", True):
                    continue
                if path in self._scanning:
                    continue
                if now < self._next_due.get(path, 0):
                    continue
                self._next_due[path] = now + doc.get("interval", DEFAULT_INTERVAL)
                self._scanning.add(path)
                self._executor.submit(self._scan_task, path)

    def _scan_task(self, path: str) -> None:
        try:
            if self._db is None:
                return
            service = AssetService(self._db)
            scanner = MediaScanner()
            stats = scanner.scan_and_index(Path(path), service, recursive=True)
            with self._lock:
                doc = self._cache.get(path)
                if doc is not None:
                    doc["last_scan_at"] = datetime.utcnow()
                    doc["last_stats"] = stats
                    self._collection().update_one(
                        {"path": path},
                        {"$set": {"last_scan_at": doc["last_scan_at"], "last_stats": stats}},
                    )
            logger.info("Watch scan complete for %s: %s", path, stats)
        except Exception as e:  # noqa: BLE001
            logger.error("Watch scan failed for %s: %s", path, e)
        finally:
            with self._lock:
                self._scanning.discard(path)


# Global watch manager instance.
watch_manager = WatchManager()
