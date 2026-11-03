import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { listCommissions } from './finance.service';
import {
  allocateCommissionPayment,
  calculateStatementReconciliation,
  validateDateOnly,
  validateStatementReference,
} from './commission-reconciliation';
import type { CommissionEntry } from './finance.types';
import type {
  CommissionPayment,
  CommissionReconciliation,
} from './commission-reconciliation';

const MAX_RECONCILIATION_ROWS = 500;

export async function listPolicyCommissionCandidates(organizationId: string): Promise<CommissionEntry[]> {
  const rows = await listCommissions(organizationId);
  return rows.filter((row) => row.source === 'policy_issuance' && row.policyId && row.insurerId && row.policyNumber);
}

export async function listCommissionReconciliations(
  organizationId: string,
): Promise<CommissionReconciliation[]> {
  if (!organizationId.trim()) throw new Error('FINANCE_ORGANIZATION_REQUIRED');
  const snapshot = await getDocs(query(
    collection(db, 'commissionReconciliations'),
    where('organizationId', '==', organizationId),
    limit(MAX_RECONCILIATION_ROWS),
  ));
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }) as CommissionReconciliation)
    .sort((a, b) => b.statementDate.localeCompare(a.statementDate));
}

export async function listCommissionPayments(
  organizationId: string,
  reconciliationId: string,
): Promise<CommissionPayment[]> {
  if (!organizationId.trim() || !reconciliationId.trim()) return [];
  const snapshot = await getDocs(query(
    collection(db, 'commissionPayments'),
    where('organizationId', '==', organizationId),
    where('reconciliationId', '==', reconciliationId),
    limit(MAX_RECONCILIATION_ROWS),
  ));
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }) as CommissionPayment)
    .sort((a, b) => b.receivedDate.localeCompare(a.receivedDate));
}

export interface CreateCommissionReconciliationInput {
  organizationId: string;
  commissionId: string;
  statementNumber: string;
  statementDate: string;
  statementAmount: number;
  uid: string;
}

export async function createCommissionReconciliation(
  input: CreateCommissionReconciliationInput,
): Promise<string> {
  if (!input.organizationId.trim() || !input.uid.trim() || !input.commissionId.trim()) {
    throw new Error('RECONCILIATION_CONTEXT_REQUIRED');
  }
  const statementNumber = validateStatementReference(input.statementNumber);
  const statementDate = validateDateOnly(input.statementDate);
  const reconciliationRef = doc(db, 'commissionReconciliations', input.commissionId);
  const commissionRef = doc(db, 'commissions', input.commissionId);

  await runTransaction(db, async (transaction) => {
    const [commissionSnapshot, reconciliationSnapshot] = await Promise.all([
      transaction.get(commissionRef),
      transaction.get(reconciliationRef),
    ]);
    if (!commissionSnapshot.exists()) throw new Error('COMMISSION_NOT_FOUND');
    if (reconciliationSnapshot.exists()) throw new Error('COMMISSION_ALREADY_RECONCILED');

    const commission = commissionSnapshot.data() as CommissionEntry;
    if (commission.organizationId !== input.organizationId) throw new Error('COMMISSION_ORGANIZATION_MISMATCH');
    if (commission.source !== 'policy_issuance' || !commission.policyId || !commission.insurerId || !commission.policyNumber) {
      throw new Error('POLICY_LINKED_COMMISSION_REQUIRED');
    }
    const comparison = calculateStatementReconciliation(
      commission.commissionAmount,
      input.statementAmount,
      commission.currency,
    );

    transaction.set(reconciliationRef, {
      organizationId: input.organizationId,
      commissionId: input.commissionId,
      policyId: commission.policyId,
      quoteId: commission.quoteId || '',
      insurerId: commission.insurerId,
      insurerName: commission.insurerName || '',
      policyNumber: commission.policyNumber,
      currency: commission.currency,
      expectedCommissionAmount: comparison.expectedAmount,
      statementNumber,
      statementDate,
      statementAmount: comparison.statementAmount,
      varianceAmount: comparison.varianceAmount,
      reconciliationStatus: comparison.status,
      paymentStatus: 'unpaid',
      receivedAmount: 0,
      outstandingAmount: comparison.statementAmount,
      createdBy: input.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return input.commissionId;
}

export interface RecordCommissionPaymentInput {
  organizationId: string;
  reconciliationId: string;
  amount: number;
  receivedDate: string;
  receiptReference?: string;
  uid: string;
}

export async function recordCommissionPayment(
  input: RecordCommissionPaymentInput,
): Promise<string> {
  if (!input.organizationId.trim() || !input.reconciliationId.trim() || !input.uid.trim()) {
    throw new Error('PAYMENT_CONTEXT_REQUIRED');
  }
  const receivedDate = validateDateOnly(input.receivedDate);
  const receiptReference = input.receiptReference?.trim() || '';
  if (receiptReference.length > 120) throw new Error('INVALID_RECEIPT_REFERENCE');

  const reconciliationRef = doc(db, 'commissionReconciliations', input.reconciliationId);
  const paymentRef = doc(collection(db, 'commissionPayments'));

  await runTransaction(db, async (transaction) => {
    const reconciliationSnapshot = await transaction.get(reconciliationRef);
    if (!reconciliationSnapshot.exists()) throw new Error('RECONCILIATION_NOT_FOUND');

    const reconciliation = reconciliationSnapshot.data() as CommissionReconciliation;
    if (reconciliation.organizationId !== input.organizationId) {
      throw new Error('RECONCILIATION_ORGANIZATION_MISMATCH');
    }
    const allocation = allocateCommissionPayment(
      reconciliation.statementAmount,
      reconciliation.receivedAmount,
      input.amount,
      reconciliation.currency,
    );

    transaction.set(paymentRef, {
      organizationId: input.organizationId,
      reconciliationId: input.reconciliationId,
      commissionId: reconciliation.commissionId,
      policyId: reconciliation.policyId,
      amount: allocation.paymentMinor / (10 ** (reconciliation.currency === 'JPY' ? 0 : 2)),
      currency: reconciliation.currency,
      receivedDate,
      ...(receiptReference ? { receiptReference } : {}),
      createdBy: input.uid,
      createdAt: serverTimestamp(),
    });
    transaction.update(reconciliationRef, {
      receivedAmount: allocation.receivedAmount,
      outstandingAmount: allocation.outstandingAmount,
      paymentStatus: allocation.paymentStatus,
      lastPaymentId: paymentRef.id,
      updatedAt: serverTimestamp(),
    });
  });

  return paymentRef.id;
}
