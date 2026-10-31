import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../api/client';

function ActionIcon({ type }) {
  const paths = {
    tag: 'M20 13l-7 7-9-9V4h7l9 9zM7.5 7.5h.01',
    copy: 'M8 8V5.5A1.5 1.5 0 0 1 9.5 4h9A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H16M5.5 8h9A1.5 1.5 0 0 1 16 9.5v9A1.5 1.5 0 0 1 14.5 20h-9A1.5 1.5 0 0 1 4 18.5v-9A1.5 1.5 0 0 1 5.5 8z',
    sequence: 'M4 6h16M4 12h16M4 18h16M8 4v16M16 4v16',
    send: 'M5 12h13m-6-6 6 6-6 6',
    play: 'M8 5v14l11-7z',
    reveal: 'M4 5.5A1.5 1.5 0 0 1 5.5 4h5l2 2H18.5A1.5 1.5 0 0 1 20 7.5v9A1.5 1.5 0 0 1 18.5 18h-13A1.5 1.5 0 0 1 4 16.5v-11z',
    open: 'M4 7h6l2 2h8v8.5A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5V7z',
    trash: 'M5 7h14m-9 4v5m4-5v5M9 7V5h6v2m-9 0 1 13h10l1-13',
    cloud: 'M7 18h10a4 4 0 0 0 .7-7.94A5.5 5.5 0 0 0 7.2 8.5 4.75 4.75 0 0 0 7 18z',
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 shrink-0">
      <path d={paths[type]} />
    </svg>
  );
}

