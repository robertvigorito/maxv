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
import TimelineTrimViewer from './components/TimelineTrimViewer';
import { api } from './api/client';
import { useLocalStorage } from './hooks/useLocalStorage';

function App() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [commandPromptOpen, setCommandPromptOpen] = useState(false);
  const [scanProgress, setScanProgress] = useState(null);
  const scanTimerRef = useRef(null);
  const [mediaContextMenu, setMediaContextMenu] = useState(null);
  const [timeline, setTimeline] = useLocalStorage('maxv-timeline', []);
  const [playingIndex, setPlayingIndex] = useState(null);
  const [trims, setTrims] = useLocalStorage('maxv-trims', {});
  const [trimAssetId, setTrimAssetId] = useState(null);
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [thumbnailSize, setThumbnailSize] = useLocalStorage('maxv-thumbnail-size', 200);
  const [thumbnailWidth, setThumbnailWidth] = useLocalStorage('maxv-thumbnail-width', 200);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectionAnchor, setSelectionAnchor] = useState(null);
  const [tagPopupOpen, setTagPopupOpen] = useState(false);
  const [quickTagMenu, setQuickTagMenu] = useState(null);
  const [tagFilters, setTagFilters] = useState(new Set());
  const [groupBy, setGroupBy] = useState('none');
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [panelTab, setPanelTab] = useState('filters');
  const [revealPath, setRevealPath] = useState(null);
  const [sizeFilter, setSizeFilter] = useState('all');
  const [fileSizeFilters, setFileSizeFilters] = useState(new Set());
  const [extensionFilter, setExtensionFilter] = useState('all');

  const loadAssets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.fetchAssets(query, typeFilter);
      setAssets(data.items);
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      setLoading(false);
    }
  }, [query, typeFilter]);

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
        if (data.status === 'running') {
          scanTimerRef.current = setTimeout(pollScanStatus, 600);
        } else {
          scanTimerRef.current = null;
          loadAssets();
        }
      })
      .catch(() => {
        scanTimerRef.current = null;
        setScanProgress(null);
      });
  }, [loadAssets]);

  const triggerScan = (path) => {
    setScanProgress({ status: 'running', total: 0, processed: 0, stats: {} });
    api.triggerScan(path)
      .then(() => pollScanStatus())
      .catch(() => {
        setScanProgress(null);
        window.alert('Failed to start scan.');
      });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    const first = files[0];
    const folderPath = first.path
      || (first.webkitRelativePath ? first.webkitRelativePath.split('/')[0] : '')
      || first.name;
    if (folderPath) triggerScan(folderPath);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K or Cmd+K to open command prompt
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
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

      if (e.key === 'Escape' || e.code === 'Escape') {
        setSelectedIds(new Set());
        setSelectionAnchor(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

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

  const handleMediaCopy = async (kind, item) => {
    setMediaContextMenu(null);
    let text = '';
    if (kind === 'path') text = item.path;
    else if (kind === 'directory') {
      text = item.type === 'dir' ? item.path : item.path.substring(0, item.path.lastIndexOf('/'));
    } else if (kind === 'tags') text = (item.tags || []).join(', ');
    else if (kind === 'size') text = formatSize(item.size);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleMediaDelete = async (item) => {
    setMediaContextMenu(null);
    const label = item.type === 'dir' ? 'directory' : 'file';
    if (!window.confirm(`Delete this ${label} and send it to trash?\n\n${item.path}`)) return;
    try {
      await api.deleteAssetsByPath(item.path);
      loadAssets();
    } catch (error) {
      console.error('Failed to delete:', error);
      window.alert('Failed to delete.');
    }
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
    if (!window.confirm(message)) return;
    setQuickTagMenu(null);
    try {
      await api.deleteAssets([...selectedIds], disk);
      setAssets((current) => current.filter((asset) => !selectedIds.has(asset._id)));
      setSelectedIds(new Set());
      setSelectionAnchor(null);

      // Offer to refresh the library from the database.
      if (window.confirm(`${count} ${label} deleted. Refresh the library?`)) {
        loadAssets();
      }
    } catch (error) {
      console.error('Failed to delete assets:', error);
      window.alert('Failed to delete assets.');
    }
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

  const handleCommand = async ({ command, args, raw }) => {
    if (['scan', 'add', 'index'].includes(command) && args.length > 0) {
      const path = args.join(' ');
      setCommandPromptOpen(false);
      triggerScan(path);
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

    return matchesTags && matchesSize && matchesFileSize && matchesExtension;
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

  const trimAsset = trimAssetId ? assets.find((asset) => asset._id === trimAssetId) : null;

  const selectedAsset = selectedIndex !== null ? assets[selectedIndex] : null;

  return (
    <div
      className="h-screen flex flex-col bg-gray-950"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">
              <span className="text-purple-500">max</span>v
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Media Asset Explorer Viewer
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCommandPromptOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-300 text-sm transition-colors"
            >
              <span className="font-mono text-purple-400">❯</span>
              <span>Command</span>
              <kbd className="px-2 py-0.5 bg-gray-900 border border-gray-600 rounded text-xs">
                Ctrl+K
              </kbd>
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
          onClearAllFilters={() => {
            setTagFilters(new Set());
            setSizeFilter('all');
            setFileSizeFilters(new Set());
            setExtensionFilter('all');
          }}
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
          tab={panelTab}
          onTabChange={setPanelTab}
          revealPath={revealPath}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <SearchBar onSearch={setQuery} onTypeFilter={setTypeFilter} assets={assets} />

          <AssetGrid
            assets={filteredAssets}
            onOpen={handleAssetOpen}
            onContextMenu={handleAssetContextMenu}
            onSelect={handleSelect}
            selectedIds={selectedIds}
            query={query}
            loading={loading}
            onScanComplete={handleScanComplete}
            thumbnailSize={thumbnailSize}
            thumbnailWidth={effectiveThumbnailWidth}
            groupBy={groupBy}
            indexById={indexById}
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
        collapsed={timelineCollapsed}
        onToggle={() => setTimelineCollapsed((value) => !value)}
      />

      <footer className="flex items-center gap-6 border-t border-gray-800 bg-gray-900/60 px-6 py-2 text-xs text-gray-400">
        <span>{filteredAssets.length} shown</span>
        <span className={selectedIds.size > 0 ? 'font-medium text-purple-300' : ''}>
          {selectedIds.size} selected
        </span>
      </footer>

      {playingIndex !== null && timelineAssets.length > 0 && (
        <TimelinePlayer
          assets={timelineAssets}
          startIndex={playingIndex}
          trims={trims}
          onEnd={() => setPlayingIndex(null)}
          onExit={() => setPlayingIndex(null)}
          onNavigate={setPlayingIndex}
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
          onClose={() => setMediaContextMenu(null)}
          onOpen={handleMediaOpen}
          onDelete={handleMediaDelete}
          onCopy={handleMediaCopy}
        />
      )}

      {quickTagMenu && (
        <QuickTagMenu
          position={quickTagMenu}
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
        />
      )}

      <CommandPrompt
        isOpen={commandPromptOpen}
        onClose={() => setCommandPromptOpen(false)}
        onCommand={handleCommand}
      />
    </div>
  );
}

export default App;
