export type RevenueType = 'premium' | 'commission' | 'fee' | 'outstanding';
export type ExpenseCategory = 'operational' | 'marketing' | 'staff' | 'other';
export type CommissionStatus = 'pending' | 'received';
export type EntryStatus = 'confirmed' | 'pending' | 'cancelled';

export interface RevenueEntry {
  id: string;
  organizationId: string;
  type: RevenueType;
  amount: number;
  currency: string;
  clientId?: string;
  clientName?: string;
  policyId?: string;
  policyNumber?: string;
  date: string;
  status: EntryStatus;
  notes?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface ExpenseEntry {
  id: string;
  organizationId: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  date: string;
  description: string;
  notes?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface CommissionEntry {
  id: string;
  organizationId: string;
  policyId?: string;
  policyNumber?: string;
  clientId?: string;
  clientName?: string;
  insurerId?: string;
  insurerName?: string;
  premium: number;
  commissionRate: number;
  commissionAmount: number;
  currency: string;
  status: CommissionStatus;
  expectedDate?: string;
  receivedDate?: string;
  notes?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface FinanceSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  pendingCommissions: number;
  receivedCommissions: number;
}

export const REVENUE_TYPE_LABELS: Record<RevenueType, string> = {
  premium: 'أقساط',
  commission: 'عمولات',
  fee: 'رسوم',
  outstanding: 'متأخرات',
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  operational: 'تشغيلية',
  marketing: 'تسويق',
  staff: 'رواتب',
  other: 'أخرى',
};

export const COMMISSION_STATUS_LABELS: Record<CommissionStatus, string> = {
  pending: 'معلقة',
  received: 'مستلمة',
};

export const ENTRY_STATUS_LABELS: Record<EntryStatus, string> = {
  confirmed: 'مؤكد',
  pending: 'معلق',
  cancelled: 'ملغى',
};