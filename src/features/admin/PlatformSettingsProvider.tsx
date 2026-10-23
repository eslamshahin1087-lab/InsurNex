import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '../auth/auth-context';
import { DEFAULT_PLATFORM_SETTINGS, subscribePlatformSettings, type PlatformSettings } from './platform-settings.service';

interface PlatformSettingsContextValue {
  settings: PlatformSettings;
  loading: boolean;
}

const PlatformSettingsContext = createContext<PlatformSettingsContextValue | null>(null);

export function PlatformSettingsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.uid) {
      setSettings(DEFAULT_PLATFORM_SETTINGS);
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribePlatformSettings(
      (next) => { setSettings(next); setLoading(false); },
      (error) => {
        console.error('Unable to load platform settings:', error);
        setSettings(DEFAULT_PLATFORM_SETTINGS);
        setLoading(false);
      },
    );
  }, [authLoading, user?.uid]);

  useEffect(() => {
    const root = document.documentElement;
    const variables = [
      ['--inx-blue', settings.branding.primaryColor],
      ['--app-blue', settings.branding.primaryColor],
      ['--inx-cyan', settings.branding.accentColor],
      ['--app-cyan', settings.branding.accentColor],
      ['--inx-gradient', 'linear-gradient(135deg, ' + settings.branding.primaryColor + ', ' + settings.branding.accentColor + ')'],
    ] as const;
    const previous = new Map(variables.map(([name]) => [name, root.style.getPropertyValue(name)]));
    variables.forEach(([name, value]) => root.style.setProperty(name, value));
    return () => {
      variables.forEach(([name]) => {
        const oldValue = previous.get(name);
        if (oldValue) root.style.setProperty(name, oldValue);
        else root.style.removeProperty(name);
      });
    };
  }, [settings.branding.primaryColor, settings.branding.accentColor]);

  const value = useMemo(() => ({ settings, loading }), [settings, loading]);
  return <PlatformSettingsContext.Provider value={value}>{children}</PlatformSettingsContext.Provider>;
}

export function usePlatformSettings(): PlatformSettingsContextValue {
  const value = useContext(PlatformSettingsContext);
  if (!value) throw new Error('usePlatformSettings must be used within PlatformSettingsProvider.');
  return value;
}
