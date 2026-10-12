import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/auth-context';
import {
  getSubscription,
  isExpired as checkExpired,
  daysRemaining as checkDaysRemaining,
} from './subscription.service';
import type { OrganizationSubscription } from './subscription.types';

export function useSubscription() {
  const { profile } = useAuth();
  const [subscription, setSubscription] = useState<OrganizationSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!profile?.organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const sub = await getSubscription(profile.organizationId);
      setSubscription(sub);
    } catch {
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [profile?.organizationId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    subscription,
    loading,
    isExpired: checkExpired(subscription),
    daysRemaining: checkDaysRemaining(subscription),
    refresh,
  };
}