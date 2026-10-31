import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import SearchBar from './components/SearchBar';
import AssetGrid from './components/AssetGrid';
import AssetViewer from './components/AssetViewer';
import CommandPrompt from './components/CommandPrompt';
import TagPopup from './components/TagPopup';
import QuickTagMenu from './components/QuickTagMenu';
import FilterPanel, { UNTAGGED } from './components/FilterPanel';
import ScanProgress from './components/ScanProgress';
import MediaContextMenu from './components/MediaContextMenu';
import TimelinePanel from './components/TimelinePanel';
import TimelinePlayer from './components/TimelinePlayer';
import SettingsModal from './components/SettingsModal';
import { ACCENT_KEY, THEME_KEY, applyAppearance } from './theme';
import TimelineTrimViewer from './components/TimelineTrimViewer';
import MetadataModal from './components/MetadataModal';
import WatchPanel from './components/WatchPanel';
import ConfirmDialog from './components/ConfirmDialog';
import ProjectPicker from './components/ProjectPicker';
import RenameDialog from './components/RenameDialog';
import { api } from './api/client';
import { useLocalStorage } from './hooks/useLocalStorage';

function App() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [commandPromptOpen, setCommandPromptOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useLocalStorage(THEME_KEY, 'default');
  const [accent, setAccent] = useLocalStorage(ACCENT_KEY, 'purple');
  useEffect(() => {
    applyAppearance(theme, accent);
  }, [theme, accent]);
  const [watchPanelOpen, setWatchPanelOpen] = useState(false);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useLocalStorage('maxv-selected-project', '');
  const [scanProgress, setScanProgress] = useState(null);
  const scanTimerRef = useRef(null);
  const scanRefreshCountRef = useRef(0);
  const scanQueueRef = useRef([]);
  const scanActiveRef = useRef(false);
  const pollScanStatusRef = useRef(null);
  const processScanQueueRef = useRef(null);
  const [lastScanPath, setLastScanPath] = useLocalStorage('maxv-last-scan-path', '');
  const [mediaContextMenu, setMediaContextMenu] = useState(null);
  const [mediaExpandSelection, setMediaExpandSelection] = useState(null);
  const [renameItems, setRenameItems] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [timeline, setTimeline] = useLocalStorage('maxv-timeline', []);
  const timelinePresetRef = useRef(false);
  const timelineHadSavedStateRef = useRef(window.localStorage.getItem('maxv-timeline') !== null);
  const [playingIndex, setPlayingIndex] = useState(null);
  const [directPlaybackIds, setDirectPlaybackIds] = useState(null);
  const [trims, setTrims] = useLocalStorage('maxv-trims', {});
  const [annotationMarkers, setAnnotationMarkers] = useLocalStorage('maxv-annotation-markers', {});
  const [trimAssetId, setTrimAssetId] = useState(null);
  const [timelineCollapsed, setTimelineCollapsed] = useLocalStorage('maxv-timeline-collapsed', false);
  const [thumbnailSize, setThumbnailSize] = useLocalStorage('maxv-thumbnail-size', 200);
  const [thumbnailWidth, setThumbnailWidth] = useLocalStorage('maxv-thumbnail-width', 200);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectionAnchor, setSelectionAnchor] = useState(null);
  const [tagPopupOpen, setTagPopupOpen] = useState(false);
  const [quickTagMenu, setQuickTagMenu] = useState(null);
  const [tagFilters, setTagFilters] = useState(new Set());
  const [groupBy, setGroupBy] = useState('none');
  const [panelCollapsed, setPanelCollapsed] = useLocalStorage('maxv-filter-panel-collapsed', false);
  const [panelTab, setPanelTab] = useLocalStorage('maxv-filter-panel-tab', 'filters');
  const [revealPath, setRevealPath] = useState(null);
  const [sizeFilter, setSizeFilter] = useState('all');
  const [fileSizeFilters, setFileSizeFilters] = useState(new Set());
  const [extensionFilter, setExtensionFilter] = useState('all');
  const [dirFilter, setDirFilter] = useState('');
  const [metadataAsset, setMetadataAsset] = useState(null);

  const [totalAssetCount, setTotalAssetCount] = useState(null);

  const refreshCounts = useCallback(async () => {
    try {
      const [projectList, all] = await Promise.all([api.fetchProjects(), api.fetchAssets('', '', 1, 1)]);
      setProjects(projectList);
      setTotalAssetCount(all.total);
    } catch (error) {
      console.error('Failed to load project counts:', error);
    }
  }, []);

  // Refs so the global keydown handler always sees the latest selection/viewer
  // state without re-subscribing the listener on every selection change.
  const selectedIndexRef = useRef(null);
  selectedIndexRef.current = selectedIndex;
  const selectedIdsRef = useRef(new Set());
  selectedIdsRef.current = selectedIds;
  const metadataAssetRef = useRef(null);
  metadataAssetRef.current = metadataAsset;
  const hoveredAssetIdRef = useRef(null);
  const handleHoverChange = useCallback((assetId) => {
    hoveredAssetIdRef.current = assetId;
  }, []);

  // Multi-selection in the media bin (folders/files).
  const [mediaSelection, setMediaSelection] = useState([]);
  const handleMediaSelectionChange = useCallback((items) => {
    setMediaSelection(items);
  }, []);

  const loadAssets = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      // Fetch every page so the grid isn't limited to the API's per-request
      // page size (500). The backend caps `limit` per request, so loop until
      // we've pulled the full result set.
      const pageSize = 500;
      const allItems = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const data = await api.fetchAssets(query, typeFilter, page, pageSize, '', selectedProjectId);
        allItems.push(...data.items);
        hasMore = data.items.length === pageSize && allItems.length < data.total;
        page += 1;
      }

      if (!silent) {
        setAssets(allItems);
        if (!timelineHadSavedStateRef.current && !timelinePresetRef.current) {
          setTimeline(allItems.map((asset) => asset._id));
          timelinePresetRef.current = true;
        }
      } else if (allItems.length > 0) {
        // Streaming refresh while a scan is running: only replace the grid
        // when there is something to show so we never flash the empty state.
        setAssets(allItems);
      }
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      if (!silent) setLoading(false);
      if (!silent) refreshCounts();
    }
  }, [query, refreshCounts, selectedProjectId, setTimeline, typeFilter]);

  // Folder watches: auto-index new media dropped into watched directories.
  const [watches, setWatches] = useState([]);
  const lastWatchStateRef = useRef({});
  const watchesTimerRef = useRef(null);

  const loadWatches = useCallback(async () => {
    try {
      const data = await api.listWatches();
      const items = data.items || [];
      const prev = lastWatchStateRef.current;
      const now = {};
      let completedWithChanges = false;
      for (const w of items) {
        const stats = w.last_stats || {};
        const state = {
          scanning: w.scanning,
          last_scan_at: w.last_scan_at,
          newItems: (stats.indexed || 0) + (stats.updated || 0),
        };
        now[w.path] = state;
        const p = prev[w.path];
        if (!p) continue; // First observation: just acknowledge.
        const lastChanged = p.last_scan_at !== w.last_scan_at;
        const finished = (p.scanning && !w.scanning) || lastChanged;
        if (finished && state.newItems > 0) completedWithChanges = true;
      }
      lastWatchStateRef.current = now;
      setWatches(items);
      // A watch finished a scan that found new/updated media -> refresh grid.
      if (completedWithChanges) loadAssets(true);
    } catch (error) {
      console.error('Failed to load watches:', error);
    }
  }, [loadAssets]);

  useEffect(() => {
    loadWatches();
    watchesTimerRef.current = setInterval(loadWatches, 3000);
    return () => {
      if (watchesTimerRef.current) clearInterval(watchesTimerRef.current);
    };
  }, [loadWatches]);

  const handleAddWatch = useCallback(async (path, interval = 10) => {
    try {
      await api.addWatch(path, interval);
      setLastScanPath(path);
      loadWatches();
      loadAssets(true);
    } catch (error) {
      console.error('Failed to add watch:', error);
      window.alert('Failed to add watch.');
    }
  }, [loadWatches, loadAssets, setLastScanPath]);

  const handleUpdateWatch = useCallback(async (path, updates) => {
    try {
      await api.updateWatch(path, updates);
      loadWatches();
    } catch (error) {
      console.error('Failed to update watch:', error);
    }
  }, [loadWatches]);

  const handleRemoveWatch = useCallback(async (path) => {
    try {
      await api.removeWatch(path);
      loadWatches();
    } catch (error) {
      console.error('Failed to remove watch:', error);
      window.alert('Failed to remove watch.');
    }
  }, [loadWatches]);

  const handleScanWatch = useCallback(async (path) => {
    try {
      await api.scanWatch(path);
      loadWatches();
    } catch (error) {
      console.error('Failed to trigger watch scan:', error);
    }
  }, [loadWatches]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  useEffect(() => () => {
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
  }, []);

  const pollScanStatus = useCallback(() => {
    api.scanStatus()
      .then((data) => {
        setScanProgress(data);
        // Remember the last (resolved) scanned path so it becomes the default.
        if (data.path) setLastScanPath(data.path);
        if (data.status === 'running') {
          scanTimerRef.current = setTimeout(pollScanStatus, 600);
          // Stream partial results into the grid while the scan is still
          // running so new assets appear without waiting for full completion.
          scanRefreshCountRef.current += 1;
          if (scanRefreshCountRef.current % 4 === 0) {
            loadAssets(true);
          }
        } else {
          scanTimerRef.current = null;
          scanActiveRef.current = false;
          loadAssets();
          // Start the next queued scan, if any (a drop may enqueue several).
          processScanQueueRef.current?.();
        }
      })
      .catch(() => {
        scanTimerRef.current = null;
        setScanProgress(null);
      });
  }, [loadAssets, setLastScanPath]);

  useEffect(() => {
    pollScanStatus();
  }, [pollScanStatus]);

  // Run scans one at a time so dropping multiple folders doesn't launch a
  // bunch of heavy background scans at once (which stalls the UI).
  const processScanQueue = useCallback(() => {
    if (scanActiveRef.current) return;
    const next = scanQueueRef.current.shift();
    if (!next) return;
    scanActiveRef.current = true;
    setScanProgress({ status: 'running', total: 0, processed: 0, stats: {} });
    api.triggerScan(next.path, next.projectId)
      .then(() => {
        setLastScanPath(next.path);
        pollScanStatusRef.current?.();
      })
      .catch(() => {
        scanActiveRef.current = false;
        setScanProgress(null);
        window.alert('Failed to start scan.');
        processScanQueueRef.current?.();
      });
  }, [setLastScanPath]);

  pollScanStatusRef.current = pollScanStatus;
  processScanQueueRef.current = processScanQueue;

  const triggerScan = (path) => {
    scanQueueRef.current.push({ path, projectId: selectedProjectId });
    processScanQueueRef.current?.();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    // Ignore drops of maxv's own thumbnails/assets: internal drags carry the
    // maxv asset MIME type, so they must not start scans. Only external
    // file/folder drops should scan.
    if (Array.from(e.dataTransfer?.types || []).includes('application/x-maxv-asset')) return;
    if (!files.length) return;

    // Append every dropped item's full path together, newline-separated, and
    // copy the list so the user can paste the dropped paths.
    const paths = files.map((f) => f.path || f.name).filter(Boolean);
    if (paths.length) {
      navigator.clipboard?.writeText(paths.join('\n')).catch(() => {});
    }

    // Scan every unique directory the dropped items live in. A folder drop
    // reports its nested files (webkitRelativePath set) -> scan their common
    // root; individual file drops -> scan each file's parent directory.
    const parents = [...new Set(
      files
        .map((f) => f.path)
        .filter(Boolean)
        .map((p) => {
          const idx = p.lastIndexOf('/');
          return idx > 0 ? p.substring(0, idx) : p;
        })
    )];
    if (!parents.length) return;

    let targets = parents;
    if (files.some((f) => f.webkitRelativePath) && parents.length > 1) {
      // Common parent of all dropped files (the dropped folder itself).
      let root = parents[0];
      for (const parent of parents.slice(1)) {
        while (root && !parent.startsWith(`${root}/`)) {
          const idx = root.lastIndexOf('/');
          root = idx > 0 ? root.substring(0, idx) : '';
        }
        if (!root) break;
      }
      targets = root ? [root] : parents;
    }

    targets.forEach((target) => triggerScan(target));
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+A / Cmd+A to select all thumbnails in the grid
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === 'a' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      ) {
        e.preventDefault();
        setSelectedIds(new Set(assets.map((asset) => asset._id)));
        setSelectionAnchor(null);
        return;
      }

      // Ctrl+P or Alt+K to open command prompt
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') ||
        (e.altKey && e.key.toLowerCase() === 'k')
      ) {
        e.preventDefault();
        setCommandPromptOpen(true);
      }

      // 't' toggles the timeline panel
      if (
        e.key.toLowerCase() === 't' &&
        !e.ctrlKey && !e.metaKey && !e.altKey &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      ) {
        setTimelineCollapsed((value) => !value);
      }

      // 'f' toggles the filter panel
      if (
        e.key.toLowerCase() === 'f' &&
        !e.ctrlKey && !e.metaKey && !e.altKey &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      ) {
        setPanelCollapsed((value) => !value);
      }

      // 'i' toggles metadata for the viewed or selected asset
      if (
        e.key.toLowerCase() === 'i' &&
        !e.ctrlKey && !e.metaKey && !e.altKey &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      ) {
        e.preventDefault();
        if (metadataAssetRef.current) {
          setMetadataAsset(null);
        } else {
          const hoveredId = hoveredAssetIdRef.current;
          const idx = selectedIndexRef.current;
          const target = hoveredId
            ? assets.find((a) => a._id === hoveredId) || null
            : idx !== null && idx < assets.length
              ? assets[idx]
              : assets.find((a) => a._id === [...selectedIdsRef.current][0]) || null;
          setMetadataAsset(target);
        }
      }

      if (e.key === 'Escape' || e.code === 'Escape') {
        if (metadataAssetRef.current) {
          setMetadataAsset(null);
        } else {
          setSelectedIds(new Set());
          setSelectionAnchor(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [assets, setPanelCollapsed, setTimelineCollapsed]);

  const handleAssetOpen = (index) => {
    setSelectedIndex(index);
  };

  const handleSelect = (assetId, index, shiftKey, altKey) => {
    setSelectedIds((current) => {
      if (altKey) return new Set([assetId]);

      if (shiftKey && selectionAnchor !== null) {
        const start = Math.min(selectionAnchor, index);
        const end = Math.max(selectionAnchor, index);
        const next = new Set(current);
        assets.slice(start, end + 1).forEach((asset) => next.add(asset._id));
        return next;
      }

      const next = new Set(current);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
    if (!shiftKey) setSelectionAnchor(index);
  };

  const handleAssetContextMenu = (event, assetId) => {
    event.preventDefault();
    // Ensure the right-clicked thumbnail is part of the selection so tag actions apply to it.
    setSelectedIds((current) => {
      if (current.has(assetId)) return current;
      const next = new Set(current);
      next.add(assetId);
      return next;
    });
    setQuickTagMenu({ x: event.clientX, y: event.clientY, assetId });
  };

  const handleAddTags = async (tags) => {
    await api.addTags([...selectedIds], tags);
    setAssets((current) => current.map((asset) => (
      selectedIds.has(asset._id)
        ? { ...asset, tags: [...new Set([...(asset.tags || []), ...tags])] }
        : asset
    )));
    setSelectedIds(new Set());
    setTagPopupOpen(false);
  };

  const handleRemoveTags = async (tags) => {
    await api.removeTags([...selectedIds], tags);
    setAssets((current) => current.map((asset) => (
      selectedIds.has(asset._id)
        ? { ...asset, tags: (asset.tags || []).filter((tag) => !tags.includes(tag)) }
        : asset
    )));
  };

  const handleClearTags = async () => {
    await api.clearTags([...selectedIds]);
    setAssets((current) => current.map((asset) => (
      selectedIds.has(asset._id)
        ? { ...asset, tags: [] }
        : asset
    )));
  };

  const handleMediaItemContextMenu = (event, item) => {
    event.preventDefault();
    setMediaContextMenu({ x: event.clientX, y: event.clientY, item });
  };

  const handleExpandMediaSelection = (items) => {
    setMediaContextMenu(null);
    const paths = items.filter((item) => item.type === 'dir').map((item) => item.path);
    if (paths.length) setMediaExpandSelection({ paths, nonce: Date.now() });
  };

  const openRenameDialog = (items, closeMenu) => {
    closeMenu();
    const unique = [...new Map(items.map((item) => [item.path, item])).values()];
    // Renaming a selected directory also moves its contents. Do not separately
    // schedule descendants of a selected directory for a second rename.
    const topLevel = unique.filter((item) => !unique.some((parent) => (
      parent.type === 'dir' && parent.path !== item.path && item.path.startsWith(`${parent.path}/`)
    )));
    setRenameItems(topLevel.map((item) => ({
      ...item,
      name: item.name || item.filename || item.path.split('/').pop(),
      type: item.type || 'file',
    })));
  };

  const handleRenameItems = async (renames) => {
    try {
      await api.renameItems(renames);
      setRenameItems(null);
      setSelectedIds(new Set());
      setSelectionAnchor(null);
      await loadAssets();
    } catch (error) {
      console.error('Failed to rename selected items:', error);
      throw error;
    }
  };

  // Filter the grid to the assets under a folder.
  const handleFilterFolder = (item) => {
    setQuery('');
    const path = item.type === 'dir'
      ? item.path
      : item.path.substring(0, item.path.lastIndexOf('/'));
    setDirFilter(path);
  };

  // Alt-click toggles the folder filter.
  const toggleDirFilter = (path) => {
    setQuery('');
    setDirFilter((current) => (current === path ? '' : path));
  };

  // Merge the selected frame assets into a single sequence (plate) entry.
  const handlePlateSelected = async () => {
    setQuickTagMenu(null);
    const ids = [...selectedIds];
    if (!ids.length) return;
    try {
      await api.plateAssets(ids);
      loadAssets();
    } catch (error) {
      console.error('Failed to plate assets:', error);
      window.alert('Failed to plate assets.');
    }
  };

  const handleMediaOpen = async (item) => {
    setMediaContextMenu(null);
    try {
      if (item.type === 'file' && item.assetId) await api.openInExplorer(item.assetId);
      else await api.openFolder(item.path);
    } catch (error) {
      console.error('Failed to open:', error);
      window.alert('Failed to open location.');
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const handleMediaCopy = async (kind, items) => {
    setMediaContextMenu(null);
    const list = Array.isArray(items) ? items : [items];
    const lines = list.map((item) => {
      if (kind === 'path') return item.path;
      if (kind === 'directory') return item.type === 'dir' ? item.path : item.path.substring(0, item.path.lastIndexOf('/'));
      if (kind === 'tags') return (item.tags || []).join(', ');
      if (kind === 'size') return formatSize(item.size);
      return '';
    }).filter(Boolean);
    if (!lines.length) return;
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleMediaTags = async (tags, items, action) => {
    setMediaContextMenu(null);
    const ids = (Array.isArray(items) ? items : [items])
      .filter((item) => item.type === 'file' && item.assetId)
      .map((item) => item.assetId);
    if (!ids.length || !tags.length) return;
    try {
      if (action === 'append') await api.addTags(ids, tags);
      else await api.removeTags(ids, tags);
      setAssets((current) => current.map((asset) => {
        if (!ids.includes(asset._id)) return asset;
        const nextTags = action === 'append'
          ? [...new Set([...(asset.tags || []), ...tags])]
          : (asset.tags || []).filter((tag) => !tags.includes(tag));
        return { ...asset, tags: nextTags };
      }));
    } catch (error) {
      console.error(`Failed to ${action} media-bin tags:`, error);
      window.alert(`Failed to ${action} tags.`);
    }
  };

  const handleMediaDelete = async (item) => {
    setMediaContextMenu(null);
    const label = item.type === 'dir' ? 'directory' : 'file';
    setConfirmDialog({
      title: `Delete ${label} from disk?`,
      message: `This will remove the ${label} from the database and send it to trash.\n\n${item.path}`,
      confirmLabel: 'Delete from disk',
      onConfirm: async () => {
        try {
          await api.deleteAssetsByPath(item.path);
          loadAssets();
        } catch (error) {
          console.error('Failed to delete:', error);
          window.alert('Failed to delete.');
        }
      },
    });
  };

  const handleMediaDeleteDbOnly = async (item) => {
    setMediaContextMenu(null);
    if (item.type !== 'dir') return;
    setConfirmDialog({
      title: 'Remove directory contents from database?',
      message: `All indexed content under this directory will be removed. Files will stay on disk.\n\n${item.path}`,
      confirmLabel: 'Remove from database',
      onConfirm: async () => {
        try {
          await api.deleteAssetsByPathDbOnly(item.path);
          loadAssets();
        } catch (error) {
          console.error('Failed to remove directory contents from database:', error);
          window.alert('Failed to remove directory contents from database.');
        }
      },
    });
  };

  const handleQuickCopy = async (kind) => {
    setQuickTagMenu(null);
    const selectedAssets = assets.filter((asset) => selectedIds.has(asset._id));
    if (!selectedAssets.length) return;
    const lines = selectedAssets.map((asset) => {
      if (kind === 'path') return asset.path;
      if (kind === 'directory') return asset.path.substring(0, asset.path.lastIndexOf('/'));
      if (kind === 'tags') return (asset.tags || []).join(', ');
      if (kind === 'size') return formatSize(asset.size);
      return '';
    }).filter(Boolean);
    if (!lines.length) return;
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleShowInMediaBin = () => {
    const asset = assets.find((item) => item._id === quickTagMenu.assetId);
    setQuickTagMenu(null);
    setPanelTab('media');
    if (asset) setRevealPath(asset.path);
  };

  const handleSendToBin = () => {
    setQuickTagMenu(null);
    handleAddToTimeline([...selectedIds]);
  };

  const handleOpenInExplorer = async (assetId) => {
    setQuickTagMenu(null);
    try {
      await api.openInExplorer(assetId);
    } catch (error) {
      console.error('Failed to open in explorer:', error);
      window.alert('Failed to open the file location.');
    }
  };

  const handleDeleteAssets = async (disk = false) => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const label = count === 1 ? 'asset' : 'assets';
    const message = disk
      ? `Delete ${count} selected ${label} from the database and send the files to trash?`
      : `Delete ${count} selected ${label} from the database? (Files stay on disk)`;
    setQuickTagMenu(null);
    const assetIds = [...selectedIds];
    setConfirmDialog({
      title: disk ? `Delete ${count} ${label} from disk?` : `Remove ${count} ${label} from database?`,
      message: disk
        ? 'The database records will be removed and the files will be sent to trash.'
        : 'The database records will be removed. Files will stay on disk.',
      confirmLabel: disk ? 'Delete from disk' : 'Remove from database',
      onConfirm: async () => {
        try {
          await api.deleteAssets(assetIds, disk);
          setAssets((current) => current.filter((asset) => !assetIds.includes(asset._id)));
          setSelectedIds(new Set());
          setSelectionAnchor(null);
          loadAssets();
        } catch (error) {
          console.error('Failed to delete assets:', error);
          window.alert('Failed to delete assets.');
        }
      },
    });
  };

  const handleCloseViewer = () => {
    setSelectedIndex(null);
  };

  const handlePrevious = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };

  const handleNext = () => {
    if (selectedIndex !== null && selectedIndex < assets.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  const handleScanComplete = () => {
    loadAssets();
  };

  // Reset every active filter (tags, sizes, extension, folder, search, type).
  const handleClearAllFilters = useCallback(() => {
    setTagFilters(new Set());
    setSizeFilter('all');
    setFileSizeFilters(new Set());
    setExtensionFilter('all');
    setDirFilter('');
    setQuery('');
    setTypeFilter('');
  }, []);

  const handleCommand = async ({ command, args, raw }) => {
    if (command === 'workspace' || command === 'project') {
      const requestedName = args.join(' ').trim().toLowerCase();
      const project = projects.find((item) => item.name.toLowerCase() === requestedName);
      if (project) {
        handleSelectProject(project._id);
        setCommandPromptOpen(false);
      } else if (requestedName === 'all' || requestedName === 'all projects') {
        handleSelectProject('');
        setCommandPromptOpen(false);
      }
      return;
    }

    if (command === 'scan' && args.length > 0) {
      const path = args.join(' ');
      setCommandPromptOpen(false);
      triggerScan(path);
      return;
    }

    if (command === 'settings' || command === 'theme') {
      setCommandPromptOpen(false);
      setSettingsOpen(true);
      return;
    }

    if (command === 'clearfilters' || command === 'clear-filter' || (command === 'clear' && (args[0] || '').toLowerCase() === 'filter')) {
      setCommandPromptOpen(false);
      handleClearAllFilters();
      return;
    }

    if (command === 'refresh') {
      setCommandPromptOpen(false);
      setScanProgress({ status: 'running', total: 0, processed: 0, stats: {} });
      try {
        await api.refreshAll();
        pollScanStatus();
      } catch (error) {
        console.error('Refresh failed:', error);
        setScanProgress(null);
      }
      return;
    }

    if (command === 'clear') {
      setCommandPromptOpen(false);
      setConfirmDialog({
        title: 'Remove all indexed assets?',
        message: 'Every asset record will be removed from the database. Files on disk will stay untouched.',
        confirmLabel: 'Clear database',
        onConfirm: async () => {
          try {
            await api.clearAllAssets();
            setAssets([]);
            setSelectedIds(new Set());
            setSelectionAnchor(null);
            setTimeline([]);
          } catch (error) {
            console.error('Failed to clear assets:', error);
            window.alert('Failed to clear assets.');
          }
        },
      });
      return;
    }

    if (command === 'watch') {
      const sub = (args[0] || '').toLowerCase();
      setCommandPromptOpen(false);
      if (sub === 'add' && args.length >= 2) {
        handleAddWatch(args.slice(1).join(' '));
      } else if (sub === 'show') {
        setWatchPanelOpen(true);
      }
      return;
    }
  };

  const tagCounts = {};
  assets.forEach((asset) => (asset.tags || []).forEach((tag) => {
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }));
  const tags = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag));

  const untaggedCount = assets.filter((asset) => !(asset.tags || []).length).length;

  const normalizeExt = (ext) => (ext === 'jpeg' ? 'jpg' : ext);

  const extensionCounts = {};
  assets.forEach((asset) => {
    const ext = asset.filename.includes('.') ? normalizeExt(asset.filename.split('.').pop().toLowerCase()) : '';
    if (ext) extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
  });
  const extensions = Object.entries(extensionCounts)
    .map(([ext, count]) => ({ ext, count }))
    .sort((a, b) => a.ext.localeCompare(b.ext));

  const indexById = new Map(assets.map((asset, index) => [asset._id, index]));

  // Paths carried on a thumbnail drag: the whole selection, or this file alone.
  const dragPaths = selectedIds.size
    ? assets.filter((a) => selectedIds.has(a._id)).map((a) => a.path).filter(Boolean)
    : [];

  const mediaTree = useMemo(() => {
    const root = { dirs: {}, files: [], path: '' };

    const ensureDir = (node, dirPath) => {
      const isAbsolute = dirPath.startsWith('/');
      const segments = dirPath.split('/').filter(Boolean);
      let current = node;
      let built = '';
      for (const segment of segments) {
        built = built ? `${built}/${segment}` : segment;
        const fullPath = isAbsolute ? `/${built}` : built;
        current.dirs[segment] = current.dirs[segment] || { dirs: {}, files: [], path: fullPath };
        current = current.dirs[segment];
      }
      return current;
    };

    assets.forEach((asset) => {
      const slash = asset.path.lastIndexOf('/');
      const dirPath = slash >= 0 ? asset.path.slice(0, slash) : '';
      if (dirPath) {
        ensureDir(root, dirPath).files.push(asset);
      } else {
        root.files.push(asset);
      }
    });
    return root;
  }, [assets]);

  // Size scales both width and height; Width is an independent offset that is not overwritten by Size.
  const BASE_SIZE = 200;
  const effectiveThumbnailWidth = thumbnailWidth + (thumbnailSize - BASE_SIZE);
  const filteredAssets = assets.filter((asset) => {
    const matchesTags = tagFilters.size === 0
      ? true
      : [...tagFilters].some((tag) => {
          if (tag === UNTAGGED) return !(asset.tags || []).length;
          return (asset.tags || []).includes(tag);
        });

    let matchesSize = true;
    if (sizeFilter !== 'all' && asset.width) {
      if (sizeFilter === '4k') matchesSize = asset.width >= 3840;
      else if (sizeFilter === 'hd') matchesSize = asset.width >= 1920;
      else if (sizeFilter === 'sd') matchesSize = asset.width < 1920;
    }

    const mb = 1024 * 1024;
    let matchesFileSize = true;
    if (fileSizeFilters.size > 0 && asset.size) {
      matchesFileSize = [...fileSizeFilters].some((filter) => {
        if (filter === 'lt1') return asset.size < mb;
        if (filter === '1-10') return asset.size >= mb && asset.size < 10 * mb;
        if (filter === '10-100') return asset.size >= 10 * mb && asset.size < 100 * mb;
        if (filter === 'gt100') return asset.size >= 100 * mb;
        return false;
      });
    }

    const assetExt = asset.filename.includes('.') ? normalizeExt(asset.filename.split('.').pop().toLowerCase()) : '';
    const matchesExtension = extensionFilter === 'all' || assetExt === extensionFilter;

    const matchesDirectory = !dirFilter || asset.path === dirFilter || asset.path.startsWith(`${dirFilter}/`);

    return matchesTags && matchesSize && matchesFileSize && matchesExtension && matchesDirectory;
  });

  const toggleTagFilter = (tag) => {
    setTagFilters((current) => {
      const next = new Set(current);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const timelineAssets = timeline
    .map((id) => assets.find((asset) => asset._id === id))
    .filter(Boolean);
  const directPlaybackAssets = directPlaybackIds
    ? directPlaybackIds.map((id) => assets.find((asset) => asset._id === id)).filter(Boolean)
    : null;

  const handleAddToTimeline = (ids) => {
    const list = Array.isArray(ids) ? ids : [ids];
    setTimeline((current) => {
      const next = [...current];
      list.forEach((id) => {
        if (!next.includes(id)) next.push(id);
      });
      return next;
    });
  };

  const handlePlayInTimeline = () => {
    const assetId = quickTagMenu?.assetId;
    if (!assetId) return;
    const ids = selectedIds.has(assetId) ? [...selectedIds] : [assetId];
    setQuickTagMenu(null);
    setDirectPlaybackIds(ids);
    setPlayingIndex(0);
  };

  const handleReorderTimeline = (from, to) => {
    setTimeline((current) => {
      if (from === to) return current;
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const handleRemoveFromTimeline = (id) => {
    setTimeline((current) => current.filter((item) => item !== id));
    setPlayingIndex(null);
  };

  const handleClearTimeline = () => {
    setTimeline([]);
    setPlayingIndex(null);
  };

  const handleSelectTimelineItem = (id) => {
    const index = assets.findIndex((asset) => asset._id === id);
    if (index !== -1) setSelectedIndex(index);
  };

  const handleTrimTimelineItem = (id) => {
    setTrimAssetId(id);
  };

  const handleSaveTrim = (id, inTime, outTime) => {
    setTrims((current) => ({ ...current, [id]: { in: inTime, out: outTime } }));
    setTrimAssetId(null);
  };

  const handleAnnotationSaved = (assetId, scope, frame) => {
    setAnnotationMarkers((current) => ({
      ...current,
      [assetId]: {
        ...(current[assetId] || {}),
        whole: scope === 'clip' || current[assetId]?.whole === true,
        frames: scope === 'frame'
          ? [...new Set([...(current[assetId]?.frames || []), frame])]
          : current[assetId]?.frames || [],
      },
    }));
  };

  const trimAsset = trimAssetId ? assets.find((asset) => asset._id === trimAssetId) : null;

  const selectedAsset = selectedIndex !== null ? assets[selectedIndex] : null;

  const handleSelectProject = (projectId) => {
    setSelectedProjectId(projectId);
    setSelectedIds(new Set());
    setSelectedIndex(null);
  };

  const handleCreateProject = async (name) => {
    const project = await api.createProject(name);
    setProjects((current) => [...current, project]);
    handleSelectProject(project._id);
  };

  const handleAddSelectedToProject = async () => {
    if (!selectedProjectId || selectedIds.size === 0) return;
    await api.addAssetsToProject(selectedProjectId, [...selectedIds]);
    const refreshedProjects = await api.fetchProjects();
    setProjects(refreshedProjects);
    setSelectedIds(new Set());
    await loadAssets();
  };

  return (
    <div
      className="h-screen flex flex-col bg-gray-950"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
          <div>
            <h1 className="text-3xl font-bold text-white">
              <span className="text-purple-500">max</span>v
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Media Asset Explorer Viewer
            </p>
          </div>
          {!dirFilter && (
            <div className="col-start-2 w-[clamp(220px,35vw,1000px)] min-w-0">
              <SearchBar compact onSearch={setQuery} onTypeFilter={setTypeFilter} assets={assets} />
            </div>
          )}
          <div className="col-start-3 flex justify-end gap-2">
            <ProjectPicker
              projects={projects}
              totalAssetCount={totalAssetCount}
              selectedProjectId={selectedProjectId}
              selectedAssetCount={selectedIds.size}
              onSelect={handleSelectProject}
              onCreate={handleCreateProject}
              onAddSelected={handleAddSelectedToProject}
            />
            <button
              onClick={() => setCommandPromptOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 text-sm transition-colors"
            >
              <span className="font-mono text-purple-400">❯</span>
              <span>Command</span>
              <kbd className="px-2 py-0.5 bg-gray-900 border border-gray-600 rounded text-xs">
                Ctrl+P
              </kbd>
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              title="Settings"
              className="flex items-center justify-center px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 text-sm transition-colors"
            >
              <span aria-hidden="true">⚙</span>
              <span className="sr-only">Settings</span>
            </button>
          </div>
        </div>
      </header>

      <ScanProgress progress={scanProgress} />

      <div className="flex flex-1 overflow-hidden">
        <FilterPanel
          tags={tags}
          activeTags={tagFilters}
          onToggleTag={toggleTagFilter}
          groupBy={groupBy}
          onGroupBy={setGroupBy}
          onClearFilters={() => setTagFilters(new Set())}
          onClearAllFilters={handleClearAllFilters}
          collapsed={panelCollapsed}
          onToggleCollapse={() => setPanelCollapsed((value) => !value)}
          sizeFilter={sizeFilter}
          onSizeFilter={setSizeFilter}
          fileSizeFilters={fileSizeFilters}
          onFileSizeFilter={(value) => {
            if (value === 'all') {
              setFileSizeFilters(new Set());
              return;
            }
            setFileSizeFilters((current) => {
              const next = new Set(current);
              if (next.has(value)) next.delete(value);
              else next.add(value);
              return next;
            });
          }}
          untaggedCount={untaggedCount}
          extensions={extensions}
          extensionFilter={extensionFilter}
          onExtensionFilter={setExtensionFilter}
          thumbnailSize={thumbnailSize}
          onThumbnailSize={setThumbnailSize}
          thumbnailWidth={thumbnailWidth}
          onThumbnailWidth={setThumbnailWidth}
          mediaTree={mediaTree}
          onItemContextMenu={handleMediaItemContextMenu}
          onFilterFolder={toggleDirFilter}
          expandSelection={mediaExpandSelection}
          tab={panelTab}
          onTabChange={setPanelTab}
          revealPath={revealPath}
          onSelectionChange={handleMediaSelectionChange}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <AssetGrid
            assets={filteredAssets}
            onOpen={handleAssetOpen}
            onContextMenu={handleAssetContextMenu}
            onSelect={handleSelect}
            selectedIds={selectedIds}
            query={query}
            loading={loading}
            onScanComplete={handleScanComplete}
            projectId={selectedProjectId}
            thumbnailSize={thumbnailSize}
            thumbnailWidth={effectiveThumbnailWidth}
            groupBy={groupBy}
            indexById={indexById}
            onHoverChange={handleHoverChange}
            dragPaths={dragPaths}
          />
        </div>
      </div>

      <TimelinePanel
        items={timelineAssets}
        onAdd={handleAddToTimeline}
        onReorder={handleReorderTimeline}
        onRemove={handleRemoveFromTimeline}
        onClear={handleClearTimeline}
        onPlay={() => setPlayingIndex(0)}
        onStop={() => setPlayingIndex(null)}
        isPlaying={playingIndex !== null}
        onSelectItem={handleSelectTimelineItem}
        onTrim={handleTrimTimelineItem}
        annotationMarkers={annotationMarkers}
        trims={trims}
        collapsed={timelineCollapsed}
        onToggle={() => setTimelineCollapsed((value) => !value)}
      />

      <footer className="flex items-center gap-6 border-t border-gray-800 bg-gray-900/60 px-6 py-2 text-xs text-gray-400">
        <span>{filteredAssets.length} shown</span>
        <span className={selectedIds.size > 0 ? 'font-medium text-purple-300' : ''}>
          {selectedIds.size} selected
        </span>
      </footer>

      {playingIndex !== null && (directPlaybackAssets || timelineAssets).length > 0 && (
        <TimelinePlayer
          assets={directPlaybackAssets || timelineAssets}
          startIndex={playingIndex}
          trims={trims}
          onEnd={() => { setPlayingIndex(null); setDirectPlaybackIds(null); }}
          onExit={() => { setPlayingIndex(null); setDirectPlaybackIds(null); }}
          onNavigate={setPlayingIndex}
          onAnnotationSaved={handleAnnotationSaved}
        />
      )}

      {trimAsset && (
        <TimelineTrimViewer
          asset={trimAsset}
          initialIn={trims[trimAsset._id]?.in ?? 0}
          initialOut={trims[trimAsset._id]?.out ?? null}
          onSave={(inTime, outTime) => handleSaveTrim(trimAsset._id, inTime, outTime)}
          onClose={() => setTrimAssetId(null)}
        />
      )}

      {selectedAsset && (
        <AssetViewer
          asset={selectedAsset}
          onClose={handleCloseViewer}
          onPrevious={handlePrevious}
          onNext={handleNext}
        />
      )}

      {tagPopupOpen && (
        <TagPopup
          assetCount={selectedIds.size}
          onClose={() => setTagPopupOpen(false)}
          onSave={handleAddTags}
        />
      )}

      {mediaContextMenu && (
        <MediaContextMenu
          position={mediaContextMenu}
          item={mediaContextMenu.item}
          selectedItems={mediaSelection}
          onClose={() => setMediaContextMenu(null)}
          onOpen={handleMediaOpen}
          onDelete={handleMediaDelete}
          onDeleteDbOnly={handleMediaDeleteDbOnly}
          onCopy={handleMediaCopy}
          onFilterFolder={handleFilterFolder}
          onAppendTags={(tags, items) => handleMediaTags(tags, items, 'append')}
          onRemoveTags={(tags, items) => handleMediaTags(tags, items, 'remove')}
          onRename={(items) => openRenameDialog(items, () => setMediaContextMenu(null))}
          onExpand={handleExpandMediaSelection}
        />
      )}

      {quickTagMenu && (
        <QuickTagMenu
          position={quickTagMenu}
          selectedItemTags={assets.find((asset) => asset._id === quickTagMenu.assetId)?.tags || []}
          selectedCount={selectedIds.size}
          onClose={() => setQuickTagMenu(null)}
          onAppend={(tags) => {
            setQuickTagMenu(null);
            handleAddTags(tags);
          }}
          onRemove={(tags) => {
            setQuickTagMenu(null);
            handleRemoveTags(tags);
          }}
          onNew={() => {
            setQuickTagMenu(null);
            setTagPopupOpen(true);
          }}
          onClearAll={() => {
            setQuickTagMenu(null);
            handleClearTags();
          }}
          onDelete={(disk) => handleDeleteAssets(disk)}
          onOpenInExplorer={() => handleOpenInExplorer(quickTagMenu.assetId)}
          onCopy={handleQuickCopy}
          onShowInMediaBin={handleShowInMediaBin}
          onSendToBin={handleSendToBin}
          onPlayInTimeline={handlePlayInTimeline}
          onPlate={handlePlateSelected}
          onRename={() => openRenameDialog(
            assets.filter((asset) => selectedIds.has(asset._id)).map((asset) => ({
              type: 'file',
              path: asset.path,
              filename: asset.filename,
              assetId: asset._id,
              is_sequence: asset.is_sequence,
            })),
            () => setQuickTagMenu(null),
          )}
        />
      )}

      {renameItems?.length > 0 && (
        <RenameDialog
          items={renameItems}
          onClose={() => setRenameItems(null)}
          onRename={handleRenameItems}
        />
      )}

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        accent={accent}
        onAccentChange={setAccent}
      />

      <CommandPrompt
        isOpen={commandPromptOpen}
        onClose={() => setCommandPromptOpen(false)}
        onCommand={handleCommand}
        defaultPath={lastScanPath}
        projects={projects}
      />

      <WatchPanel
        watches={watches}
        onAddWatch={handleAddWatch}
        onUpdateWatch={handleUpdateWatch}
        onRemoveWatch={handleRemoveWatch}
        onScanWatch={handleScanWatch}
        isOpen={watchPanelOpen}
        onClose={() => setWatchPanelOpen(false)}
      />


      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={() => {
            const action = confirmDialog.onConfirm;
            setConfirmDialog(null);
            action();
          }}
        />
      )}

      <MetadataModal asset={metadataAsset} onClose={() => setMetadataAsset(null)} />
    </div>
  );
}

export default App;
