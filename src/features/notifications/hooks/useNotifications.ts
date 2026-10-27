// ============================================================
// src/features/notifications/hooks/useNotifications.ts
// ============================================================

import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/auth-context';
import {
  subscribeToNotifications,
  subscribeToUnreadCount,
  subscribeToStats,
  markAsRead as svcMarkAsRead,
  markAllAsRead as svcMarkAllAsRead,
  deleteNotification as svcDelete,
} from '../notification.service.new';
import type { Notification, NotificationStats } from '../types';

// ============================================================
// Hook رئيسي للإشعارات
// ============================================================
export function useNotifications() {
  const { user, profile } = useAuth();
  const userId = user?.uid ?? null;
  const organizationId = (profile as { organizationId?: string } | null)?.organizationId ?? null;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [stats, setStats] = useState<NotificationStats>({
    total: 0, unread: 0, urgent: 0, high: 0, today: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !organizationId) {
      setLoading(false);
      return;
    }

    const unsubList = subscribeToNotifications(userId, organizationId, (data) => {
      setNotifications(data);
      setLoading(false);
    });

    const unsubCount = subscribeToUnreadCount(userId, organizationId, setUnreadCount);
    const unsubStats = subscribeToStats(userId, organizationId, setStats);

    return () => {
      unsubList();
      unsubCount();
      unsubStats();
    };
  }, [userId, organizationId]);

  return {
    notifications,
    unreadCount,
    stats,
    loading,
    markAsRead: svcMarkAsRead,
    markAllAsRead: () => {
      if (!userId || !organizationId) return Promise.resolve(0);
      return svcMarkAllAsRead(userId, organizationId);
    },
    deleteNotification: svcDelete,
  };
}