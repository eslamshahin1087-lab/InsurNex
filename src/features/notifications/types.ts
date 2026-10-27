// ============================================================
// src/features/notifications/types.ts
// أنواع بيانات نظام الإشعارات — InsurNex
// ============================================================

// ------------------------------------------------------------
// أنواع الإشعارات
// ------------------------------------------------------------
export type NotificationType =
  | 'policy_expiring'
  | 'policy_expired'
  | 'renewal_reminder'
  | 'payment_due'
  | 'lead_created'
  | 'lead_assigned'
  | 'client_created'
  | 'document_expiring'
  | 'document_verified'
  | 'task_reminder'
  | 'appointment_reminder'
  | 'system';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
export type NotificationChannel = 'in_app' | 'email' | 'push' | 'sms';

// ------------------------------------------------------------
// الإشعار
// ------------------------------------------------------------
export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;

  title: string;
  titleEn?: string;
  body: string;
  bodyEn?: string;

  organizationId: string;
  userId?: string | null;
  clientId?: string;
  policyId?: string;
  documentId?: string;
  leadId?: string;
  taskId?: string;

  link?: string;
  actionRequired?: boolean;
  actionUrl?: string;
  actionLabel?: string;

  read: boolean;
  readAt?: Date | null;

  channels: NotificationChannel[];
  metadata?: Record<string, unknown>;

  createdAt: Date;
  expiresAt?: Date | null;
}

// ------------------------------------------------------------
// تفضيلات المستخدم
// ------------------------------------------------------------
export interface NotificationPreferences {
  userId: string;
  organizationId: string;

  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
    sms: boolean;
  };

  types: Record<NotificationType, boolean>;

  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
    timezone: string;
  };

  emailDigest: 'never' | 'daily' | 'weekly';
  updatedAt: Date;
}

// ------------------------------------------------------------
// إحصائيات
// ------------------------------------------------------------
export interface NotificationStats {
  total: number;
  unread: number;
  urgent: number;
  high: number;
  today: number;
}

// ------------------------------------------------------------
// فلاتر
// ------------------------------------------------------------
export interface NotificationFilter {
  types?: NotificationType[];
  priorities?: NotificationPriority[];
  unreadOnly?: boolean;
  fromDate?: Date;
  toDate?: Date;
}

// ------------------------------------------------------------
// تسميات عربية
// ------------------------------------------------------------
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  policy_expiring: 'بوليصة على وشك الانتهاء',
  policy_expired: 'بوليصة منتهية',
  renewal_reminder: 'تذكير تجديد',
  payment_due: 'دفعة مستحقة',
  lead_created: 'عميل محتمل جديد',
  lead_assigned: 'تم تعيين عميل محتمل',
  client_created: 'عميل جديد',
  document_expiring: 'مستند على وشك الانتهاء',
  document_verified: 'تم التحقق من مستند',
  task_reminder: 'تذكير مهمة',
  appointment_reminder: 'تذكير موعد',
  system: 'إشعار نظام',
};

export const NOTIFICATION_PRIORITY_LABELS: Record<NotificationPriority, string> = {
  low: 'منخفضة',
  normal: 'عادية',
  high: 'عالية',
  urgent: 'عاجلة',
};

export const NOTIFICATION_PRIORITY_COLORS: Record<NotificationPriority, string> = {
  low: 'gray',
  normal: 'blue',
  high: 'orange',
  urgent: 'red',
};