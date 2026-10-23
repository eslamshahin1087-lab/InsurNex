import { Navigate, Outlet } from 'react-router-dom';
import { usePlatformSettings } from './PlatformSettingsProvider';
import type { PlatformFeatureKey } from './platform-settings.service';

export default function PlatformFeatureGate({ feature }: { feature: PlatformFeatureKey }) {
  const { settings, loading } = usePlatformSettings();

  if (loading) {
    return (
      <div className="center-screen" aria-live="polite">
        <div className="spinner" />
      </div>
    );
  }

  if (!settings.features[feature]) return <Navigate to="/" replace />;
  return <Outlet />;
}
