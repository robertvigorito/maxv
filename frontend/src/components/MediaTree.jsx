import { useEffect, useMemo, useRef, useState } from 'react';

const VIDEO_EXTS = new Set(['.mov', '.mp4', '.m4v', '.avi', '.mkv', '.webm', '.wmv', '.flv']);
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff']);

// Icons for media-bin tree rows: folder, and per-extension file icons.
function itemIcon(item, className = 'h-4 w-4') {
  if (item.type === 'dir') {
    // Two-tone folder
    return (
      <svg viewBox="0 0 24 24" className={className}>
        <path fill="#D8A657" d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5V9H3V6.5z" />
        <path fill="#EBCA90" d="M3 9h18v7.5A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5V9z" />
      </svg>
    );
  }

  const ext = (item.path.match(/\.[^.]+$/) || [''])[0].toLowerCase();
  if (ext === '.mov') {
    // Clapperboard (two-tone purple)
    return (
      <svg viewBox="0 0 24 24" className={className}>
        <path fill="#B77AE3" d="M4 8h16l1.5 4H2.5L4 8z" />
        <path fill="#8E4EC6" d="M2.5 12h19v6a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-6z" />
      </svg>
    );
  }
  if (VIDEO_EXTS.has(ext)) {
    // Play button
    return (
      <svg viewBox="0 0 24 24" className={className}>
        <rect x="2.5" y="4.5" width="19" height="15" rx="3.5" fill="#3D9AE8" />
        <path d="M10 9l5.5 3L10 15V9z" fill="#fff" />
      </svg>
    );
  }
  if (ext === '.gif') {
    // Film strip
    return (
      <svg viewBox="0 0 24 24" className={className}>
        <rect x="2" y="3" width="20" height="18" rx="2" fill="#F0A030" />
        <path d="M2 8h20M2 13h20M9 3v18M15 3v18" stroke="#fff" strokeWidth="1.4" fill="none" />
      </svg>
    );
  }
  if (IMAGE_EXTS.has(ext)) {
    // Picture
    return (
      <svg viewBox="0 0 24 24" className={className}>
        <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" fill="#34C48E" />
        <circle cx="9" cy="10" r="2.2" fill="#fff" />
        <path d="M5.5 19l5-5 3 3 3.5-3.5L21 17v.5a2 2 0 0 1-2 2H5.5z" fill="#fff" opacity="0.9" />
      </svg>
    );
  }
  // Generic file (two-tone gray)
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path fill="#9AA0A6" d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
      <path fill="#C4C9CD" d="M15 2l5 5h-5V2z" />
    </svg>
  );
}

function countNode(node) {
  let count = (node.files || []).length;
  for (const child of Object.values(node.dirs || {})) count += countNode(child);
  return count;
}

function nodeContainsPath(node, path) {
  if (!path || !node) return false;
  if (node.path === path) return true;
  if (node.files && node.files.some((file) => file.path === path)) return true;
  return Object.values(node.dirs || {}).some((child) => nodeContainsPath(child, path));
}

// Collect the dir paths that are ancestors of a target path (used for reveal).
function collectAncestors(node, targetPath, out) {
  for (const child of Object.values(node.dirs || {})) {
    if (nodeContainsPath(child, targetPath)) {
      out.add(child.path);
      collectAncestors(child, targetPath, out);
    }
  }
  return out;
}

// Collect every dir path in the tree (used for expand-all).
function collectAllDirPaths(node, out) {
  for (const child of Object.values(node.dirs || {})) {
    out.add(child.path);
    collectAllDirPaths(child, out);
  }
  return out;
}

function collectSelectedTree(node, targetPath, out) {
  for (const child of Object.values(node.dirs || {})) {
    if (child.path === targetPath) {
      out.add(child.path);
      collectAllDirPaths(child, out);
      return true;
    }
    if (collectSelectedTree(child, targetPath, out)) return true;
  }
  return false;
}

function descriptorOf(item) {
  if (item.type === 'dir') return { type: 'dir', path: item.path, name: item.name };
  return { type: 'file', path: item.path, filename: item.file.filename, assetId: item.file._id, tags: item.file.tags || [], size: item.file.size };
}

