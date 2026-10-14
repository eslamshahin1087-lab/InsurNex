import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type {
  OrganizationSubscription,
  SubscriptionCode,
  SubscriptionStatus,
} from './subscription.types';
import {
  computePricing,
  CURRENCY,
} from '../admin/pricing.config';
import { getPlanById } from '../admin/plans.service';
import { archiveItem } from '../admin/archive.service';
import type {
  ArchiveAction,
  ArchiveSource,
  ArchiveType,
} from '../admin/archive.types';

// ============================================================
// HELPERS
// ============================================================

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(`${a}T00:00:00`).getTime();
  const d2 = new Date(`${b}T00:00:00`).getTime();
  return Math.round((d2 - d1) / 86400000);
}

export function isExpired(sub: OrganizationSubscription | null): boolean {
  if (!sub) return true;
  if (sub.status === 'suspended') return true;
  const today = isoDate(new Date());
  return sub.endDate < today;
}

export function daysRemaining(sub: OrganizationSubscription | null): number {
  if (!sub) return 0;
  const today = isoDate(new Date());
  return Math.max(0, daysBetween(today, sub.endDate));
}

// ============================================================
// ARCHIVE HELPER (safe — never throws)
// ============================================================

export interface AdminContext {
  uid: string;
  name: string;
  email?: string;
}

async function safeArchive(params: {
  type: ArchiveType;
  action: ArchiveAction;
  source: ArchiveSource;
  data: Record<string, unknown>;
  admin: AdminContext;
  reason?: string;
}): Promise<void> {
  try {
    await archiveItem({
      type: params.type,
      action: params.action,
      source: params.source,
      data: params.data,
      deletedBy: params.admin.uid,
      deletedByName: params.admin.name,
      deletedByEmail: params.admin.email,
      reason: params.reason,
    });
  } catch (e) {
    // Archiving must never break the primary action
    console.warn('Archive failed:', e);
  }
}

// ============================================================
// ORGANIZATION SUBSCRIPTION
// ============================================================

export async function getSubscription(
  organizationId: string,
): Promise<OrganizationSubscription | null> {
  const snap = await getDoc(doc(db, 'organizationSubscriptions', organizationId));
  if (!snap.exists()) return null;
  return snap.data() as OrganizationSubscription;
}

