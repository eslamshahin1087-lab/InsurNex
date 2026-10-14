import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type {
  OrganizationSubscription,
  SubscriptionCode,
} from '../subscription/subscription.types';
import type {
  ExpiringSubscription,
  FinanceOverview,
  MonthlyRevenue,
  TopPayingOrg,
  Transaction,
} from './finance.types';

// ============================================================
// HELPERS
// ============================================================

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  const v = value as { toDate?: () => Date; seconds?: number };
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  return undefined;
}

function tsSeconds(value: unknown): number {
  if (!value) return 0;
  const v = value as { seconds?: number; toDate?: () => Date };
  if (typeof v.seconds === 'number') return v.seconds;
  if (typeof v.toDate === 'function') return Math.floor(v.toDate().getTime() / 1000);
  return 0;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(d: Date): string {
  return new Intl.DateTimeFormat('ar-EG', { month: 'short', year: '2-digit' }).format(d);
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(`${a}T00:00:00`).getTime();
  const d2 = new Date(`${b}T00:00:00`).getTime();
  return Math.round((d2 - d1) / 86400000);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// ============================================================
// FETCH ALL DATA (bounded)
// ============================================================

interface RawData {
  usedCodes: SubscriptionCode[];
  unusedCodesCount: number;
  revokedCodesCount: number;
  unusedValue: number;
  subscriptions: OrganizationSubscription[];
  orgNames: Record<string, string>;
}

async function fetchRawData(): Promise<RawData> {
  const usedQ = query(
    collection(db, 'subscriptionCodes'),
    where('status', '==', 'used'),
    limit(2000),
  );

  const unusedQ = query(
    collection(db, 'subscriptionCodes'),
    where('status', '==', 'unused'),
    limit(2000),
  );

  const revokedQ = query(
    collection(db, 'subscriptionCodes'),
    where('status', '==', 'revoked'),
    limit(2000),
  );

  const subsQ = query(
    collection(db, 'organizationSubscriptions'),
    limit(2000),
  );

  const [usedSnap, unusedSnap, revokedSnap, subsSnap] = await Promise.all([
    getDocs(usedQ),
    getDocs(unusedQ),
    getDocs(revokedQ),
    getDocs(subsQ),
  ]);

  const usedCodes = usedSnap.docs.map(
    (d) => ({ code: d.id, ...d.data() } as SubscriptionCode),
  );

  usedCodes.sort((a, b) => tsSeconds(b.usedAt) - tsSeconds(a.usedAt));

  const unusedCodes = unusedSnap.docs.map(
    (d) => ({ code: d.id, ...d.data() } as SubscriptionCode),
  );

  const subscriptions = subsSnap.docs.map(
    (d) => d.data() as OrganizationSubscription,
  );

  const orgIds = new Set<string>();
  usedCodes.forEach((c) => {
    if (c.usedBy?.organizationId) orgIds.add(c.usedBy.organizationId);
  });
  subscriptions.forEach((s) => {
    if (s.organizationId) orgIds.add(s.organizationId);
  });

  const orgNames: Record<string, string> = {};
  await Promise.all(
    Array.from(orgIds).map(async (id) => {
      try {
        const snap = await getDoc(doc(db, 'organizations', id));
        if (snap.exists()) {
          const d = snap.data() as { name?: string };
          orgNames[id] = d.name || id.slice(0, 8);
        }
      } catch {
        /* ignore */
      }
    }),
  );

  const unusedValue = unusedCodes.reduce((sum, c) => sum + (c.total || 0), 0);

  return {
    usedCodes,
    unusedCodesCount: unusedSnap.size,
    revokedCodesCount: revokedSnap.size,
    unusedValue,
    subscriptions,
    orgNames,
  };
}

// ============================================================
// OVERVIEW
// ============================================================

export async function getFinanceOverview(): Promise<FinanceOverview> {
  const raw = await fetchRawData();

  const totalSubtotal = raw.usedCodes.reduce((s, c) => s + (c.subtotal || 0), 0);
  const totalVat = raw.usedCodes.reduce((s, c) => s + (c.vatAmount || 0), 0);
  const totalRevenue = raw.usedCodes.reduce((s, c) => s + (c.total || 0), 0);

  const now = new Date();
  const thisMonth = monthKey(now);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = monthKey(lastMonthDate);

  let thisMonthRevenue = 0;
  let lastMonthRevenue = 0;
  for (const c of raw.usedCodes) {
    const d = toDate(c.usedAt);
    if (!d) continue;
    const k = monthKey(d);
    if (k === thisMonth) thisMonthRevenue += c.total || 0;
    if (k === lastMonth) lastMonthRevenue += c.total || 0;
  }

  const monthlyChange =
    lastMonthRevenue > 0
      ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 1000) / 10
      : thisMonthRevenue > 0
      ? 100
      : 0;

  const uniquePaidOrgs = new Set(
    raw.usedCodes.map((c) => c.usedBy?.organizationId).filter(Boolean),
  );
  const arpu = uniquePaidOrgs.size > 0 ? totalRevenue / uniquePaidOrgs.size : 0;

  const today = todayIso();
  let active = 0;
  let trial = 0;
  let expired = 0;
  let suspended = 0;
  let expiringSoon = 0;

  for (const s of raw.subscriptions) {
    if (s.status === 'suspended') suspended++;
    else if (s.status === 'trial') {
      trial++;
      if (s.endDate < today) expired++;
    } else if (s.status === 'active') {
      if (s.endDate < today) expired++;
      else active++;
    }

    if (s.endDate >= today) {
      const days = daysBetween(today, s.endDate);
      if (days <= 30) expiringSoon++;
    }
  }

  return {
    totalRevenue,
    totalSubtotal,
    totalVat,
    thisMonthRevenue,
    lastMonthRevenue,
    monthlyChange,
    arpu,
    activeSubscriptions: active,
    trialSubscriptions: trial,
    expiredSubscriptions: expired,
    suspendedSubscriptions: suspended,
    expiringSoon,
    usedCodes: raw.usedCodes.length,
    unusedCodes: raw.unusedCodesCount,
    revokedCodes: raw.revokedCodesCount,
    unusedValuePotential: raw.unusedValue,
  };
}

// ============================================================
// MONTHLY REVENUE
// ============================================================

export async function getMonthlyRevenue(monthsBack = 6): Promise<MonthlyRevenue[]> {
  const raw = await fetchRawData();
  const now = new Date();
  const buckets: Record<string, MonthlyRevenue> = {};

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = monthKey(d);
    buckets[k] = {
      month: k,
      monthLabel: monthLabel(d),
      revenue: 0,
      subtotal: 0,
      vat: 0,
      transactions: 0,
    };
  }

  for (const c of raw.usedCodes) {
    const d = toDate(c.usedAt);
    if (!d) continue;
    const k = monthKey(d);
    if (!buckets[k]) continue;
    buckets[k].revenue += c.total || 0;
    buckets[k].subtotal += c.subtotal || 0;
    buckets[k].vat += c.vatAmount || 0;
    buckets[k].transactions += 1;
  }

  return Object.values(buckets);
}

