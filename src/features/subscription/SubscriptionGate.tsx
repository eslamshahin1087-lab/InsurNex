import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import {
  createTrialSubscription,
  isCurrentUserAdmin,
  isExpired,
} from './subscription.service';
import { useSubscription } from './subscription.hooks';
import { getOnboardingProgress } from '../onboarding/onboarding.service';
import { PlanFeaturesProvider } from './PlanFeaturesProvider';

/**
 * Routes that are accessible even when Onboarding is not complete.
 * These are the routes the Onboarding Wizard opens during the tutorial.
 */
const ONBOARDING_ALLOWED_PREFIXES = [
  '/onboarding',
  '/clients',
  '/policies',
  '/copilot',
];

function isAllowedDuringOnboarding(pathname: string): boolean {
  return ONBOARDING_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default function SubscriptionGate() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const { subscription, loading, refresh } = useSubscription();
  const [adminState, setAdminState] = useState<'loading' | 'admin' | 'user'>(
    'loading',
  );
  const [migrated, setMigrated] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // Check if current user is admin
  useEffect(() => {
    if (!user?.uid) return;
    void isCurrentUserAdmin(user.uid).then((isAdmin) => {
      setAdminState(isAdmin ? 'admin' : 'user');
    });
  }, [user?.uid]);

  // One-time migration: create trial subscription for existing users
  useEffect(() => {
    if (loading || subscription || migrated) return;
    if (!profile?.organizationId || !user?.uid) return;
    setMigrated(true);
    void createTrialSubscription(profile.organizationId, user.uid).then(refresh);
  }, [loading, subscription, migrated, profile?.organizationId, user?.uid, refresh]);

  // Check onboarding status
  useEffect(() => {
    if (!user?.uid) return;
    if (adminState === 'loading') return;

    // Admins skip onboarding
    if (adminState === 'admin') {
      setOnboardingChecked(true);
      setNeedsOnboarding(false);
      return;
    }

    (async () => {
      try {
        const prog = await getOnboardingProgress(user.uid);
        setNeedsOnboarding(!prog || !prog.completed);
      } catch {
        setNeedsOnboarding(false);
      } finally {
        setOnboardingChecked(true);
      }
    })();
  }, [user?.uid, adminState]);

  if (loading || adminState === 'loading' || !onboardingChecked) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-container">
          <div className="inx-empty">
            <b>جاري التحقق...</b>
          </div>
        </div>
      </main>
    );
  }

  // Admins always have access
  if (adminState === 'admin') return <Outlet />;

  if (!subscription) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-container">
          <div className="inx-empty">
            <b>جاري تجهيز حسابك...</b>
          </div>
        </div>
      </main>
    );
  }

  // Subscription expired → redirect to /subscription
  if (isExpired(subscription)) {
    if (location.pathname === '/subscription') return <Outlet />;
    return <Navigate to="/subscription" replace />;
  }

  // Onboarding needed:
  //   - allow the onboarding-related routes (clients / policies / copilot)
  //   - otherwise force back to /onboarding
  if (needsOnboarding && !isAllowedDuringOnboarding(location.pathname)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <PlanFeaturesProvider planId={subscription.plan}><Outlet /></PlanFeaturesProvider>;
}