export default function QuickTagMenu({ position, selectedItemTags = [], selectedCount = 1, onClose, onAppend, onRemove, onNew, onClearAll, onDelete, onOpenInExplorer, onCopy, onShowInMediaBin, onSendToBin, onPlayInTimeline, onPlate, onRename }) {
  const [copyOpen, setCopyOpen] = useState(false);
  const [tags, setTags] = useState([]);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [openAction, setOpenAction] = useState(null);
  const [selected, setSelected] = useState({ append: new Set(), remove: new Set() });
  const menuRef = useRef(null);
  const [menuPosition, setMenuPosition] = useState(position);
  const submenuLeft = position.x < window.innerWidth - 460;

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const margin = 8;
    const rect = menu.getBoundingClientRect();
    setMenuPosition({
      x: Math.max(margin, Math.min(position.x, window.innerWidth - rect.width - margin)),
      y: Math.max(margin, Math.min(position.y, window.innerHeight - rect.height - margin)),
    });
  }, [position]);

  const toggleTag = (action, tag, event) => {
    if (!event.altKey) {
      if (action === 'append') onAppend([tag]);
      else onRemove([tag]);
      return;
    }
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
      ref={menuRef}
      className="fixed z-40 min-w-52 overflow-visible rounded-md border border-gray-700/90 bg-gray-900/95 p-1 shadow-2xl shadow-black/40 backdrop-blur"
      style={{ left: menuPosition.x, top: menuPosition.y }}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseLeave={onClose}
      role="menu"
      aria-label="Quick tag actions"
    >
      <div className="relative" onMouseEnter={() => setTagsOpen(true)} onMouseLeave={() => { setTagsOpen(false); setOpenAction(null); setSelected({ append: new Set(), remove: new Set() }); }}>
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
            <button
              type="button"
              role="menuitem"
              onClick={onNew}
              className="flex h-8 w-full items-center justify-between rounded px-2 text-left text-xs text-gray-200 hover:bg-gray-800 hover:text-white"
            >
              <span>New</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={onClearAll}
              className="flex h-8 w-full items-center justify-between rounded px-2 text-left text-xs text-gray-200 hover:bg-gray-800 hover:text-white"
            >
              <span>Clear All</span>
            </button>
            <div className="my-1 border-t border-gray-800" />
            {['append', 'remove'].map((action, index) => (
              <div
                key={action}
                className={`relative ${index === 1 ? 'mt-1 border-t border-gray-800' : ''}`}
                onMouseEnter={() => setOpenAction(action)}
              >
                <button
                  type="button"
                  role="menuitem"
                  className="flex h-8 w-full items-center justify-between rounded px-2 text-left text-xs text-gray-200 hover:bg-gray-800 hover:text-white"
                >
                  <span>{action === 'append' ? 'Append' : 'Remove'}</span>
                  <span className="text-gray-500">›</span>
                </button>
                {openAction === action && (
                  <div className={`absolute top-0 min-w-44 overflow-hidden rounded-md border border-gray-700/90 bg-gray-900/95 p-1 shadow-2xl shadow-black/40 backdrop-blur ${submenuLeft ? 'left-full ml-1' : 'right-full mr-1'}`} role="menu">
                    {(action === 'append' ? tags : selectedItemTags).length === 0 ? (
                      <div className="px-2 py-2 text-xs text-gray-500">{action === 'append' ? 'No saved tags' : 'No tags on this item'}</div>
                    ) : (
                      <>
                        <div className="max-h-52 overflow-y-auto">
                          {(action === 'append' ? tags : selectedItemTags).map((tag) => (
                            <div
                              key={`${action}-${tag}`}
                              className="flex h-8 items-center gap-2 rounded px-2 text-left text-xs text-gray-200 hover:bg-gray-800"
                            >
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${selected[action].has(tag) ? 'bg-purple-400' : 'bg-gray-700'}`} />
                              <button type="button" className="min-w-0 truncate text-left text-xs text-gray-200 hover:text-white" onClick={(event) => toggleTag(action, tag, event)}>{tag}</button>
                            </div>
                          ))}
                        </div>
                        {selected[action].size > 1 && (
                          <div className="mt-1 border-t border-gray-800 p-1">
                            <button
                              type="button"
                              onClick={() => apply(action)}
                              className="h-7 w-full rounded bg-purple-600 px-2 text-xs font-medium text-white hover:bg-purple-500"
                            >
                              Apply ({selected[action].size})
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
            {[['path', 'Path'], ['directory', 'Directory'], ['tags', 'Tags'], ['size', 'Size']].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="menuitem"
                onClick={() => onCopy(key)}
                className="block h-8 w-full rounded px-2 text-left text-xs text-gray-200 hover:bg-gray-800 hover:text-white"
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="my-1 border-t border-gray-800" />
      <button
        type="button"
        role="menuitem"
        onClick={onRename}
        className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-xs text-gray-200 hover:bg-gray-800 hover:text-white"
      >
        <span className="w-3.5 text-center">✎</span>
        Rename {selectedCount > 1 ? `${selectedCount} selected` : 'item'}
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onPlayInTimeline}
        className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-xs text-gray-200 hover:bg-gray-800 hover:text-white"
      >
        <ActionIcon type="play" />
        Play in timeline
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onPlate}
        className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-xs text-gray-200 hover:bg-gray-800 hover:text-white"
      >
        <ActionIcon type="sequence" />
        Plate as sequence
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onSendToBin}
        className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-xs text-gray-200 hover:bg-gray-800 hover:text-white"
      >
        <ActionIcon type="send" />
        Send to bin
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onShowInMediaBin}
        className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-xs text-gray-200 hover:bg-gray-800 hover:text-white"
      >
        <ActionIcon type="reveal" />
        Show in media bin
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onOpenInExplorer}
        className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-xs text-gray-200 hover:bg-gray-800 hover:text-white"
      >
        <ActionIcon type="open" />
        Open in Explorer
      </button>
      <div className="my-1 border-t border-gray-800" />
      <button
        type="button"
        role="menuitem"
        onClick={() => onDelete(true)}
        className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-xs text-red-300 hover:bg-red-500/15 hover:text-red-200"
      >
        <ActionIcon type="trash" />
        Delete from disk
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => onDelete(false)}
        className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-xs text-amber-300 hover:bg-amber-500/15 hover:text-amber-200"
      >
        <ActionIcon type="cloud" />
        Remove from database
      </button>
    </div>
  );
}
