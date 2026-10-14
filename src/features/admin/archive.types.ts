export type ArchiveType =
  | 'code'
  | 'user'
  | 'subscription'
  | 'organization'
  | 'ad'
  | 'document';

export type ArchiveAction = 'deleted' | 'revoked' | 'suspended' | 'expired';

export type ArchiveSource =
  | 'admin-codes'
  | 'admin-users'
  | 'admin-subscriptions'
  | 'admin-organizations'
  | 'admin-ads'
  | 'admin-panel';

export interface ArchiveEntry {
  id: string;
  type: ArchiveType;
  action: ArchiveAction;
  source: ArchiveSource;
  sourceLabel: string;
  deletedBy: string;
  deletedByName: string;
  deletedByEmail?: string;
  deletedAt?: unknown;
  reason?: string;
  data: Record<string, unknown>;
  restoredAt?: unknown;
  restoredBy?: string;
}

export const ARCHIVE_TYPE_LABELS: Record<ArchiveType, string> = {
  code: 'أكواد',
  user: 'مستخدمون',
  subscription: 'اشتراكات',
  organization: 'مؤسسات',
  ad: 'إعلانات',
  document: 'مستندات',
};

export const ARCHIVE_ACTION_LABELS: Record<ArchiveAction, string> = {
  deleted: 'محذوف',
  revoked: 'ملغى',
  suspended: 'موقوف',
  expired: 'منتهي',
};

export const ARCHIVE_SOURCE_LABELS: Record<ArchiveSource, string> = {
  'admin-codes': 'صفحة الأكواد',
  'admin-users': 'صفحة المستخدمين',
  'admin-subscriptions': 'صفحة الاشتراكات',
  'admin-organizations': 'صفحة المؤسسات',
  'admin-ads': 'صفحة الإعلانات',
  'admin-panel': 'لوحة التحكم',
};