export async function createTrialSubscription(
  organizationId: string,
  ownerId: string,
): Promise<void> {
  const startDate = new Date();
  const endDate = addDays(startDate, 30);

  await setDoc(
    doc(db, 'organizationSubscriptions', organizationId),
    {
      organizationId,
      status: 'trial' as SubscriptionStatus,
      plan: 'trial',
      startDate: isoDate(startDate),
      endDate: isoDate(endDate),
      trialEndsAt: isoDate(endDate),
      ownerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

// ============================================================
// REDEEM CODE
// ============================================================

export interface RedeemResult {
  success: boolean;
  error?: string;
  newEndDate?: string;
  daysAdded?: number;
}

export async function redeemCode(params: {
  code: string;
  organizationId: string;
  uid: string;
  userName?: string;
}): Promise<RedeemResult> {
  const cleanCode = params.code.trim().toUpperCase();
  if (!cleanCode) return { success: false, error: 'EMPTY_CODE' };

  const codeRef = doc(db, 'subscriptionCodes', cleanCode);

  try {
    await updateDoc(codeRef, {
      status: 'used',
      usedBy: {
        organizationId: params.organizationId,
        uid: params.uid,
        userName: params.userName || '',
        usedAt: serverTimestamp(),
      },
      usedAt: serverTimestamp(),
    });
  } catch {
    try {
      const snap = await getDoc(codeRef);
      if (snap.exists()) {
        const data = snap.data() as SubscriptionCode;
        if (data.usedBy?.uid === params.uid) {
          return { success: false, error: 'CODE_ALREADY_USED' };
        }
      }
    } catch {
      /* ignore */
    }
    return { success: false, error: 'CODE_NOT_FOUND' };
  }

  const codeSnap = await getDoc(codeRef);
  if (!codeSnap.exists()) {
    return { success: false, error: 'CODE_NOT_FOUND' };
  }
  const codeData = codeSnap.data() as SubscriptionCode;
  const duration = codeData.duration || 30;
  const planType = codeData.planType || 'monthly';

  const subSnap = await getDoc(
    doc(db, 'organizationSubscriptions', params.organizationId),
  );

  const today = new Date();
  const todayIso = isoDate(today);

  let baseDate = today;
  if (subSnap.exists()) {
    const sub = subSnap.data() as OrganizationSubscription;
    if (sub.endDate >= todayIso) {
      baseDate = new Date(`${sub.endDate}T00:00:00`);
    }
  }

  const newEndDate = addDays(baseDate, duration);
  const newEndIso = isoDate(newEndDate);

  await setDoc(
    doc(db, 'organizationSubscriptions', params.organizationId),
    {
      organizationId: params.organizationId,
      status: 'active' as SubscriptionStatus,
      plan: planType,
      startDate: todayIso,
      endDate: newEndIso,
      lastCodeUsed: cleanCode,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return {
    success: true,
    newEndDate: newEndIso,
    daysAdded: duration,
  };
}

// ============================================================
// ADMIN - CODE MANAGEMENT
// ============================================================

function generateCodeString(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'INX-';
  const array = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 8; i++) array[i] = Math.floor(Math.random() * 256);
  }
  for (let i = 0; i < 8; i++) {
    code += chars[array[i] % chars.length];
    if (i === 3) code += '-';
  }
  return code;
}

export async function createCode(params: {
  planType: string;
  createdBy: string;
  createdByName?: string;
  notes?: string;
}): Promise<string> {
  const plan = await getPlanById(params.planType);
  if (!plan) throw new Error('INVALID_PLAN');

  const pricing = computePricing(plan.subtotal);

  let attempts = 0;
  while (attempts < 5) {
    const code = generateCodeString();
    const snap = await getDoc(doc(db, 'subscriptionCodes', code));
    if (!snap.exists()) {
      await setDoc(doc(db, 'subscriptionCodes', code), {
        code,
        status: 'unused',
        planType: plan.id,
        planName: plan.name,
        duration: plan.duration,
        subtotal: pricing.subtotal,
        vatRate: pricing.vatRate,
        vatAmount: pricing.vatAmount,
        total: pricing.total,
        currency: CURRENCY,
        createdBy: params.createdBy,
        createdByName: params.createdByName || '',
        notes: params.notes || '',
        createdAt: serverTimestamp(),
      });
      return code;
    }
    attempts++;
  }
  throw new Error('FAILED_TO_GENERATE_UNIQUE_CODE');
}

export async function createBulkCodes(params: {
  count: number;
  planType: string;
  createdBy: string;
  createdByName?: string;
  notes?: string;
}): Promise<string[]> {
  const codes: string[] = [];
  for (let i = 0; i < params.count; i++) {
    const code = await createCode({
      planType: params.planType,
      createdBy: params.createdBy,
      createdByName: params.createdByName,
      notes: params.notes,
    });
    codes.push(code);
  }
  return codes;
}

export async function listCodes(params?: {
  status?: 'unused' | 'used' | 'revoked' | 'all';
  limitCount?: number;
}): Promise<SubscriptionCode[]> {
  const lim = params?.limitCount ?? 100;
  const constraints: Parameters<typeof query>[1][] = [];

  if (params?.status && params.status !== 'all') {
    constraints.push(where('status', '==', params.status));
  }

  const q = query(
    collection(db, 'subscriptionCodes'),
    ...constraints,
    orderBy('createdAt', 'desc'),
    limit(lim),
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ code: d.id, ...d.data() } as SubscriptionCode));
}

/**
 * Revoke a subscription code.
 * Archives the full code doc BEFORE updating status.
 */
export async function revokeCode(
  code: string,
  admin?: AdminContext,
  reason?: string,
): Promise<void> {
  const snap = await getDoc(doc(db, 'subscriptionCodes', code));
  const originalData = snap.exists() ? (snap.data() as Record<string, unknown>) : null;

  if (admin && originalData) {
    await safeArchive({
      type: 'code',
      action: 'revoked',
      source: 'admin-codes',
      data: { ...originalData, code },
      admin,
      reason: reason || 'إلغاء كود اشتراك',
    });
  }

  await updateDoc(doc(db, 'subscriptionCodes', code), { status: 'revoked' });
}

/**
 * Permanently delete a code (admin only).
 * Archives first.
 */
export async function deleteCode(
  code: string,
  admin?: AdminContext,
  reason?: string,
): Promise<void> {
  const snap = await getDoc(doc(db, 'subscriptionCodes', code));
  const originalData = snap.exists() ? (snap.data() as Record<string, unknown>) : null;

  if (admin && originalData) {
    await safeArchive({
      type: 'code',
      action: 'deleted',
      source: 'admin-codes',
      data: { ...originalData, code },
      admin,
      reason: reason || 'حذف نهائي لكود اشتراك',
    });
  }

  await deleteDoc(doc(db, 'subscriptionCodes', code));
}

// ============================================================
// ADMIN - SUBSCRIPTIONS LIST
// ============================================================

export async function listAllSubscriptions(
  limitCount = 100,
): Promise<OrganizationSubscription[]> {
  const q = query(
    collection(db, 'organizationSubscriptions'),
    orderBy('updatedAt', 'desc'),
    limit(limitCount),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as OrganizationSubscription);
}

export async function extendSubscription(params: {
  organizationId: string;
  days: number;
}): Promise<string> {
  const sub = await getSubscription(params.organizationId);
  const today = new Date();
  const todayIso = isoDate(today);
  let base = today;
  if (sub && sub.endDate >= todayIso) {
    base = new Date(`${sub.endDate}T00:00:00`);
  }
  const newEnd = addDays(base, params.days);
  const newEndIso = isoDate(newEnd);

  await setDoc(
    doc(db, 'organizationSubscriptions', params.organizationId),
    {
      organizationId: params.organizationId,
      status: 'active',
      endDate: newEndIso,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return newEndIso;
}

export async function suspendSubscription(
  organizationId: string,
  admin?: AdminContext,
  reason?: string,
): Promise<void> {
  const snap = await getDoc(doc(db, 'organizationSubscriptions', organizationId));
  const originalData = snap.exists() ? (snap.data() as Record<string, unknown>) : null;

  if (admin && originalData) {
    await safeArchive({
      type: 'subscription',
      action: 'suspended',
      source: 'admin-subscriptions',
      data: { ...originalData, organizationId },
      admin,
      reason: reason || 'إيقاف اشتراك',
    });
  }

  await setDoc(
    doc(db, 'organizationSubscriptions', organizationId),
    {
      organizationId,
      status: 'suspended',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function activateSubscription(organizationId: string): Promise<void> {
  await setDoc(
    doc(db, 'organizationSubscriptions', organizationId),
    {
      organizationId,
      status: 'active',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Delete a subscription permanently.
 * Archives the full doc BEFORE deletion.
 */
export async function deleteSubscription(
  organizationId: string,
  admin?: AdminContext,
  reason?: string,
): Promise<void> {
  const snap = await getDoc(doc(db, 'organizationSubscriptions', organizationId));
  const originalData = snap.exists()
    ? (snap.data() as Record<string, unknown>)
    : null;

  if (admin && originalData) {
    await safeArchive({
      type: 'subscription',
      action: 'deleted',
      source: 'admin-subscriptions',
      data: { ...originalData, organizationId },
      admin,
      reason: reason || 'حذف نهائي لاشتراك',
    });
  }

  await deleteDoc(doc(db, 'organizationSubscriptions', organizationId));
}

// ============================================================
// ADMIN CHECK
// ============================================================

export async function isCurrentUserAdmin(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'admin', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

// ============================================================
// ADMIN - DELETE USER DATA
// ============================================================

export async function deleteUserData(
  uid: string,
  admin?: AdminContext,
  reason?: string,
): Promise<void> {
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) throw new Error('USER_NOT_FOUND');
  const userData = userSnap.data() as {
    organizationId?: string;
    displayName?: string;
    email?: string;
  };

  const orgId = userData.organizationId;

  // Archive user profile
  if (admin) {
    await safeArchive({
      type: 'user',
      action: 'deleted',
      source: 'admin-users',
      data: { ...userData, uid },
      admin,
      reason: reason || 'حذف بيانات مستخدم',
    });

    // Archive organization if exists
    if (orgId) {
      try {
        const orgSnap = await getDoc(doc(db, 'organizations', orgId));
        if (orgSnap.exists()) {
          await safeArchive({
            type: 'organization',
            action: 'deleted',
            source: 'admin-users',
            data: { ...(orgSnap.data() as Record<string, unknown>), id: orgId },
            admin,
            reason: `حذف تلقائي مع المستخدم ${userData.displayName || uid.slice(0, 8)}`,
          });
        }
      } catch {
        /* ignore */
      }

      try {
        const subSnap = await getDoc(doc(db, 'organizationSubscriptions', orgId));
        if (subSnap.exists()) {
          await safeArchive({
            type: 'subscription',
            action: 'deleted',
            source: 'admin-users',
            data: {
              ...(subSnap.data() as Record<string, unknown>),
              organizationId: orgId,
            },
            admin,
            reason: `حذف تلقائي مع المستخدم ${userData.displayName || uid.slice(0, 8)}`,
          });
        }
      } catch {
        /* ignore */
      }
    }
  }

  // Delete org-related docs
  if (orgId) {
    try {
      await deleteDoc(doc(db, 'organizationSubscriptions', orgId));
    } catch {
      /* ignore */
    }
    try {
      await deleteDoc(doc(db, 'organizations', orgId));
    } catch {
      /* ignore */
    }
  }

  // Delete user profile
  await deleteDoc(doc(db, 'users', uid));

  // Delete onboarding progress
  try {
    await deleteDoc(doc(db, 'onboardingProgress', uid));
  } catch {
    /* ignore */
  }
}