import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import {
  createTrialSubscription,
  isCurrentUserAdmin,
  isExpired,
} from './subscription.service';
import { useSubscription } from './subscription.hooks';

export default function SubscriptionGate() {
  const { user, profile } = useAuth();
  const { subscription, loading, refresh } = useSubscription();
  const [adminState, setAdminState] = useState<'loading' | 'admin' | 'user'>('loading');
  const [migrated, setMigrated] = useState(false);

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

  if (loading || adminState === 'loading') {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-container">
          <div className="inx-empty">
            <b>جاري التحقق من الاشتراك...</b>
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

  if (isExpired(subscription)) {
    return <Navigate to="/subscription" replace />;
  }

  return <Outlet />;
}