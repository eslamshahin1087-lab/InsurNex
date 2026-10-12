import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

type ThemeContextValue = {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = 'insurnex-theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

/* ============================================================
   DARK MODE — NOW ENABLED
   ============================================================ */
const DARK_MODE_ENABLED = true;

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  if (!DARK_MODE_ENABLED) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function savedMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  if (!DARK_MODE_ENABLED) return 'light';
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(savedMode);
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme);

  const resolvedTheme: ResolvedTheme = DARK_MODE_ENABLED
    ? mode === 'system'
      ? system
      : mode
    : 'light';

  useEffect(() => {
    if (!DARK_MODE_ENABLED) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystem(media.matches ? 'dark' : 'light');
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
    if (DARK_MODE_ENABLED) {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }
  }, [mode, resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolvedTheme,
      setMode: (next) => setModeState(next),
      toggleTheme: () =>
        setModeState((current) => {
          if (!DARK_MODE_ENABLED) return 'light';
          const active = current === 'system' ? system : current;
          return active === 'dark' ? 'light' : 'dark';
        }),
    }),
    [mode, resolvedTheme, system],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}