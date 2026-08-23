import { useEffect, useState } from 'react';
import { api } from '../api/client';

export default function QuickTagMenu({ position, onClose, onAppend, onRemove, onNew, onClearAll }) {
  const [tags, setTags] = useState([]);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [openAction, setOpenAction] = useState(null);
  const [selected, setSelected] = useState({ append: new Set(), remove: new Set() });

  const toggleTag = (action, tag) => {
    setSelected((current) => {
      const next = new Set(current[action]);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return { ...current, [action]: next };
    });
  };

  const apply = (action) => {
    const chosen = [...selected[action]];
    if (chosen.length === 0) return;
    if (action === 'append') onAppend(chosen);
    else onRemove(chosen);
  };

  useEffect(() => {
    api.fetchTags()
      .then((data) => setTags(data.tags || []))
      .catch(() => setTags([]));

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    const handlePointerDown = () => onClose();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed z-40 min-w-44 overflow-visible rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-2xl"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
      role="menu"
      aria-label="Quick tag actions"
      onMouseEnter={() => setTagsOpen(true)}
    >
      <div className="relative">
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800 hover:text-white"
        >
          <span>Tags</span>
          <span className="ml-6 text-gray-500">›</span>
        </button>
        {tagsOpen && (
          <div className="absolute left-full top-0 ml-1 min-w-36 overflow-visible rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-2xl" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={onNew}
              className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800 hover:text-white"
            >
              <span>New</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={onClearAll}
              className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800 hover:text-white"
            >
              <span>Clear All</span>
            </button>
            <div className="mt-1 border-t border-gray-700/70" />
            {['append', 'remove'].map((action, index) => (
              <div
                key={action}
                className={`relative ${index === 1 ? 'mt-1 border-t border-gray-700/70' : ''}`}
                onMouseEnter={() => setOpenAction(action)}
              >
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800 hover:text-white"
                >
                  <span>{action === 'append' ? 'Append' : 'Remove'}</span>
                  <span className="ml-6 text-gray-500">›</span>
                </button>
                {openAction === action && (
                  <div className="absolute left-full top-0 ml-1 min-w-44 overflow-hidden rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-2xl" role="menu">
                    {tags.length === 0 ? (
                      <div className="px-4 py-2 text-sm text-gray-500">No saved tags</div>
                    ) : (
                      <>
                        <div className="max-h-52 overflow-y-auto">
                          {tags.map((tag) => (
                            <label
                              key={`${action}-${tag}`}
                              className="flex items-center gap-2 px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800"
                            >
                              <input
                                type="checkbox"
                                checked={selected[action].has(tag)}
                                onChange={() => toggleTag(action, tag)}
                                className="accent-purple-500"
                              />
                              <span className="truncate">{tag}</span>
                            </label>
                          ))}
                        </div>
                        <div className="mt-1 border-t border-gray-700/70 px-4 py-2">
                          <button
                            type="button"
                            onClick={() => apply(action)}
                            disabled={selected[action].size === 0}
                            className="w-full rounded bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Apply ({selected[action].size})
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
