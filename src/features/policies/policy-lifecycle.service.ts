// ============================================================
// src/features/policies/policy-lifecycle.service.ts
// خدمة دورة حياة البوليصة — تجديد، إلغاء، انتهاء، إحصائيات
// ============================================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type {
  Policy,
  PolicyStatus,
  PolicyStats,
  RenewalRequest,
  RenewalStatus,
  InsuranceLine,
} from '../../types/insurance';

// ============================================================
// أدوات مساعدة
// ============================================================

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'string') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Timestamp(
      (value as { seconds: number }).seconds,
      (value as { nanoseconds?: number }).nanoseconds || 0,
    ).toDate();
  }
  return null;
}

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / 86400000);
}

// ============================================================
// ✅ دالة التحويل (المطابقة للبيانات الفعلية)
// ============================================================
function mapPolicy(id: string, data: Record<string, unknown>): Policy {
  // تحويل نوع التأمين
  const rawType = String(data.line || data.insuranceType || 'other').toLowerCase();
  const validLines: InsuranceLine[] = ['medical', 'motor', 'property', 'marine', 'life', 'liability', 'other'];
  const line = validLines.includes(rawType as InsuranceLine) ? (rawType as InsuranceLine) : 'other';

  return {
    id,
    ...data,

    // مطابقة الحقول القديمة والجديدة
    line,
    startDate: (data.startDate || data.effectiveDate || '') as string,
    insurerName: (data.insurerName || data.insurerId || 'شركة غير محددة') as string,

    // قيم افتراضية آمنة
    policyNumber: (data.policyNumber || 'غير محدد') as string,
    premium: Number(data.premium || 0),
    commissionAmount: Number(data.commissionAmount || 0),
    commissionRate: Number(data.commissionRate || 0),
    currency: (data.currency || 'EGP') as string,
    status: (data.status || 'active') as PolicyStatus,

    // مصفوفات
    renewalChain: Array.isArray(data.renewalChain) ? data.renewalChain : [],
    documentIds: Array.isArray(data.documentIds) ? data.documentIds : [],
  } as Policy;
}

// ============================================================
// 1. جلب البوليصات المنتهية أو التي على وشك الانتهاء
// ============================================================

export async function getExpiringPolicies(
  organizationId: string,
  daysAhead = 30,
): Promise<Array<Policy & { daysLeft: number }>> {
  const now = new Date();
  const future = new Date();
  future.setDate(now.getDate() + daysAhead);

  const nowISO = now.toISOString().slice(0, 10);
  const futureISO = future.toISOString().slice(0, 10);

  const q = query(
    collection(db, 'policies'),
    where('organizationId', '==', organizationId),
    where('status', '==', 'active'),
    where('expiryDate', '>=', nowISO),
    where('expiryDate', '<=', futureISO),
    orderBy('expiryDate', 'asc'),
    limit(200),
  );

  const snap = await getDocs(q);
  const policies = snap.docs.map((d) => mapPolicy(d.id, d.data()));

  return policies.map((p) => {
    const expiry = new Date(p.expiryDate);
    const daysLeft = daysBetween(now, expiry);
    return { ...p, daysLeft };
  });
}

// ============================================================
// 2. جلب البوليصات المنتهية فعلياً
// ============================================================

export async function getExpiredPolicies(
  organizationId: string,
): Promise<Array<Policy & { daysOverdue: number }>> {
  const now = new Date();
  const nowISO = now.toISOString().slice(0, 10);

  const q = query(
    collection(db, 'policies'),
    where('organizationId', '==', organizationId),
    where('status', '==', 'active'),
    where('expiryDate', '<', nowISO),
    orderBy('expiryDate', 'asc'),
    limit(200),
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const p = mapPolicy(d.id, d.data());
    const expiry = new Date(p.expiryDate);
    return { ...p, daysOverdue: Math.abs(daysBetween(now, expiry)) };
  });
}

// ============================================================
// 3. تعليم بوليصة كمنتهية
// ============================================================

