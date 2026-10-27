// ============================================================
// src/types/insurance.ts
// أنواع التأمين — بوليصات، شركات، دورة حياة
// ============================================================

// ------------------------------------------------------------
// الأنواع الأساسية
// ------------------------------------------------------------
export type PolicyStatus = 'active' | 'pending' | 'expired' | 'cancelled' | 'renewed';

export type InsuranceLine =
  | 'medical'
  | 'motor'
  | 'property'
  | 'marine'
  | 'life'
  | 'liability'
  | 'other';

export type RenewalStatus =
  | 'pending'
  | 'in_progress'
  | 'quoted'
  | 'completed'
  | 'cancelled';

// ------------------------------------------------------------
// شركة التأمين
// ------------------------------------------------------------
export interface Insurer {
  id: string;
  organizationId: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  status: 'active' | 'inactive';
  createdAt?: unknown;
}

// ------------------------------------------------------------
// البوليصة (موسّعة)
// ------------------------------------------------------------
export interface Policy {
  id: string;
  organizationId: string;
  clientId: string;
  clientName: string;
  insurerId: string;
  insurerName: string;
  policyNumber: string;
  line: InsuranceLine;
  product: string;
  startDate: string;
  expiryDate: string;
  premium: number;
  commissionRate: number;
  commissionAmount: number;
  currency: string;
  status: PolicyStatus;
  coverage: string;
  createdBy: string;

  // ✅ حقول جديدة لدورة الحياة
  issuedAt?: string;              // تاريخ الإصدار الفعلي
  renewedAt?: string;             // تاريخ آخر تجديد
  cancelledAt?: string;           // تاريخ الإلغاء
  cancellationReason?: string;    // سبب الإلغاء
  expiredAt?: string;             // تاريخ الانتهاء الفعلي

  // ✅ ربط بالبوليصة السابقة (عند التجديد)
  previousPolicyId?: string;      // البوليصة السابقة (التي تم تجديدها)
  renewalChain: string[];         // سلسلة التجديدات

  // ✅ البوليصة التالية (بعد التجديد)
  nextPolicyId?: string;

  // ✅ تنبيهات
  lastNotifiedAt?: unknown;       // آخر إشعار انتهاء
  renewalReminderSentAt?: unknown;

  // ✅ وثائق مرتبطة
  documentIds?: string[];         // وثائق البوليصة

  // ✅ حقول من النظام القديم
  rfqId?: string;
  quoteId?: string;
  operationId?: string;
  documentId?: string;

  createdAt?: unknown;
  updatedAt?: unknown;
}

// ------------------------------------------------------------
// نموذج إدخال البوليصة
// ------------------------------------------------------------
export type PolicyInput = Omit<
  Policy,
  | 'id'
  | 'organizationId'
  | 'clientName'
  | 'insurerName'
  | 'commissionAmount'
  | 'createdBy'
  | 'createdAt'
  | 'updatedAt'
  | 'renewedAt'
  | 'cancelledAt'
  | 'cancellationReason'
  | 'expiredAt'
  | 'previousPolicyId'
  | 'renewalChain'
  | 'nextPolicyId'
  | 'lastNotifiedAt'
  | 'renewalReminderSentAt'
  | 'documentIds'
>;

// ------------------------------------------------------------
// طلب التجديد
// ------------------------------------------------------------
export interface RenewalRequest {
  id: string;
  organizationId: string;
  policyId: string;
  policyNumber: string;
  clientId: string;
  clientName: string;
  insurerId: string;
  insurerName: string;

  requestedBy: string;
  requestedAt: string;

  status: RenewalStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';

  // البيانات المطلوبة للتجديد
  newPremium?: number;
  newStartDate?: string;
  newExpiryDate?: string;
  newCoverage?: string;
  notes?: string;

  // النتيجة
  newPolicyId?: string;
  completedAt?: string;
  cancelledReason?: string;

  createdAt?: unknown;
  updatedAt?: unknown;
}

// ------------------------------------------------------------
// إحصائيات البوليصات
// ------------------------------------------------------------
export interface PolicyStats {
  total: number;
  active: number;
  pending: number;
  expired: number;
  cancelled: number;
  expiringIn30Days: number;
  expiringIn7Days: number;
  totalPremium: number;
  totalCommission: number;
  byLine: Record<InsuranceLine, number>;
}

// ------------------------------------------------------------
// تسميات عربية
// ------------------------------------------------------------
export const POLICY_STATUS_LABELS: Record<PolicyStatus, string> = {
  active: 'نشطة',
  pending: 'قيد الإصدار',
  expired: 'منتهية',
  cancelled: 'ملغاة',
  renewed: 'مجددة',
};

export const INSURANCE_LINE_LABELS: Record<InsuranceLine, string> = {
  medical: 'طبي',
  motor: 'سيارات',
  property: 'ممتلكات',
  marine: 'بحري',
  life: 'حياة',
  liability: 'مسؤوليات',
  other: 'أخرى',
};

export const RENEWAL_STATUS_LABELS: Record<RenewalStatus, string> = {
  pending: 'معلّق',
  in_progress: 'قيد التنفيذ',
  quoted: 'تم التسعير',
  completed: 'مكتمل',
  cancelled: 'ملغى',
};

export const POLICY_STATUS_COLORS: Record<PolicyStatus, string> = {
  active: 'green',
  pending: 'blue',
  expired: 'red',
  cancelled: 'gray',
  renewed: 'purple',
};