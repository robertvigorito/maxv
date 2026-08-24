import { useEffect, useRef, useState } from 'react';

function countNode(node) {
  let count = (node.files || []).length;
  for (const child of Object.values(node.dirs || {})) count += countNode(child);
  return count;
}

function nodeContainsPath(node, path) {
  if (!path) return false;
  if (node.files && node.files.some((file) => file.path === path)) return true;
  return Object.values(node.dirs || {}).some((child) => nodeContainsPath(child, path));
}

function TreeNode({ name, node, onItemContextMenu, revealPath, groupSignal }) {
  const [open, setOpen] = useState(() => nodeContainsPath(node, revealPath));
  const revealMatches = nodeContainsPath(node, revealPath);
  const hasChildren = node.dirs && Object.keys(node.dirs).length > 0;

  // Force-expand ancestors when a new reveal path is set (e.g. "Show in media bin").
  useEffect(() => {
    if (revealMatches) setOpen(true);
  }, [revealMatches]);

  // Respond to expand-all / collapse-all.
  useEffect(() => {
    if (groupSignal.type === 'expand') setOpen(true);
    else if (groupSignal.type === 'collapse') setOpen(false);
  }, [groupSignal]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        onContextMenu={(event) => onItemContextMenu(event, { type: 'dir', path: node.path })}
        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-sm text-gray-300 hover:bg-gray-800"
      >
        <span className="w-3 shrink-0 text-gray-500">{hasChildren ? (open ? '▾' : '▸') : ''}</span>
        <span className="truncate">{name}</span>
        <span className="ml-auto pl-2 text-xs text-gray-500">{countNode(node)}</span>
      </button>
      {open && (
        <div className="pl-4">
          {Object.entries(node.dirs || {}).map(([child, childNode]) => (
            <TreeNode key={child} name={child} node={childNode} onItemContextMenu={onItemContextMenu} revealPath={revealPath} groupSignal={groupSignal} />
          ))}
          {(node.files || []).map((file) => (
            <FileRow key={file._id} file={file} onItemContextMenu={onItemContextMenu} isRevealed={file.path === revealPath} />
          ))}
        </div>
      )}
    </div>
  );
}

function FileRow({ file, onItemContextMenu, isRevealed }) {
  const ref = useRef(null);
  useEffect(() => {
    if (isRevealed) {
      setTimeout(() => ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 50);
    }
  }, [isRevealed]);
  return (
    <div
      ref={ref}
      onContextMenu={(event) => onItemContextMenu(event, { type: 'file', path: file.path, assetId: file._id, tags: file.tags || [], size: file.size })}
      className={`truncate rounded px-1 py-0.5 pl-4 text-xs hover:bg-gray-800 ${
        isRevealed ? 'bg-purple-600/30 text-purple-200' : 'text-gray-500'
      }`}
      title={file.filename}
    >
      {file.filename}
    </div>
  );
}

export default function MediaTree({ root, onItemContextMenu, revealPath }) {
  const dirs = Object.entries(root?.dirs || {});
  const files = root?.files || [];
  const [groupSignal, setGroupSignal] = useState({ type: null, nonce: 0 });

  const expandAll = () => setGroupSignal({ type: 'expand', nonce: Date.now() });
  const collapseAll = () => setGroupSignal({ type: 'collapse', nonce: Date.now() });

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/60 px-2 py-1">
        <span className="text-xs font-semibold text-gray-400">Media</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={expandAll}
            title="Expand all"
            className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 13l5 5 5-5M7 6l5 5 5-5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={collapseAll}
            title="Collapse all"
            className="flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5 5 5M7 18l5-5 5 5" />
            </svg>
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-800 p-2">
        {dirs.length === 0 && files.length === 0 ? (
          <p className="text-sm text-gray-500">No media indexed</p>
        ) : (
          <>
            {dirs.map(([name, node]) => (
              <TreeNode key={name} name={name} node={node} onItemContextMenu={onItemContextMenu} revealPath={revealPath} groupSignal={groupSignal} />
            ))}
            {files.map((file) => (
              <FileRow key={file._id} file={file} onItemContextMenu={onItemContextMenu} isRevealed={file.path === revealPath} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