export async function expirePolicy(policyId: string): Promise<void> {
  await updateDoc(doc(db, 'policies', policyId), {
    status: 'expired' as PolicyStatus,
    expiredAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// 4. إلغاء بوليصة
// ============================================================

export async function cancelPolicy(
  policyId: string,
  reason: string,
): Promise<void> {
  await updateDoc(doc(db, 'policies', policyId), {
    status: 'cancelled' as PolicyStatus,
    cancelledAt: new Date().toISOString(),
    cancellationReason: reason,
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// 5. تجديد بوليصة — ينشئ بوليصة جديدة + يحدّث القديمة
// ============================================================

export interface RenewPolicyInput {
  originalPolicy: Policy;
  uid: string;
  newStartDate: string;
  newExpiryDate: string;
  newPremium: number;
  newCommissionRate?: number;
  newCoverage?: string;
  newPolicyNumber?: string;
  notes?: string;
}

export async function renewPolicy(
  input: RenewPolicyInput,
): Promise<{ newPolicyId: string }> {
  const {
    originalPolicy,
    uid,
    newStartDate,
    newExpiryDate,
    newPremium,
    newCommissionRate,
    newCoverage,
    newPolicyNumber: providedPolicyNumber,
    notes,
  } = input;

  if (!newStartDate || !newExpiryDate) throw new Error('MISSING_DATES');
  if (newStartDate >= newExpiryDate) throw new Error('INVALID_DATE_RANGE');
  if (newPremium < 0) throw new Error('INVALID_PREMIUM');

  const commissionRate = newCommissionRate ?? originalPolicy.commissionRate;
  const commissionAmount = Number(((newPremium * commissionRate) / 100).toFixed(2));
  const newPolicyNumber = providedPolicyNumber || `${originalPolicy.policyNumber}-R${Date.now().toString().slice(-4)}`;

  // 2. أنشئ البوليصة الجديدة (مع دعم الحقول القديمة)
  const newPolicyData: Record<string, unknown> = {
    organizationId: originalPolicy.organizationId,
    clientId: originalPolicy.clientId,
    clientName: originalPolicy.clientName,
    insurerId: originalPolicy.insurerId || originalPolicy.insurerName,
    insurerName: originalPolicy.insurerName,
    policyNumber: newPolicyNumber,
    line: originalPolicy.line,
    insuranceType: originalPolicy.line, // للتوافق
    product: originalPolicy.product || '',
    startDate: newStartDate,
    effectiveDate: newStartDate, // للتوافق
    expiryDate: newExpiryDate,
    premium: newPremium,
    commissionRate,
    commissionAmount,
    currency: originalPolicy.currency,
    status: 'active' as PolicyStatus,
    coverage: newCoverage || originalPolicy.coverage || '',
    createdBy: uid,
    previousPolicyId: originalPolicy.id,
    renewalChain: [...(originalPolicy.renewalChain || []), originalPolicy.id],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const newPolicyRef = await addDoc(collection(db, 'policies'), newPolicyData);
  const newPolicyId = newPolicyRef.id;

  // 3. حدّث البوليصة القديمة
  await updateDoc(doc(db, 'policies', originalPolicy.id), {
    status: 'renewed' as PolicyStatus,
    renewedAt: new Date().toISOString(),
    nextPolicyId: newPolicyId,
    updatedAt: serverTimestamp(),
  });

  // 4. أضف حدث في timeline العميل
  try {
    await addDoc(collection(db, 'clients', originalPolicy.clientId, 'timeline'), {
      clientId: originalPolicy.clientId,
      organizationId: originalPolicy.organizationId,
      type: 'policy_renewed',
      title: `تم تجديد البوليصة ${originalPolicy.policyNumber}`,
      description: `البوليصة الجديدة: ${newPolicyNumber}`,
      by: uid,
      byName: 'System',
      at: serverTimestamp(),
      metadata: {
        oldPolicyId: originalPolicy.id,
        newPolicyId,
        oldPolicyNumber: originalPolicy.policyNumber,
        newPolicyNumber,
        newPremium,
        notes: notes || '',
      },
    });
  } catch (e) {
    console.warn('Timeline entry failed:', e);
  }

  // 5. أنشئ إشعاراً بالتجديد
  try {
    await addDoc(collection(db, 'notifications'), {
      type: 'policy_renewed',
      priority: 'normal',
      title: `✅ تم تجديد البوليصة ${originalPolicy.policyNumber}`,
      body: `تم تجديد بوليصة العميل ${originalPolicy.clientName}. البوليصة الجديدة: ${newPolicyNumber}`,
      organizationId: originalPolicy.organizationId,
      userId: originalPolicy.createdBy || null,
      clientId: originalPolicy.clientId,
      policyId: newPolicyId,
      link: `/policies/${newPolicyId}`,
      read: false,
      channels: ['in_app'],
      metadata: {
        oldPolicyNumber: originalPolicy.policyNumber,
        newPolicyNumber,
        newPremium,
      },
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('Notification creation failed:', e);
  }

  return { newPolicyId };
}

// ============================================================
// 6. إحصائيات البوليصات
// ============================================================

export async function getPolicyStats(
  organizationId: string,
): Promise<PolicyStats> {
  const q = query(
    collection(db, 'policies'),
    where('organizationId', '==', organizationId),
    limit(500),
  );
  const snap = await getDocs(q);
  const policies = snap.docs.map((d) => mapPolicy(d.id, d.data()));

  const now = new Date();
  const in7Days = new Date();
  in7Days.setDate(now.getDate() + 7);
  const in30Days = new Date();
  in30Days.setDate(now.getDate() + 30);

  const byLine: Record<InsuranceLine, number> = {
    medical: 0,
    motor: 0,
    property: 0,
    marine: 0,
    life: 0,
    liability: 0,
    other: 0,
  };

  const stats: PolicyStats = {
    total: policies.length,
    active: 0,
    pending: 0,
    expired: 0,
    cancelled: 0,
    expiringIn30Days: 0,
    expiringIn7Days: 0,
    totalPremium: 0,
    totalCommission: 0,
    byLine,
  };

  for (const p of policies) {
    if (p.status === 'active') stats.active++;
    else if (p.status === 'pending') stats.pending++;
    else if (p.status === 'expired') stats.expired++;
    else if (p.status === 'cancelled') stats.cancelled++;

    stats.totalPremium += Number(p.premium) || 0;
    stats.totalCommission += Number(p.commissionAmount) || 0;

    if (byLine[p.line] !== undefined) {
      byLine[p.line]++;
    } else {
      byLine.other++;
    }

    if (p.status === 'active' && p.expiryDate) {
      const expiry = new Date(p.expiryDate);
      if (expiry >= now && expiry <= in30Days) stats.expiringIn30Days++;
      if (expiry >= now && expiry <= in7Days) stats.expiringIn7Days++;
    }
  }

  return stats;
}

// ============================================================
// 7. سجل بوليصات العميل (مع سلسلة التجديدات)
// ============================================================

export async function getClientPolicyHistory(
  organizationId: string,
  clientId: string,
): Promise<Policy[]> {
  const q = query(
    collection(db, 'policies'),
    where('organizationId', '==', organizationId),
    where('clientId', '==', clientId),
    orderBy('createdAt', 'desc'),
    limit(100),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapPolicy(d.id, d.data()));
}

// ============================================================
// 8. طلبات التجديد
// ============================================================

export async function createRenewalRequest(input: {
  organizationId: string;
  policy: Policy;
  uid: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  notes?: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, 'renewalRequests'), {
    organizationId: input.organizationId,
    policyId: input.policy.id,
    policyNumber: input.policy.policyNumber,
    clientId: input.policy.clientId,
    clientName: input.policy.clientName,
    insurerId: input.policy.insurerId,
    insurerName: input.policy.insurerName,
    requestedBy: input.uid,
    requestedAt: new Date().toISOString(),
    status: 'pending' as RenewalStatus,
    priority: input.priority || 'normal',
    notes: input.notes || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listRenewalRequests(
  organizationId: string,
): Promise<RenewalRequest[]> {
  const q = query(
    collection(db, 'renewalRequests'),
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
    limit(100),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as RenewalRequest[];
}

export async function updateRenewalRequest(
  requestId: string,
  updates: Partial<RenewalRequest>,
): Promise<void> {
  await updateDoc(doc(db, 'renewalRequests', requestId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// 9. ربط وثيقة ببوليصة
// ============================================================

export async function attachDocumentToPolicy(
  policyId: string,
  documentId: string,
): Promise<void> {
  const policyRef = doc(db, 'policies', policyId);
  const policySnap = await getDoc(policyRef);

  if (!policySnap.exists()) throw new Error('POLICY_NOT_FOUND');

  const current = policySnap.data().documentIds || [];
  if (current.includes(documentId)) return;

  await updateDoc(policyRef, {
    documentIds: [...current, documentId],
    updatedAt: serverTimestamp(),
  });
}

export async function detachDocumentFromPolicy(
  policyId: string,
  documentId: string,
): Promise<void> {
  const policyRef = doc(db, 'policies', policyId);
  const policySnap = await getDoc(policyRef);

  if (!policySnap.exists()) return;

  const current = policySnap.data().documentIds || [];
  await updateDoc(policyRef, {
    documentIds: current.filter((id: string) => id !== documentId),
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// 10. جلب بوليصة واحدة
// ============================================================

export async function getPolicy(policyId: string): Promise<Policy | null> {
  const snap = await getDoc(doc(db, 'policies', policyId));
  if (!snap.exists()) return null;
  return mapPolicy(snap.id, snap.data());
}

// ============================================================
// 11. تحديث بوليصة (عام)
// ============================================================

export async function updatePolicy(
  policyId: string,
  updates: Partial<Policy>,
): Promise<void> {
  await updateDoc(doc(db, 'policies', policyId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// 12. حذف بوليصة
// ============================================================

export async function deletePolicy(policyId: string): Promise<void> {
  const { deleteDoc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'policies', policyId));
}

// ============================================================
// تصدير موحّد
// ============================================================

export { toDate, daysBetween, mapPolicy };