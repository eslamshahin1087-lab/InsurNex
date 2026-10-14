import type { SubscriptionPlan } from '../subscription/subscription.types';

export interface FinanceOverview {
  totalRevenue: number;
  totalSubtotal: number;
  totalVat: number;
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  monthlyChange: number;
  arpu: number;

  activeSubscriptions: number;
  trialSubscriptions: number;
  expiredSubscriptions: number;
  suspendedSubscriptions: number;
  expiringSoon: number;

  usedCodes: number;
  unusedCodes: number;
  revokedCodes: number;
  unusedValuePotential: number;
}

export interface MonthlyRevenue {
  month: string;
  monthLabel: string;
  revenue: number;
  subtotal: number;
  vat: number;
  transactions: number;
}

export interface Transaction {
  code: string;
  planType: SubscriptionPlan;
  planName: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  organizationId?: string;
  organizationName?: string;
  userName?: string;
  userEmail?: string;
  usedAt?: Date;
  usedAtRaw?: unknown;
}

export interface TopPayingOrg {
  organizationId: string;
  organizationName: string;
  totalPaid: number;
  transactionsCount: number;
  lastPaymentDate?: Date;
}

export interface ExpiringSubscription {
  organizationId: string;
  organizationName: string;
  endDate: string;
  daysRemaining: number;
  plan: SubscriptionPlan;
}

export interface FinanceFilters {
  monthsBack: 6 | 12;
}