import { useEffect, useState } from 'react';

export default function MediaContextMenu({ position, item, onClose, onOpen, onDelete, onCopy }) {
  const [copyOpen, setCopyOpen] = useState(false);

  useEffect(() => {
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
  }, [onClose]);

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
      className="fixed z-40 min-w-44 overflow-visible rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-2xl"
      style={{ left: position.x, top: position.y }}
      onPointerDown={(event) => event.stopPropagation()}
      role="menu"
      aria-label="Media item actions"
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => onOpen(item)}
        className="flex w-full items-center px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800 hover:text-white"
      >
        Open in Explorer
      </button>
      <div className="relative" onMouseEnter={() => setCopyOpen(true)}>
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center justify-between px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800 hover:text-white"
        >
          <span>Copy</span>
          <span className="ml-6 text-gray-500">›</span>
        </button>
        {copyOpen && (
          <div className="absolute left-full top-0 ml-1 min-w-36 overflow-hidden rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-2xl" role="menu">
            {copyOptions.map((option) => (
              <button
                key={option.key}
                type="button"
                role="menuitem"
                onClick={() => onCopy(option.key, item)}
                className="block w-full px-4 py-2 text-left text-sm text-gray-200 hover:bg-gray-800 hover:text-white"
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="mt-1 border-t border-gray-700/70" />
      <button
        type="button"
        role="menuitem"
        onClick={() => onDelete(item)}
        className="flex w-full items-center px-4 py-2 text-left text-sm text-red-300 hover:bg-red-500/15 hover:text-red-200"
      >
        {item.type === 'dir' ? 'Delete directory' : 'Delete file'}
      </button>
    </div>
  );
}
