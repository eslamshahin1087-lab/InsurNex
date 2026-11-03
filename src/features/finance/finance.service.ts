import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  startAfter,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { computeFinancialSummary } from './financial-metrics';
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
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCommission(id: string): Promise<void> {
  await deleteDoc(doc(db, 'commissions', id));
}

// ---------- Summary ----------

const SUMMARY_PAGE_SIZE = 500;

async function listAllOrganizationRows<T>(
  collectionName: 'revenue' | 'expenses' | 'commissions',
  organizationId: string,
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: import('firebase/firestore').QueryDocumentSnapshot | undefined;

  while (true) {
    const baseQuery = query(
      collection(db, collectionName),
      where('organizationId', '==', organizationId),
    );
    const pageQuery = cursor
      ? query(baseQuery, startAfter(cursor), limit(SUMMARY_PAGE_SIZE))
      : query(baseQuery, limit(SUMMARY_PAGE_SIZE));
    const snapshot = await getDocs(pageQuery);

    rows.push(...snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T));
    if (snapshot.size < SUMMARY_PAGE_SIZE) break;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }

  return rows;
}

/**
 * Reads every organization-scoped financial row in pages. The 500-row cap is
 * retained for interactive list panels, but is never used as a total source.
 */
export async function loadFinanceSummary(organizationId: string): Promise<FinanceSummary> {
  if (!organizationId.trim()) throw new Error('FINANCE_ORGANIZATION_REQUIRED');
  const [revenue, expenses, commissions] = await Promise.all([
    listAllOrganizationRows<RevenueEntry>('revenue', organizationId),
    listAllOrganizationRows<ExpenseEntry>('expenses', organizationId),
    listAllOrganizationRows<CommissionEntry>('commissions', organizationId),
  ]);
  return computeSummary(revenue, expenses, commissions);
}

export function computeSummary(
  revenue: RevenueEntry[],
  expenses: ExpenseEntry[],
  commissions: CommissionEntry[],
): FinanceSummary {
  return computeFinancialSummary(revenue, expenses, commissions);
}