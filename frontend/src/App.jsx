import { useState, useEffect, useCallback } from 'react';
import SearchBar from './components/SearchBar';
import AssetGrid from './components/AssetGrid';
import AssetViewer from './components/AssetViewer';
import CommandPrompt from './components/CommandPrompt';
import TagPopup from './components/TagPopup';
import QuickTagMenu from './components/QuickTagMenu';
import { api } from './api/client';
import { useLocalStorage } from './hooks/useLocalStorage';

function App() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [commandPromptOpen, setCommandPromptOpen] = useState(false);
  const [thumbnailSize, setThumbnailSize] = useLocalStorage('maxv-thumbnail-size', 200);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectionAnchor, setSelectionAnchor] = useState(null);
  const [tagPopupOpen, setTagPopupOpen] = useState(false);
  const [quickTagMenu, setQuickTagMenu] = useState(null);

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

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K or Cmd+K to open command prompt
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPromptOpen(true);
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

  const handleSelect = (assetId, index, shiftKey) => {
    setSelectedIds((current) => {
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
    if (!selectedIds.has(assetId)) return;
    event.preventDefault();
    setQuickTagMenu({ x: event.clientX, y: event.clientY });
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
      try {
        await api.triggerScan(path);
        setTimeout(() => loadAssets(), 2000);
        setCommandPromptOpen(false);
      } catch (error) {
        console.error('Scan failed:', error);
      }
    }
  };

  const selectedAsset = selectedIndex !== null ? assets[selectedIndex] : null;

  return (
    <div className="h-screen flex flex-col bg-gray-950">
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
            <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg">
              <label className="text-gray-400 text-sm whitespace-nowrap">
                Thumbnail Size
              </label>
              <input
                type="range"
                min="120"
                max="400"
                step="20"
                value={thumbnailSize}
                onChange={(e) => setThumbnailSize(Number(e.target.value))}
                className="w-32 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <span className="text-gray-300 text-sm font-mono w-10 text-right">
                {thumbnailSize}
              </span>
            </div>
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

      <SearchBar onSearch={setQuery} onTypeFilter={setTypeFilter} assets={assets} />

      <AssetGrid
        assets={assets}
        onOpen={handleAssetOpen}
        onContextMenu={handleAssetContextMenu}
        onSelect={handleSelect}
        selectedIds={selectedIds}
        query={query}
        loading={loading}
        onScanComplete={handleScanComplete}
        thumbnailSize={thumbnailSize}
      />

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
