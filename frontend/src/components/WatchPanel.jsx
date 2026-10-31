import { useEffect, useState } from 'react';
import { api } from '../api/client';

// A number input that commits on blur/Enter so typing doesn't fire an API
// call per keystroke, while still reflecting external changes.
function IntervalInput({ value, onCommit }) {
  const [val, setVal] = useState(value);
  useEffect(() => setVal(value), [value]);

  const commit = () => {
    const n = Number(val);
    if (Number.isFinite(n) && n >= 1) onCommit(Math.round(n));
    else setVal(value);
  };

  return (
    <input
      type="number"
      min="1"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className="w-16 rounded border border-gray-700 bg-gray-950 px-1 py-0.5 text-right font-mono text-xs text-gray-200"
    />
  );
}

function formatTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString();
}

export default function WatchPanel({ watches, onAddWatch, onUpdateWatch, onRemoveWatch, onScanWatch, isOpen, onClose }) {
  const [path, setPath] = useState('');
  const [pathCompletions, setPathCompletions] = useState([]);
  const [completionIndex, setCompletionIndex] = useState(0);
  const [completionNavigated, setCompletionNavigated] = useState(false);
  const [interval, setInterval] = useState(10);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen ?? internalOpen;

  useEffect(() => {
    setCompletionNavigated(false);
    const pathPartial = path.trim();
    if (!pathPartial) {
      setPathCompletions([]);
      setCompletionIndex(0);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await api.completePath(pathPartial);
        if (!cancelled) {
          setPathCompletions(data.items || []);
          setCompletionIndex(0);
        }
      } catch (error) {
        if (!cancelled) setPathCompletions([]);
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [path]);

  const close = () => {
    setInternalOpen(false);
    onClose?.();
  };

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const handleAdd = (e) => {
    e.preventDefault();
    const trimmed = path.trim();
    if (!trimmed) return;
    onAddWatch(trimmed, interval);
    setPath('');
  };

  const handlePathKeyDown = (e) => {
    if (!pathCompletions.length) return;
    if (e.key === 'Enter' && completionNavigated) {
      e.preventDefault();
      setPath(pathCompletions[completionIndex % pathCompletions.length]);
      setCompletionNavigated(false);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setPath(pathCompletions[completionIndex % pathCompletions.length]);
      setCompletionIndex((index) => (index + 1) % pathCompletions.length);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCompletionNavigated(true);
      setCompletionIndex((index) => (index + 1) % pathCompletions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCompletionNavigated(true);
      setCompletionIndex((index) => (index - 1 + pathCompletions.length) % pathCompletions.length);
    }
  };

  return (
    <>
      {isOpen === undefined && (
        <button
          type="button"
          onClick={() => setInternalOpen(true)}
          className="flex w-full items-center justify-between rounded border border-gray-700 bg-gray-950 px-3 py-2 text-left text-xs text-gray-300 hover:border-purple-500/60 hover:bg-gray-900 hover:text-white"
        >
          <span className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${watches.some((w) => w.enabled) ? 'bg-emerald-400' : 'bg-gray-600'}`} />
            Manage watch folders
          </span>
          <span className="font-mono text-gray-500">{watches.length}</span>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="flex max-h-[min(680px,calc(100vh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-100">Watch folders</h3>
                <p className="mt-0.5 text-xs text-gray-500">New media in these folders and their subfolders is indexed automatically.</p>
              </div>
              <button
                type="button"
                onClick={close}
                title="Close watch folders"
                className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2 rounded-md border border-gray-800 bg-gray-950/60 p-3">
                <div className="relative min-w-52 flex-1">
                  <input
                    type="text"
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    onKeyDown={handlePathKeyDown}
                    placeholder="/path/to/watch"
                    className="w-full rounded border border-gray-700 bg-gray-950 px-2 py-1.5 font-mono text-xs text-gray-200 placeholder:text-gray-600"
                  />
                  {pathCompletions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded border border-gray-700 bg-gray-950 shadow-xl">
                      {pathCompletions.map((completion, index) => (
                        <button
                          key={completion}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setPath(completion);
                            setPathCompletions([]);
                          }}
                          className={`block w-full px-2 py-1.5 text-left font-mono text-xs ${
                            index === completionIndex % pathCompletions.length
                              ? 'bg-purple-500/20 text-purple-300'
                              : 'text-gray-300 hover:bg-gray-800'
                          }`}
                        >
                          {completion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <label className="flex items-center gap-1 text-xs text-gray-500">
                  Every
                  <input
                    type="number"
                    min="1"
                    value={interval}
                    onChange={(e) => setInterval(Number(e.target.value))}
                    title="Poll interval in seconds"
                    className="w-16 rounded border border-gray-700 bg-gray-950 px-1.5 py-1.5 text-right font-mono text-xs text-gray-200"
                  />
                  s
                </label>
                <button
                  type="submit"
                  className="rounded bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-500"
                >
                  Add folder
                </button>
              </form>

              {watches.length === 0 ? (
                <p className="py-10 text-center text-xs text-gray-500">No watched folders yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {watches.map((w) => (
                    <li key={w.path} className="rounded-md border border-gray-800 bg-gray-950/50 p-3">
                      <div className="flex items-center gap-2">
                        <span
                          title={w.scanning ? 'Scanning' : w.enabled ? 'Watching' : 'Paused'}
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            w.scanning ? 'animate-pulse bg-yellow-400' : w.enabled ? 'bg-emerald-400' : 'bg-gray-600'
                          }`}
                        />
                        <span className="min-w-0 flex-1 break-all font-mono text-xs text-gray-200" title={w.path}>{w.path}</span>
                        <button type="button" onClick={() => onScanWatch(w.path)} title="Scan now" className="shrink-0 rounded px-2 py-1 text-gray-400 hover:bg-gray-800 hover:text-white">↻</button>
                        <button type="button" onClick={() => onRemoveWatch(w.path)} title="Remove watch" className="shrink-0 rounded px-2 py-1 text-gray-400 hover:bg-gray-800 hover:text-red-400">✕</button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span>Poll every</span>
                        <IntervalInput value={w.interval} onCommit={(nextInterval) => onUpdateWatch(w.path, { interval: nextInterval })} />
                        <span>seconds</span>
                        <button
                          type="button"
                          onClick={() => onUpdateWatch(w.path, { enabled: !w.enabled })}
                          className={`rounded px-2 py-1 ${w.enabled ? 'text-gray-300 hover:bg-gray-800' : 'bg-purple-600/20 text-purple-300 hover:bg-purple-600/30'}`}
                        >
                          {w.enabled ? 'Pause' : 'Resume'}
                        </button>
                        {w.last_scan_at && <span className="ml-auto text-[10px] text-gray-600">Last scan {formatTime(w.last_scan_at)}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
