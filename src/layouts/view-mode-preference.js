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

export function resolveViewMode(search, preference) {
  const requested = new URLSearchParams(search).get('view');
  if (requested === 'desktop' || requested === 'mobile') return requested;
  return preference === 'desktop' || preference === 'mobile' ? preference : 'mobile';
}

export function buildViewModeHref(pathname, search, hash, mode) {
  const params = new URLSearchParams(search);
  params.set('view', mode);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ''}${hash || ''}`;
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
