// ============================================================
// src/types/document.ts
// أنواع الوثائق — موسّعة مع تتبع الانتهاء
// ============================================================

export type DocumentCategory =
  | 'policy'
  | 'claim'
  | 'client'
  | 'identity'
  | 'proposal'
  | 'correspondence'
  | 'invoice'
  | 'receipt'
  | 'other';

export type DocumentRelationType = 'client' | 'policy' | 'claim' | 'general';

export type DocumentStatus = 'active' | 'expired' | 'revoked' | 'pending_review';

// ------------------------------------------------------------
// الوثيقة (موسّعة)
// ------------------------------------------------------------
export interface DocumentRecord {
  id: string;
  organizationId: string;
  name: string;
  category: DocumentCategory;
  originalFileName: string;
  contentType: string;
  size: number;
  storagePath: string;
  downloadUrl: string;
  storageProvider?: 'supabase' | 'firebase';
  storageBucket?: string;
  relatedType: DocumentRelationType;
  relatedId: string;
  uploadedBy: string;
  notes: string;

  // ✅ حقول جديدة
  status: DocumentStatus;
  expiryDate?: string;            // تاريخ الانتهاء (إن وجد)
  issuedDate?: string;            // تاريخ الإصدار
  issuedBy?: string;              // الجهة المُصدِرة
  verified?: boolean;             // هل تم التحقق؟
  verifiedAt?: unknown;
  verifiedBy?: string;

  // ✅ تنبيهات
  lastNotifiedAt?: unknown;
  notificationCount?: number;

  // ✅ الوصف
  description?: string;
  tags?: string[];

  createdAt?: unknown;
  updatedAt?: unknown;
}

// ------------------------------------------------------------
// نموذج الرفع
// ------------------------------------------------------------
export interface DocumentUploadInput {
  organizationId: string;
  userId: string;
  name: string;
  category: DocumentCategory;
  relatedType: DocumentRelationType;
  relatedId: string;
  notes: string;
  file: File;
  expiryDate?: string;
  issuedDate?: string;
  issuedBy?: string;
  description?: string;
  tags?: string[];
}

// ------------------------------------------------------------
// إحصائيات الوثائق
// ------------------------------------------------------------
export interface DocumentStats {
  total: number;
  active: number;
  expired: number;
  pendingReview: number;
  expiringIn30Days: number;
  expiringIn7Days: number;
  byCategory: Record<DocumentCategory, number>;
  totalSize: number;
}

// ------------------------------------------------------------
// تسميات عربية
// ------------------------------------------------------------
export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  policy: 'بوليصة',
  claim: 'مطالبة',
  client: 'عميل',
  identity: 'هوية',
  proposal: 'عرض',
  correspondence: 'مراسلات',
  invoice: 'فاتورة',
  receipt: 'إيصال',
  other: 'أخرى',
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  active: 'نشطة',
  expired: 'منتهية',
  revoked: 'ملغاة',
  pending_review: 'قيد المراجعة',
};

export const DOCUMENT_STATUS_COLORS: Record<DocumentStatus, string> = {
  active: 'green',
  expired: 'red',
  revoked: 'gray',
  pending_review: 'orange',
};