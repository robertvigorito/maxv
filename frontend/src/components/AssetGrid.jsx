import AssetBubble from './AssetBubble';
import FolderPicker from './FolderPicker';
import { useEffect, useState } from 'react';

function GroupIcon({ type }) {
  const path = type === 'tag'
    ? 'M20 13l-7 7-9-9V4h7l9 9zM7.5 7.5h.01'
    : 'M4 5h16v14H4zM8 5v14M16 5v14';
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0 text-purple-400">
      <path d={path} />
    </svg>
  );
}

export default function AssetGrid({ assets, onSelect, onOpen, onContextMenu, selectedIds, query, loading, onScanComplete, projectId, thumbnailSize = 200, thumbnailWidth = 200, groupBy = 'none', indexById = new Map(), onHoverChange, dragPaths = [] }) {
  const [collapsedGroups, setCollapsedGroups] = useState(() => new Set());
  const [groupOrder, setGroupOrder] = useState([]);
  const [draggedGroup, setDraggedGroup] = useState(null);
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key.toLowerCase() !== 'c' || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable) return;
      if (groupBy !== 'tag' && groupBy !== 'type') return;

      const labels = groupBy === 'tag'
        ? [...new Set(assets.flatMap((asset) => asset.tags || []))]
        : ['Images', 'Videos'].filter((label) => assets.some((asset) => asset.type === label.slice(0, -1).toLowerCase()));
      if (assets.some((asset) => !(asset.tags || []).length) && groupBy === 'tag') labels.push('Untagged');
      if (!labels.length) return;

      event.preventDefault();
      setCollapsedGroups((current) => {
        const allCollapsed = labels.every((label) => current.has(label));
        return allCollapsed ? new Set() : new Set(labels);
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [assets, groupBy]);
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400 text-xl">Loading...</div>
      </div>
    );
  }

  if (assets.length === 0) {
    return <FolderPicker onScanComplete={onScanComplete} projectId={projectId} />;
  }

  const renderBubble = (asset) => {
    const index = indexById.get(asset._id) ?? 0;
    return (
      <AssetBubble
        key={asset._id}
        asset={asset}
        onClick={(event) => onSelect(asset._id, index, event.shiftKey, event.altKey)}
        onOpen={() => onOpen(index)}
        onContextMenu={onContextMenu}
        selected={selectedIds.has(asset._id)}
        query={query}
        size={thumbnailSize}
        dragIds={selectedIds.has(asset._id) ? [...selectedIds] : [asset._id]}
        dragPaths={selectedIds.has(asset._id) ? dragPaths : (asset.path ? [asset.path] : [])}
        onHoverChange={onHoverChange}
      />
    );
  };

  const grid = (items) => (
    <div
      className="grid gap-6 transition-[grid-template-columns] duration-150"
      style={{ gridTemplateColumns: `repeat(auto-fill, ${thumbnailWidth}px)` }}
    >
      {items.map(renderBubble)}
    </div>
  );

  let groups = null;

  if (groupBy === 'tag') {
    const uniqueTags = [...new Set(assets.flatMap((asset) => asset.tags || []))].sort((a, b) => a.localeCompare(b));
    groups = uniqueTags.map((tag) => ({
      label: tag,
      items: assets.filter((asset) => (asset.tags || []).includes(tag)),
    }));
    const untagged = assets.filter((asset) => !(asset.tags || []).length);
    if (untagged.length) groups.push({ label: 'Untagged', items: untagged });
  }

  if (groupBy === 'type') {
    groups = ['image', 'video'].map((type) => {
      const items = assets.filter((asset) => asset.type === type);
      return { label: type === 'image' ? 'Images' : 'Videos', items };
    }).filter((group) => group.items.length > 0);
  }

  const orderedGroups = groups ? [...groups].sort((a, b) => {
    const aIndex = groupOrder.indexOf(a.label);
    const bIndex = groupOrder.indexOf(b.label);
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  }) : [];

  const renderGroups = () => (
    <div className="flex-1 space-y-8 overflow-y-auto p-6">
      {orderedGroups.map((group) => {
        const collapsed = collapsedGroups.has(group.label);
        return (
          <section
            key={group.label}
            draggable
            onDragStart={() => setDraggedGroup(group.label)}
            onDragEnd={() => setDraggedGroup(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (!draggedGroup || draggedGroup === group.label) return;
              setGroupOrder((current) => {
                const base = current.length ? current : orderedGroups.map((entry) => entry.label);
                const next = base.filter((label) => label !== draggedGroup);
                const targetIndex = next.indexOf(group.label);
                next.splice(targetIndex, 0, draggedGroup);
                return next;
              });
              setDraggedGroup(null);
            }}
            className={draggedGroup === group.label ? 'opacity-50' : ''}
          >
            <button
              type="button"
              onClick={() => setCollapsedGroups((current) => {
                const next = new Set(current);
                if (next.has(group.label)) next.delete(group.label);
                else next.add(group.label);
                return next;
              })}
              className="mb-3 flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm font-semibold text-gray-300 hover:bg-gray-800/70"
              title="Collapse group"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform ${collapsed ? '-rotate-90' : 'rotate-0'}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4" />
              </svg>
              {group.label === 'Untagged' ? (
                <span>{group.label}</span>
              ) : (
                <><GroupIcon type={groupBy === 'tag' ? 'tag' : 'type'} />{group.label}</>
              )}
              <span className="text-xs font-normal text-gray-500">({group.items.length})</span>
              <span className="ml-auto cursor-grab text-xs font-normal text-gray-600">⠿</span>
            </button>
            {!collapsed && grid(group.items)}
          </section>
        );
      })}
    </div>
  );

  return groups ? renderGroups() : <div className="flex-1 p-6 overflow-y-auto">{grid(assets)}</div>;
}
