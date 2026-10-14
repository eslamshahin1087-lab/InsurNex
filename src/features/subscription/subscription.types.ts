export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'suspended';
export type SubscriptionPlan = 'trial' | 'monthly' | 'yearly' | 'yearly_discount';

export interface OrganizationSubscription {
  organizationId: string;
  status: SubscriptionStatus;
  plan: SubscriptionPlan;
  startDate: string;
  endDate: string;
  trialEndsAt?: string;
  lastCodeUsed?: string;
  ownerId?: string;
  updatedAt?: unknown;
  createdAt?: unknown;
}

export type CodeStatus = 'unused' | 'used' | 'revoked';

export interface SubscriptionCodeUsedBy {
  organizationId: string;
  uid: string;
  userName?: string;
  userEmail?: string;
  usedAt?: unknown;
}

export interface SubscriptionCode {
  code: string;
  status: CodeStatus;
  planType: SubscriptionPlan;
  planName: string;
  duration: number;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  currency: string;
  createdAt?: unknown;
  createdBy?: string;
  createdByName?: string;
  usedBy?: SubscriptionCodeUsedBy;
  usedAt?: unknown;
  notes?: string;
}

export interface PaymentInfo {
  instaPay: string;
  vodafoneCash: string;
  orangeCash?: string;
  etisalatCash?: string;
  bankTransfer?: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    iban?: string;
  };
  whatsappContact: string;
  email: string;
}