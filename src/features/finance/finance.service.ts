import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type {
  CommissionEntry,
  ExpenseEntry,
  FinanceSummary,
  RevenueEntry,
} from './finance.types';

const MAX_ROWS = 500;

// ---------- Revenue ----------

export async function listRevenue(organizationId: string): Promise<RevenueEntry[]> {
  const q = query(
    collection(db, 'revenue'),
    where('organizationId', '==', organizationId),
    orderBy('date', 'desc'),
    limit(MAX_ROWS),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as RevenueEntry));
}

export async function createRevenue(
  data: Omit<RevenueEntry, 'id' | 'createdAt' | 'createdBy'>,
  userId: string,
): Promise<string> {
  const ref = await addDoc(collection(db, 'revenue'), {
    ...data,
    createdAt: serverTimestamp(),
    createdBy: userId,
  });
  return ref.id;
}

export async function deleteRevenue(id: string): Promise<void> {
  await deleteDoc(doc(db, 'revenue', id));
}

// ---------- Expenses ----------

export async function listExpenses(organizationId: string): Promise<ExpenseEntry[]> {
  const q = query(
    collection(db, 'expenses'),
    where('organizationId', '==', organizationId),
    orderBy('date', 'desc'),
    limit(MAX_ROWS),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExpenseEntry));
}

export async function createExpense(
  data: Omit<ExpenseEntry, 'id' | 'createdAt' | 'createdBy'>,
  userId: string,
): Promise<string> {
  const ref = await addDoc(collection(db, 'expenses'), {
    ...data,
    createdAt: serverTimestamp(),
    createdBy: userId,
  });
  return ref.id;
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, 'expenses', id));
}

// ---------- Commissions ----------

export async function listCommissions(organizationId: string): Promise<CommissionEntry[]> {
  const q = query(
    collection(db, 'commissions'),
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
    limit(MAX_ROWS),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CommissionEntry));
}

export async function createCommission(
  data: Omit<CommissionEntry, 'id' | 'createdAt' | 'createdBy'>,
  userId: string,
): Promise<string> {
  const ref = await addDoc(collection(db, 'commissions'), {
    ...data,
    createdAt: serverTimestamp(),
    createdBy: userId,
  });
  return ref.id;
}

export async function markCommissionReceived(id: string, receivedDate: string): Promise<void> {
  await updateDoc(doc(db, 'commissions', id), {
    status: 'received',
    receivedDate,
  });
}

export async function deleteCommission(id: string): Promise<void> {
  await deleteDoc(doc(db, 'commissions', id));
}

// ---------- Summary ----------

export function computeSummary(
  revenue: RevenueEntry[],
  expenses: ExpenseEntry[],
  commissions: CommissionEntry[],
): FinanceSummary {
  const totalRevenue = revenue
    .filter((r) => r.status === 'confirmed')
    .reduce((sum, r) => sum + (r.amount || 0), 0);

  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const pendingCommissions = commissions
    .filter((c) => c.status === 'pending')
    .reduce((sum, c) => sum + (c.commissionAmount || 0), 0);

  const receivedCommissions = commissions
    .filter((c) => c.status === 'received')
    .reduce((sum, c) => sum + (c.commissionAmount || 0), 0);

  return {
    totalRevenue,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
    pendingCommissions,
    receivedCommissions,
  };
}