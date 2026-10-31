import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../api/client';

function ActionIcon({ type }) {
  const paths = {
    open: 'M4 5.5A1.5 1.5 0 0 1 5.5 4h5l2 2H18.5A1.5 1.5 0 0 1 20 7.5v9A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5v-11z',
    filter: 'M4 5h16l-6 7v5l-4 2v-7L4 5z',
    copy: 'M8 8V5.5A1.5 1.5 0 0 1 9.5 4h9A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H16M5.5 8h9A1.5 1.5 0 0 1 16 9.5v9A1.5 1.5 0 0 1 14.5 20h-9A1.5 1.5 0 0 1 4 18.5v-9A1.5 1.5 0 0 1 5.5 8z',
    tag: 'M20 13l-7 7-9-9V4h7l9 9zM7.5 7.5h.01',
    trash: 'M5 7h14m-9 4v5m4-5v5M9 7V5h6v2m-9 0 1 13h10l1-13',
    cloud: 'M7 18h10a4 4 0 0 0 .7-7.94A5.5 5.5 0 0 0 7.2 8.5 4.75 4.75 0 0 0 7 18z',
    expand: 'M7 10l5 5 5-5M7 5l5 5 5-5',
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
      <path d={paths[type]} />
    </svg>
  );
}

export default function MediaContextMenu({ position, item, selectedItems = [], onClose, onOpen, onDelete, onDeleteDbOnly, onCopy, onFilterFolder, onAppendTags, onRemoveTags, onRename, onExpand }) {
  const [copyOpen, setCopyOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [tagAction, setTagAction] = useState(null);
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState(new Set());
  const menuRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState(position);
  // When multiple media-bin items are selected (including the right-clicked
  // one), act on the whole selection for copy/filter.
  const multi = selectedItems.length > 1 && selectedItems.some((s) => s.type === item.type && s.path === item.path);
  const items = multi ? selectedItems : [item];
  const filterTarget = items.find((it) => it.type === 'dir') || items[0];
  const tagItems = items.filter((entry) => entry.type === 'file' && entry.assetId);
  const submenuLeft = position.x < window.innerWidth - 460;

  useLayoutEffect(() => {
    const menu = menuRef.current;
      {items.some((entry) => entry.type === 'dir') && (
        <button
          type="button"
          role="menuitem"
          onClick={() => onExpand(items)}
          className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-xs text-gray-200 hover:bg-gray-800 hover:text-white"
        >
          <ActionIcon type="expand" />
          Expand selected tree
        </button>
      )}
    if (!menu) return;
    const margin = 8;
    const rect = menu.getBoundingClientRect();
    setMenuPosition({
      x: Math.max(margin, Math.min(position.x, window.innerWidth - rect.width - margin)),
      y: Math.max(margin, Math.min(position.y, window.innerHeight - rect.height - margin)),
    });
  }, [position]);

  useEffect(() => {
    if (tagItems.length > 0) {
      api.fetchTags().then((data) => setTags(data.tags || [])).catch(() => setTags([]));
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    const handlePointerDown = () => onClose();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose, tagItems.length]);

  const chooseTag = (event, tag) => {
    if (event.altKey) {
      setSelectedTags((current) => {
        const next = new Set(current);
        if (next.has(tag)) next.delete(tag);
        else next.add(tag);
        return next;
      });
      return;
    }
    if (tagAction === 'append') onAppendTags([tag], tagItems);
    else onRemoveTags([tag], tagItems);
  };

  const applyTags = () => {
    const chosen = [...selectedTags];
    if (!chosen.length) return;
    if (tagAction === 'append') onAppendTags(chosen, tagItems);
    else onRemoveTags(chosen, tagItems);
  };

  const copyOptions = [
    { key: 'path', label: 'Path' },
    { key: 'directory', label: 'Directory' },
    ...(item.type === 'file'
      ? [
          { key: 'tags', label: 'Tags' },
          { key: 'size', label: 'Size' },
        ]
      : []),
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-40 min-w-52 overflow-visible rounded-md border border-gray-700/90 bg-gray-900/95 p-1 shadow-2xl shadow-black/40 backdrop-blur"
      style={{ left: menuPosition.x, top: menuPosition.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseLeave={onClose}
      role="menu"
      aria-label="Media item actions"
    >
      {items.length > 1 && (
        <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">{items.length} selected</div>
      )}
      <button
        type="button"
        role="menuitem"
        onClick={() => onOpen(item)}
        className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-xs text-gray-200 hover:bg-gray-800 hover:text-white"
      >
        <ActionIcon type="open" />
        Open in Explorer
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => onRename(items)}
        className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-xs text-gray-200 hover:bg-gray-800 hover:text-white"
      >
        <span className="w-3.5 text-center">✎</span>
        Rename {items.length > 1 ? `${items.length} selected` : item.type}
      </button>
      {tagItems.length > 0 && (
        <>
          <div className="my-1 border-t border-gray-800" />
          <div className="relative" onMouseEnter={() => setTagsOpen(true)} onMouseLeave={() => { setTagsOpen(false); setTagAction(null); setSelectedTags(new Set()); }}>
            <button
              type="button"
              role="menuitem"
              className="flex h-8 w-full items-center justify-between rounded px-2 text-left text-xs text-gray-200 hover:bg-gray-800 hover:text-white"
            >
              <span className="flex items-center gap-2"><ActionIcon type="tag" />Tags</span>
              <span className="text-gray-500">›</span>
            </button>
            {tagsOpen && (
              <div className={`absolute top-0 min-w-44 overflow-visible rounded-md border border-gray-700/90 bg-gray-900/95 p-1 shadow-2xl shadow-black/40 backdrop-blur ${submenuLeft ? 'left-full ml-1' : 'right-full mr-1'}`} role="menu">
                {['append', 'remove'].map((action) => (
                  <div key={action} className="relative" onMouseEnter={() => setTagAction(action)}>
                    <button type="button" role="menuitem" className="flex h-8 w-full items-center justify-between rounded px-2 text-left text-xs text-gray-200 hover:bg-gray-800 hover:text-white">
                      <span>{action === 'append' ? 'Append tags' : 'Remove tags'}</span>
                      <span className="text-gray-500">›</span>
                    </button>
                    {tagAction === action && (
                      <div className={`absolute top-0 min-w-44 overflow-hidden rounded-md border border-gray-700/90 bg-gray-900/95 p-1 shadow-2xl shadow-black/40 backdrop-blur ${submenuLeft ? 'left-full ml-1' : 'right-full mr-1'}`} role="menu">
                        {tags.length === 0 ? (
                          <div className="px-2 py-2 text-xs text-gray-500">No saved tags</div>
                        ) : (
                          <>
                            <div className="max-h-52 overflow-y-auto">
                              {tags.map((tag) => (
                                <button
                                  key={`${action}-${tag}`}
                                  type="button"
                                  role="menuitem"
                                  onClick={(event) => chooseTag(event, tag)}
                                  className={`block h-8 w-full truncate rounded px-2 text-left text-xs ${selectedTags.has(tag) ? 'bg-purple-500/25 text-purple-200' : 'text-gray-200 hover:bg-gray-800 hover:text-white'}`}
                                  title="Alt-click to select multiple tags"
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                            {selectedTags.size > 0 && (
                              <div className="mt-1 border-t border-gray-800 p-1">
                                <button type="button" onClick={applyTags} className="h-7 w-full rounded bg-purple-600 px-2 text-xs font-medium text-white hover:bg-purple-500">
                                  Apply {selectedTags.size}
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      <div className="my-1 border-t border-gray-800" />
      <button
        type="button"
        role="menuitem"
        onClick={() => onFilterFolder(filterTarget)}
        className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-xs text-gray-200 hover:bg-gray-800 hover:text-white"
      >
        <ActionIcon type="filter" />
        {filterTarget.type === 'dir' ? 'Filter to this folder' : 'Filter to containing folder'}
      </button>
      <div className="my-1 border-t border-gray-800" />
      <div className="relative" onMouseEnter={() => setCopyOpen(true)} onMouseLeave={() => setCopyOpen(false)}>
        <button
          type="button"
          role="menuitem"
          className="flex h-8 w-full items-center justify-between rounded px-2 text-left text-xs text-gray-200 hover:bg-gray-800 hover:text-white"
        >
          <span className="flex items-center gap-2"><ActionIcon type="copy" />Copy</span>
          <span className="text-gray-500">›</span>
        </button>
        {copyOpen && (
          <div className={`absolute top-0 min-w-36 overflow-hidden rounded-md border border-gray-700/90 bg-gray-900/95 p-1 shadow-2xl shadow-black/40 backdrop-blur ${submenuLeft ? 'left-full ml-1' : 'right-full mr-1'}`} role="menu">
            {copyOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                role="menuitem"
                onClick={() => onCopy(option.key, items)}
                className="block h-8 w-full rounded px-2 text-left text-xs text-gray-200 hover:bg-gray-800 hover:text-white"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="my-1 border-t border-gray-800" />
      <button
        type="button"
        role="menuitem"
        onClick={() => onDelete(item)}
        className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-xs text-red-300 hover:bg-red-500/15 hover:text-red-200"
      >
        <ActionIcon type="trash" />
        {item.type === 'dir' ? 'Delete directory' : 'Delete file'}
      </button>
      {item.type === 'dir' && (
        <button
          type="button"
          role="menuitem"
          onClick={() => onDeleteDbOnly(item)}
          className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-xs text-amber-300 hover:bg-amber-500/15 hover:text-amber-200"
        >
          <ActionIcon type="cloud" />
          Remove contents from database
        </button>
      )}
    </div>
  );
}
