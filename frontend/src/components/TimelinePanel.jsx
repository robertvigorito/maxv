import { api } from '../api/client';

export default function TimelinePanel({ items, onAdd, onReorder, onRemove, onClear, onPlay, onStop, isPlaying, onSelectItem, onTrim, collapsed = false, onToggle }) {
  const handleDragOver = (e) => e.preventDefault();

  const handleItemDragStart = (e, index) => {
    e.dataTransfer.setData('application/x-maxv-reorder', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, toIndex) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/x-maxv-asset');
    if (raw) {
      try {
        const { ids } = JSON.parse(raw);
        if (Array.isArray(ids)) onAdd(ids);
        else onAdd([raw]);
      } catch {
        onAdd([raw]);
      }
      return;
    }
    const from = Number(e.dataTransfer.getData('application/x-maxv-reorder'));
    if (!Number.isNaN(from)) onReorder(from, toIndex);
  };

  return (
    <div className={`border-t border-gray-800 bg-gray-900/60 px-4 ${collapsed ? 'py-1' : 'py-2'}`}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggle}
          title={collapsed ? 'Expand timeline' : 'Collapse timeline'}
          className="text-gray-400 hover:text-gray-200"
        >
          {collapsed ? '▸' : '▾'}
        </button>
        <h2 className="text-sm font-semibold text-gray-200">Timeline</h2>
        {items.length > 0 && (
          <button
            type="button"
            onClick={isPlaying ? onStop : onPlay}
            className="rounded bg-purple-600 px-2 py-1 text-xs font-medium text-white hover:bg-purple-500"
          >
            {isPlaying ? 'Stop' : 'Play all'}
          </button>
        )}
        <span className="text-xs text-gray-500">{items.length} items</span>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-gray-400 hover:text-gray-200"
          >
            Clear
          </button>
        )}
      </div>

      {!collapsed && (
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {items.map((item, index) => (
          <div
            key={item._id}
            draggable
            onDragStart={(e) => handleItemDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            onContextMenu={(e) => {
              e.preventDefault();
              onRemove(item._id);
            }}
            className="group relative shrink-0"
          >
            <img
              src={api.getThumbnailUrl(item._id)}
              alt={item.filename}
              className="h-16 w-24 cursor-grab rounded border border-gray-700 object-cover group-hover:border-purple-500"
            />
            <span className="absolute bottom-0 left-0 right-0 truncate bg-black/70 px-1 text-[9px] text-gray-300">
              {index + 1}. {item.filename}
            </span>
            <button
              type="button"
              onClick={() => onRemove(item._id)}
              title="Remove from timeline"
              className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded bg-red-600 text-[10px] text-white hover:bg-red-500"
            >
              ×
            </button>
            <button
              type="button"
              onClick={() => onSelectItem(item._id)}
              title="Open"
              className="absolute left-0.5 top-0.5 hidden h-4 w-4 items-center justify-center rounded bg-black/70 text-[10px] text-white group-hover:flex"
            >
              ▷
            </button>
            <button
              type="button"
              onClick={() => onTrim(item._id)}
              title="Trim in/out"
              className="absolute bottom-0.5 right-0.5 hidden h-4 w-4 items-center justify-center rounded bg-purple-700 text-[9px] text-white group-hover:flex"
            >
              ✂
            </button>
          </div>
        ))}

        <div
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, items.length)}
          className="flex h-16 w-24 shrink-0 items-center justify-center rounded border-2 border-dashed border-gray-700 text-center text-[10px] text-gray-500"
        >
          Drop media
        </div>
      </div>
      )}
    </div>
  );
}
