const STORAGE_KEY = 'insurnex-view-mode';

export function readViewModePreference() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === 'desktop' || stored === 'mobile' ? stored : null;
  } catch {
    // Storage can be unavailable in private contexts or restricted browser modes.
    return null;
  }
}

export function writeViewModePreference(mode) {
  if (mode !== 'desktop' && mode !== 'mobile') return false;

  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
    return true;
  } catch {
    // The current in-memory selection still works for this session.
    return false;
  }
}
