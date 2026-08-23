import AssetBubble from './AssetBubble';
import FolderPicker from './FolderPicker';

export default function AssetGrid({ assets, onSelect, onOpen, onContextMenu, selectedIds, query, loading, onScanComplete, thumbnailSize = 200, groupBy = 'none', indexById = new Map() }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400 text-xl">Loading...</div>
      </div>
    );
  }

  if (assets.length === 0) {
    return <FolderPicker onScanComplete={onScanComplete} />;
  }

  const renderBubble = (asset) => {
    const index = indexById.get(asset._id) ?? 0;
    return (
      <AssetBubble
        key={asset._id}
        asset={asset}
        onClick={(event) => onSelect(asset._id, index, event.shiftKey)}
        onOpen={() => onOpen(index)}
        onContextMenu={onContextMenu}
        selected={selectedIds.has(asset._id)}
        query={query}
        size={thumbnailSize}
      />
    );
  };

  const grid = (items) => (
    <div
      className="grid gap-6"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))` }}
    >
      {items.map(renderBubble)}
    </div>
  );

  const renderGroups = (groups) => (
    <div className="flex-1 space-y-8 p-6 overflow-y-auto">
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-300">
            {group.label === 'Untagged' ? (
              <span>{group.label}</span>
            ) : (
              <><span className="text-purple-400">#</span>{group.label}</>
            )}
            <span className="text-xs text-gray-500">({group.items.length})</span>
          </h2>
          {grid(group.items)}
        </section>
      ))}
    </div>
  );

  if (groupBy === 'tag') {
    const uniqueTags = [...new Set(assets.flatMap((asset) => asset.tags || []))].sort((a, b) => a.localeCompare(b));
    const groups = uniqueTags.map((tag) => ({
      label: tag,
      items: assets.filter((asset) => (asset.tags || []).includes(tag)),
    }));
    const untagged = assets.filter((asset) => !(asset.tags || []).length);
    if (untagged.length) groups.push({ label: 'Untagged', items: untagged });
    return renderGroups(groups);
  }

  if (groupBy === 'type') {
    const groups = ['image', 'video'].map((type) => {
      const items = assets.filter((asset) => asset.type === type);
      return { label: type === 'image' ? 'Images' : 'Videos', items };
    }).filter((group) => group.items.length > 0);
    return renderGroups(groups);
  }

  return <div className="flex-1 p-6 overflow-y-auto">{grid(assets)}</div>;
}
