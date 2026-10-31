import { useMemo, useState } from 'react';

function itemStem(item) {
  const name = item.type === 'dir' ? item.name : (item.filename || item.name || '');
  if (item.type === 'dir') return name;
  return name
    .replace(/\.%0\d+d(?=\.[^.]+$)/i, '')
    .replace(/\.[^.]+$/, '');
}

function itemExtension(item) {
  if (item.type === 'dir') return '';
  const name = item.filename || item.name || '';
  const match = name.match(/(\.[^.]+)$/);
  return match?.[1] || '';
}

function displayName(item, base, index, start, padding, count) {
  const indexed = count > 1 ? `_${String(start + index).padStart(padding, '0')}` : '';
  return `${base}${indexed}`;
}

export default function RenameDialog({ items, onClose, onRename }) {
  const firstItem = items[0];
  const [baseName, setBaseName] = useState(itemStem(firstItem));
  const [start, setStart] = useState(1);
  const [padding, setPadding] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const preview = useMemo(() => items.map((item, index) => ({
    path: item.path,
    new_name: displayName(item, baseName.trim(), index, Number(start) || 1, Math.max(1, Number(padding) || 1), items.length),
    display: item.type === 'dir'
      ? displayName(item, baseName.trim(), index, Number(start) || 1, Math.max(1, Number(padding) || 1), items.length)
      : `${displayName(item, baseName.trim(), index, Number(start) || 1, Math.max(1, Number(padding) || 1), items.length)}${itemExtension(item)}`,
    current: item.type === 'dir' ? item.name : (item.filename || item.name),
    type: item.type,
  })), [baseName, items, padding, start]);

  const submit = async (event) => {
    event.preventDefault();
    if (!baseName.trim()) {
      setError('Enter a new base name.');
      return;
    }
    if (/[\\/]/.test(baseName.trim())) {
      setError('Names cannot contain a slash.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onRename(preview.map(({ path, new_name }) => ({ path, new_name })));
    } catch (requestError) {
      setError(requestError.message || 'Rename failed.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <form onSubmit={submit} className="flex max-h-[min(720px,calc(100vh-2rem))] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-100">Rename selected items</h2>
            <p className="mt-0.5 text-xs text-gray-500">{items.length} {items.length === 1 ? 'item' : 'items'} · file extensions are preserved</p>
          </div>
          <button type="button" disabled={busy} onClick={onClose} className="rounded px-2 py-1 text-gray-400 hover:bg-gray-800 hover:text-white">✕</button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          <label className="block text-xs font-medium text-gray-400">
            New base name
            <input autoFocus value={baseName} onChange={(event) => setBaseName(event.target.value)} className="mt-1.5 w-full rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-purple-500" />
          </label>

          {items.length > 1 && (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-gray-400">
                First index
                <input type="number" min="0" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1.5 w-full rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-purple-500" />
              </label>
              <label className="text-xs font-medium text-gray-400">
                Index digits
                <input type="number" min="1" max="8" value={padding} onChange={(event) => setPadding(event.target.value)} className="mt-1.5 w-full rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 outline-none focus:border-purple-500" />
              </label>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-400">Preview</p>
            <div className="max-h-52 overflow-y-auto rounded border border-gray-800 bg-gray-950/60">
              {preview.slice(0, 100).map((entry, index) => (
                <div key={entry.path} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-gray-800/70 px-2 py-1.5 font-mono text-[11px] last:border-0">
                  <span className="truncate text-gray-500" title={entry.current}>{entry.current}</span>
                  <span className="text-gray-700">→</span>
                  <span className="truncate text-purple-300" title={entry.display}>{entry.display}</span>
                  {index === 99 && items.length > 100 && <span className="col-span-3 text-gray-500">…and {items.length - 100} more</span>}
                </div>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-gray-600">Multiple selections are numbered in selection order. Folders and indexed descendants are renamed together.</p>
          </div>
          {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-800 p-3">
          <button type="button" disabled={busy} onClick={onClose} className="rounded border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800">Cancel</button>
          <button type="submit" disabled={busy || !baseName.trim()} className="rounded bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-500 disabled:opacity-50">{busy ? 'Renaming…' : `Rename ${items.length}`}</button>
        </div>
      </form>
    </div>
  );
}