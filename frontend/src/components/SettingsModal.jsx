import { useEffect } from 'react';
import { ACCENTS, THEMES } from '../theme';

export default function SettingsModal({ isOpen, onClose, theme, onThemeChange, accent, onAccentChange }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-100">Settings</h3>
          <button
            type="button"
            onClick={onClose}
            title="Close settings"
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 p-4">
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Color theme</h4>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {THEMES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onThemeChange(item.id)}
                  aria-pressed={theme === item.id}
                  className={`rounded-lg border p-2 text-left transition ${
                    theme === item.id ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 hover:border-gray-500'
                  }`}
                >
                  <span className="flex h-8 overflow-hidden rounded border border-white/10">
                    {item.swatch.map((color) => (
                      <span key={color} className="flex-1" style={{ backgroundColor: color }} />
                    ))}
                  </span>
                  <span className="mt-1.5 block text-sm font-medium text-gray-100">{item.label}</span>
                  <span className="block text-[11px] text-gray-500">{item.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Accent color</h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {ACCENTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onAccentChange(item.id)}
                  aria-pressed={accent === item.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm text-gray-200 transition ${
                    accent === item.id ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 hover:border-gray-500'
                  }`}
                >
                  <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
