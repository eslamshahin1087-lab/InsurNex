import { Navigate, Outlet } from 'react-router-dom';
import { usePlatformSettings } from './PlatformSettingsProvider';
import type { PlatformFeatureKey } from './platform-settings.service';
import { usePlanFeatures } from '../subscription/PlanFeaturesProvider';

export default function PlatformFeatureGate({ feature }: { feature: PlatformFeatureKey }) {
  const { settings, loading: settingsLoading } = usePlatformSettings();
  const { features: planFeatures, loading: planLoading } = usePlanFeatures();

  if (settingsLoading || planLoading) {
    return (
      <div className="center-screen" aria-live="polite">
        <div className="spinner" />
      </div>
    );
  }

  if (!settings.features[feature] || !planFeatures[feature]) return <Navigate to="/" replace />;
  return <Outlet />;
}
