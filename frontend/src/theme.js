// Theme and accent options. The colour values live in index.css as
// [data-theme] / [data-accent] overrides of Tailwind's palette variables.
export const THEMES = [
  { id: 'default', label: 'Default', description: 'Cool dark gray', swatch: ['#030712', '#111827', '#374151'] },
  { id: 'slate', label: 'Slate', description: 'Blue-tinted dark', swatch: ['#020617', '#0f172a', '#334155'] },
  { id: 'graphite', label: 'Graphite', description: 'Neutral dark', swatch: ['#0a0a0a', '#171717', '#404040'] },
  { id: 'mocha', label: 'Mocha', description: 'Warm dark', swatch: ['#0c0a09', '#1c1917', '#44403c'] },
  { id: 'black', label: 'Black', description: 'Maximum contrast', swatch: ['#000000', '#0a0a0a', '#262626'] },
];

export const ACCENTS = [
  { id: 'purple', label: 'Purple', color: '#a855f7' },
  { id: 'sky', label: 'Sky', color: '#0ea5e9' },
  { id: 'emerald', label: 'Emerald', color: '#10b981' },
  { id: 'rose', label: 'Rose', color: '#f43f5e' },
  { id: 'amber', label: 'Amber', color: '#f59e0b' },
];

export const THEME_KEY = 'maxv-theme';
export const ACCENT_KEY = 'maxv-accent';

export function applyAppearance(theme, accent) {
  const root = document.documentElement;
  if (theme && theme !== 'default') root.dataset.theme = theme;
  else delete root.dataset.theme;
  if (accent && accent !== 'purple') root.dataset.accent = accent;
  else delete root.dataset.accent;
}

function stored(key, fallback) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key));
    return typeof value === 'string' ? value : fallback;
  } catch {
    return fallback;
  }
}

// Apply the saved appearance before first paint to avoid a flash of the default theme.
export function applySavedAppearance() {
  applyAppearance(stored(THEME_KEY, 'default'), stored(ACCENT_KEY, 'purple'));
}
