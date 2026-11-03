export type QuoteStatus = 'received' | 'shortlisted' | 'selected' | 'rejected' | 'issued';

export interface QuoteOffer {
  id: string;
  organizationId: string;
  rfqId: string;
  clientId: string;
  leadId?: string;
  insurerId: string;
  insurerName: string;
  quoteNumber?: string;
  premium: number;
  currency: string;
  commissionRate: number;
  commissionAmount: number;
  deductible: number | null;
  coverageSummary: string;
  paymentTerms: string;
  validUntil: string;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
  documentIds: string[];
  notes: string;
  status: QuoteStatus;
  policyId?: string;
  policyNumber?: string;
  issuedAt?: unknown;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CreateQuoteOfferInput {
  organizationId: string;
  rfqId: string;
  clientId: string;
  insurerId: string;
  insurerName: string;
  quoteNumber?: string;
  premium: number;
  currency: string;
  commissionRate: number;
  deductible?: number;
  coverageSummary: string;
  paymentTerms?: string;
  validUntil: string;
  effectiveStartDate?: string;
  effectiveEndDate?: string;
  documentIds?: string[];
  notes?: string;
  createdBy: string;
}

export interface IssuePolicyFromQuoteInput {
  organizationId: string;
  quoteId: string;
  policyNumber: string;
  startDate: string;
  expiryDate: string;
  followUpDate: string;
  uid: string;
}

export interface IssuePolicyFromQuoteResult {
  policyId: string;
  policyNumber: string;
  followUpTaskId: string;
  commissionId: string;
}
