export default function ScanProgress({ progress }) {
  if (!progress || progress.status !== 'running') return null;

  const total = progress.total || 0;
  const processed = progress.processed || 0;
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="border-b border-gray-800 bg-gray-900/80 px-6 py-3">
      <div className="mb-1.5 flex items-center justify-between text-xs text-gray-300">
        <span className="truncate">Scanning: {progress.path || 'media'}</span>
        <span className="ml-3 shrink-0 font-mono text-gray-400">{processed} / {total} ({percent}%)</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
        <div
          className="h-full rounded-full bg-purple-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