export default function MediaTree({ root, onItemContextMenu, revealPath, onFilterFolder, groupSignal, expandSelection, onSelectionChange }) {

  // Expanded folder paths, focused item, and multi-selection state.
  const [openPaths, setOpenPaths] = useState(() => new Set());
  const [focusedKey, setFocusedKey] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [anchorKey, setAnchorKey] = useState(null);
  const itemRefs = useRef({});

  // Force-expand ancestors of the reveal path (e.g. "Show in media bin").
  useEffect(() => {
    if (!revealPath || !root) return;
    setOpenPaths((current) => {
      const next = new Set(current);
      collectAncestors(root, revealPath, next);
      return next;
    });
  }, [revealPath, root]);

  // Respond to expand-all / collapse-all from the panel header.
  useEffect(() => {
    if (!groupSignal.type) return;
    if (groupSignal.type === 'expand') {
      setOpenPaths((current) => {
        const next = new Set(current);
        collectAllDirPaths(root, next);
        return next;
      });
    } else if (groupSignal.type === 'collapse') {
      setOpenPaths(new Set());
    }
  }, [groupSignal, root]);

  useEffect(() => {
    if (!expandSelection?.paths?.length || !root) return;
    setOpenPaths((current) => {
      const next = new Set(current);
      for (const path of expandSelection.paths) {
        collectAncestors(root, path, next);
        collectSelectedTree(root, path, next);
      }
      return next;
    });
  }, [expandSelection, root]);

  // Flatten the visible tree (only expanded branches) into an ordered list.
  // Each item carries `guides` (per ancestor, whether a line continues through)
  // and `isLast` so rows can draw VS Code-style line guides.
  const items = useMemo(() => {
    const list = [];
    const walk = (node, guides, parentKey) => {
      const children = [];
      for (const [name, child] of Object.entries(node.dirs || {})) {
        children.push({ key: `d:${child.path}`, type: 'dir', node: child, path: child.path, name });
      }
      for (const file of node.files || []) {
        children.push({ key: `f:${file.path}`, type: 'file', file, path: file.path });
      }
      children.forEach((child, i) => {
        const isLast = i === children.length - 1;
        list.push({ ...child, parentKey, guides, isLast, depth: guides.length });
        if (child.type === 'dir' && openPaths.has(child.path)) {
          walk(child.node, [...guides, { hasLine: !isLast }], child.key);
        }
      });
    };
    walk(root, [], null);
    return list;
  }, [root, openPaths]);

  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Report the selection (in display order) whenever it changes.
  useEffect(() => {
    if (!onSelectionChange) return;
    const ordered = itemsRef.current.filter((it) => selectedKeys.has(it.key)).map(descriptorOf);
    onSelectionChange(ordered);
  }, [selectedKeys, onSelectionChange]);

  // Keep the focused item in view and actually focused.
  useEffect(() => {
    if (!focusedKey) return;
    const el = itemRefs.current[focusedKey];
    if (el) {
      el.focus();
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [focusedKey]);

  // Scroll a revealed file into view once its ancestors are expanded.
  useEffect(() => {
    if (!revealPath) return;
    const el = itemRefs.current[`f:${revealPath}`];
    if (el) setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
  }, [revealPath, items]);

  const focusRelative = (delta) => {
    if (!items.length) return;
    const idx = items.findIndex((it) => it.key === focusedKey);
    const nextIdx = idx === -1 ? 0 : Math.max(0, Math.min(items.length - 1, idx + delta));
    setFocusedKey(items[nextIdx].key);
  };

  const handleItemKeyDown = (event, item) => {
    const isDir = item.type === 'dir';
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusRelative(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusRelative(-1);
        break;
      case 'ArrowRight':
        if (isDir) {
          event.preventDefault();
          if (!openPaths.has(item.path)) {
            setOpenPaths((current) => new Set(current).add(item.path));
          } else {
            const firstChild = items.find((it) => it.parentKey === item.key);
            if (firstChild) setFocusedKey(firstChild.key);
          }
        }
        break;
      case 'ArrowLeft':
        event.preventDefault();
        if (isDir && openPaths.has(item.path)) {
          setOpenPaths((current) => {
            const next = new Set(current);
            next.delete(item.path);
            return next;
          });
        } else if (item.parentKey) {
          setFocusedKey(item.parentKey);
        }
        break;
      default:
        break;
    }
  };

  const handleRowClick = (event, item) => {
    // Alt-click filters the grid to this folder / the file's parent folder.
    if (event.altKey && onFilterFolder) {
      const path = item.type === 'dir' ? item.path : item.path.substring(0, item.path.lastIndexOf('/'));
      onFilterFolder(path);
      return;
    }

    let next;
    if (event.ctrlKey || event.metaKey) {
      // Toggle this item in the selection.
      next = new Set(selectedKeys);
      if (next.has(item.key)) next.delete(item.key);
      else next.add(item.key);
      setAnchorKey(item.key);
    } else if (event.shiftKey && anchorKey) {
      // Range-select from the anchor to this item (in display order).
      const startIdx = items.findIndex((it) => it.key === anchorKey);
      const endIdx = items.findIndex((it) => it.key === item.key);
      if (startIdx !== -1 && endIdx !== -1) {
        const [a, b] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        next = new Set(items.slice(a, b + 1).map((it) => it.key));
      } else {
        next = new Set([item.key]);
        setAnchorKey(item.key);
      }
    } else {
      next = new Set([item.key]);
      setAnchorKey(item.key);
    }
    setSelectedKeys(next);

    // Plain-clicking a folder also toggles it open.
    if (item.type === 'dir' && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      setOpenPaths((current) => {
        const n = new Set(current);
        if (n.has(item.path)) n.delete(item.path);
        else n.add(item.path);
        return n;
      });
    }
  };

  const handleContextMenu = (event, item) => {
    event.preventDefault();
    // Ensure the right-clicked item is part of the selection.
    if (!selectedKeys.has(item.key)) {
      setSelectedKeys(new Set([item.key]));
      setAnchorKey(item.key);
    }
    onItemContextMenu(event, descriptorOf(item));
  };

  const isEmpty = items.length === 0;
  // First item is the initial tab target until the user navigates.
  const tabTarget = focusedKey ?? items[0]?.key ?? null;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-800 p-2">
        {isEmpty ? (
          <p className="text-sm text-gray-500">No media indexed</p>
        ) : (
          items.map((item) => {
            const isFocused = focusedKey === item.key;
            const isSelected = selectedKeys.has(item.key);
            const isFile = item.type === 'file';
            const isRevealed = isFile && item.path === revealPath && !isSelected;
            const hasChildren = !isFile && item.node.dirs && Object.keys(item.node.dirs).length > 0;
            const open = !isFile && (item.forcedOpen || openPaths.has(item.path));
            const name = isFile ? item.file.filename : item.name;
            const count = isFile ? null : countNode(item.node);

            return (
              <button
                key={item.key}
                ref={(el) => { itemRefs.current[item.key] = el; }}
                type="button"
                tabIndex={tabTarget === item.key ? 0 : -1}
                onFocus={() => setFocusedKey(item.key)}
                onKeyDown={(event) => handleItemKeyDown(event, item)}
                onClick={(event) => handleRowClick(event, item)}
                onContextMenu={(event) => handleContextMenu(event, item)}
                title={isFile ? `${item.file.filename} — Alt-click to filter to containing folder` : 'Alt-click to filter to this folder'}
                className={`flex h-[22px] w-full items-center rounded px-1 text-left text-[13px] leading-none ${
                  isFile ? 'text-gray-300' : 'text-gray-200'
                } hover:bg-gray-800/70 ${
                  isSelected ? 'bg-blue-500/15' : ''
                } ${isRevealed ? 'bg-blue-500/10 text-gray-100' : ''} ${
                  isFocused ? 'ring-1 ring-inset ring-blue-400/40' : ''
                }`}
              >
                {item.guides.map((g, i) => (
                  <span key={i} className="w-3 self-stretch text-gray-700">
                    <svg viewBox="0 0 12 24" preserveAspectRatio="none" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke">
                      {g.hasLine ? <path d="M6 0v24" /> : null}
                    </svg>
                  </span>
                ))}
                {item.depth > 0 && (
                  <span className="w-3 self-stretch text-gray-700">
                    <svg viewBox="0 0 12 24" preserveAspectRatio="none" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke">
                      <path d={item.isLast ? 'M6 0v12h6' : 'M6 0v24M6 12h6'} />
                    </svg>
                  </span>
                )}
                {hasChildren ? (
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform duration-100 ${open ? 'rotate-90' : ''}`}
                  >
                    <path d="M6 5l4 4-4 4" />
                  </svg>
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="ml-0.5 shrink-0">{itemIcon(item, 'h-4 w-4')}</span>
                <span className="ml-1 min-w-0 truncate">{name}</span>
                {count != null && <span className="ml-auto pl-2 text-[11px] text-gray-500">{count}</span>}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
