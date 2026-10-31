import { useEffect } from 'react';

export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-md overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl shadow-black/50"
      >
        <div className="flex items-start gap-3 border-b border-gray-800 px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-300">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M5.5 19h13a1.5 1.5 0 0 0 1.3-2.25l-6.5-11.25a1.5 1.5 0 0 0-2.6 0L4.2 16.75A1.5 1.5 0 0 0 5.5 19z" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-dialog-title" className="text-sm font-semibold text-gray-100">{title}</h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-400">{message}</p>
          </div>
          <button type="button" onClick={onCancel} title="Cancel" className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-800 hover:text-gray-200">
            ✕
          </button>
        </div>
        <div className="flex justify-end gap-2 bg-gray-950/40 px-5 py-3">
          <button type="button" onClick={onCancel} className="rounded-md border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-800 hover:text-white">
            Cancel
          </button>
          <button type="button" autoFocus onClick={onConfirm} className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500">
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
