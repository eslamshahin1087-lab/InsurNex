export type ReconciliationStatus = 'matched' | 'variance';
export type ReconciliationPaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface CommissionReconciliation {
  id: string;
  organizationId: string;
  commissionId: string;
  policyId: string;
  quoteId: string;
  insurerId: string;
  insurerName: string;
  policyNumber: string;
  currency: string;
  expectedCommissionAmount: number;
  statementNumber: string;
  statementDate: string;
  statementAmount: number;
  varianceAmount: number;
  reconciliationStatus: ReconciliationStatus;
  paymentStatus: ReconciliationPaymentStatus;
  receivedAmount: number;
  outstandingAmount: number;
  lastPaymentId?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CommissionPayment {
  id: string;
  organizationId: string;
  reconciliationId: string;
  commissionId: string;
  policyId: string;
  amount: number;
  currency: string;
  receivedDate: string;
  receiptReference?: string;
  createdBy: string;
  createdAt?: unknown;
}

export function toCurrencyMinorUnits(amount: number, currency: string): number;
export function fromCurrencyMinorUnits(minor: number, currency: string): number;
export function validateStatementReference(value: string): string;
export function validateDateOnly(value: string): string;
export function calculateStatementReconciliation(
  expectedAmount: number,
  statementAmount: number,
  currency: string,
): {
  expectedAmount: number;
  statementAmount: number;
  varianceAmount: number;
  varianceMinor: number;
  status: ReconciliationStatus;
};
export function allocateCommissionPayment(
  statementAmount: number,
  receivedAmount: number,
  paymentAmount: number,
  currency: string,
): {
  receivedAmount: number;
  outstandingAmount: number;
  paymentStatus: Exclude<ReconciliationPaymentStatus, 'unpaid'>;
  paymentMinor: number;
};
