import { useState } from 'react';

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function formatBitrate(bits) {
  if (!bits) return '—';
  const bps = Number(bits);
  if (bps >= 1e6) return `${(bps / 1e6).toFixed(1)} Mbps`;
  if (bps >= 1e3) return `${(bps / 1e3).toFixed(1)} kbps`;
  return `${bps} bps`;
}

function formatDuration(seconds) {
  if (!seconds) return '—';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export default function MetadataModal({ asset, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!asset) return null;

  const rows = [
    { label: 'Filename', value: asset.filename },
    { label: 'Type', value: asset.type },
    { label: 'MIME', value: asset.mime },
    { label: 'Size', value: formatBytes(asset.size) },
    { label: 'Dimensions', value: asset.width && asset.height ? `${asset.width} × ${asset.height}` : '—' },
    { label: 'Duration', value: asset.duration ? formatDuration(asset.duration) : '—' },
  ];

  if (asset.is_sequence) {
    rows.push({ label: 'Frames', value: `${asset.frame_count} frames (${asset.frame_start}–${asset.frame_end})` });
    if (asset.sequence_pattern) rows.push({ label: 'Pattern', value: asset.sequence_pattern });
  }

  if (asset.metadata) {
    if (asset.metadata.codec) rows.push({ label: 'Codec', value: asset.metadata.codec });
    if (asset.metadata.fps) rows.push({ label: 'FPS', value: asset.metadata.fps });
    if (asset.metadata.bitrate) rows.push({ label: 'Bitrate', value: formatBitrate(asset.metadata.bitrate) });
  }

  rows.push(
    { label: 'Tags', value: (asset.tags || []).length ? asset.tags.join(', ') : '—' },
    { label: 'Hash', value: asset.hash || '—' },
    { label: 'Path', value: asset.path, copyable: true },
    { label: 'Modified', value: formatDate(asset.modified_at) },
    { label: 'Indexed', value: formatDate(asset.indexed_at) },
  );

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6"
      onPointerDown={onClose}
    >
      <div
        className="max-h-full w-full max-w-md overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-2xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-200">Metadata</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-0.5 text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            ✕
          </button>
        </div>
        <dl className="divide-y divide-gray-800 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[110px_1fr] items-start gap-3 px-4 py-2">
              <dt className="text-gray-500">{row.label}</dt>
              <dd className="flex min-w-0 items-start gap-2">
                <span className="break-all text-gray-200">{row.value}</span>
                {row.copyable && (
                  <button
                    type="button"
                    onClick={() => {
                      copyText(asset.path);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1200);
                    }}
                    title={copied ? 'Copied!' : 'Copy path'}
                    aria-label="Copy path"
                    className="mt-0.5 shrink-0 rounded p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
                  >
                    {copied ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 text-green-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p className="px-4 py-2 text-xs text-gray-500">
          Press <kbd className="px-1 py-0.5 bg-gray-800 rounded">i</kbd> or{' '}
          <kbd className="px-1 py-0.5 bg-gray-800 rounded">Esc</kbd> to close
        </p>
      </div>
    </div>
  );
}
