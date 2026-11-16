import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_FEATURE_ENTITLEMENTS, normalizeFeatureEntitlements, type FeatureEntitlements } from '../admin/feature-catalog';
import { getPlanById } from '../admin/plans.service';

interface PlanFeaturesContextValue {
  features: FeatureEntitlements;
  loading: boolean;
}

const PlanFeaturesContext = createContext<PlanFeaturesContextValue | null>(null);

export function PlanFeaturesProvider({ planId, children, unrestricted = false }: { planId: string; children: ReactNode; unrestricted?: boolean }) {
  const [features, setFeatures] = useState<FeatureEntitlements>(DEFAULT_FEATURE_ENTITLEMENTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (unrestricted) return;
    let cancelled = false;
    setLoading(true);
    void getPlanById(planId)
      .then((plan) => {
        if (cancelled) return;
        // Legacy/missing plan feature fields intentionally preserve full access by default.
        setFeatures(normalizeFeatureEntitlements(plan?.features));
      })
      .catch((error: unknown) => {
        console.error('Unable to load subscription plan features:', error);
        if (!cancelled) setFeatures(DEFAULT_FEATURE_ENTITLEMENTS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [planId, unrestricted]);

  const value = useMemo(
    () => ({
      features: unrestricted ? DEFAULT_FEATURE_ENTITLEMENTS : features,
      loading: unrestricted ? false : loading,
    }),
    [features, loading, unrestricted],
  );
  return <PlanFeaturesContext.Provider value={value}>{children}</PlanFeaturesContext.Provider>;
}

export function usePlanFeatures(): PlanFeaturesContextValue {
  const value = useContext(PlanFeaturesContext);
  if (!value) throw new Error('usePlanFeatures must be used within PlanFeaturesProvider.');
  return value;
}
