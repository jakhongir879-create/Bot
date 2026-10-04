const KEY = 'rahbar_theme';

export function getSavedTheme() {
  try {
    return localStorage.getItem(KEY) || 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === 'light' || mode === 'dark') root.dataset.theme = mode;
  else delete root.dataset.theme;
  window.dispatchEvent(new Event('themechange'));
}

export function saveTheme(mode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* brauzer ruxsat bermasa */
  }
  applyTheme(mode);
}