// ============================================================
// RECENT TRANSACTIONS
// ============================================================

export async function getRecentTransactions(limitCount = 20): Promise<Transaction[]> {
  const raw = await fetchRawData();

  return raw.usedCodes.slice(0, limitCount).map((c) => {
    const orgId = c.usedBy?.organizationId;
    return {
      code: c.code,
      planType: c.planType,
      planName: c.planName,
      duration: c.duration,
      subtotal: c.subtotal || 0,
      vatAmount: c.vatAmount || 0,
      total: c.total || 0,
      organizationId: orgId,
      organizationName: orgId ? raw.orgNames[orgId] : undefined,
      userName: c.usedBy?.userName,
      userEmail: c.usedBy?.userEmail,
      usedAt: toDate(c.usedAt),
      usedAtRaw: c.usedAt,
    };
  });
}

// ============================================================
// TOP PAYING ORGANIZATIONS
// ============================================================

export async function getTopPayingOrganizations(limitCount = 10): Promise<TopPayingOrg[]> {
  const raw = await fetchRawData();

  const map: Record<string, TopPayingOrg> = {};

  for (const c of raw.usedCodes) {
    const orgId = c.usedBy?.organizationId;
    if (!orgId) continue;
    if (!map[orgId]) {
      map[orgId] = {
        organizationId: orgId,
        organizationName: raw.orgNames[orgId] || orgId.slice(0, 8),
        totalPaid: 0,
        transactionsCount: 0,
      };
    }
    map[orgId].totalPaid += c.total || 0;
    map[orgId].transactionsCount += 1;
    const d = toDate(c.usedAt);
    if (d && (!map[orgId].lastPaymentDate || d > map[orgId].lastPaymentDate!)) {
      map[orgId].lastPaymentDate = d;
    }
  }

  return Object.values(map)
    .sort((a, b) => b.totalPaid - a.totalPaid)
    .slice(0, limitCount);
}

// ============================================================
// EXPIRING SOON
// ============================================================

export async function getExpiringSoon(days = 30): Promise<ExpiringSubscription[]> {
  const raw = await fetchRawData();
  const today = todayIso();
  const result: ExpiringSubscription[] = [];

  for (const s of raw.subscriptions) {
    if (s.endDate < today) continue;
    const remaining = daysBetween(today, s.endDate);
    if (remaining > days) continue;
    result.push({
      organizationId: s.organizationId,
      organizationName: raw.orgNames[s.organizationId] || s.organizationId.slice(0, 8),
      endDate: s.endDate,
      daysRemaining: remaining,
      plan: s.plan,
    });
  }

  return result.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

// ============================================================
// CSV EXPORT
// ============================================================

export function exportTransactionsToCSV(rows: Transaction[], filename = 'transactions.csv') {
  const headers = [
    'الكود',
    'الخطة',
    'قبل الضريبة',
    'الضريبة',
    'الإجمالي',
    'المؤسسة',
    'المستخدم',
    'التاريخ',
  ];

  const lines = [headers.join(',')];

  for (const t of rows) {
    const date = t.usedAt ? t.usedAt.toISOString().slice(0, 10) : '';
    const row = [
      t.code,
      t.planName || t.planType,
      t.subtotal.toFixed(2),
      t.vatAmount.toFixed(2),
      t.total.toFixed(2),
      `"${t.organizationName || ''}"`,
      `"${t.userName || ''}"`,
      date,
    ];
    lines.push(row.join(','));
  }

  const blob = new Blob(['\uFEFF' + lines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}