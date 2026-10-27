// ============================================================
// src/features/notifications/index.ts
// ============================================================

// الأنواع
export type {
  Notification,
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  NotificationPreferences,
  NotificationStats,
  NotificationFilter,
} from './types';

export {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_PRIORITY_LABELS,
  NOTIFICATION_PRIORITY_COLORS,
} from './types';

// الخدمة الجديدة
export * from './notification.service.new';

// Hook
export { useNotifications } from './hooks/useNotifications';

// المكونات
export { NotificationBell } from './components/NotificationBell';
export { NotificationSettings } from './components/NotificationSettings';