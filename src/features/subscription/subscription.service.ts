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
//
// Security note (see firestore.rules):
//  - Reading unused codes is blocked (anti-enumeration).
//  - So we DON'T read first. We go straight to update() — the rules
//    validate that the code is unused and that we set usedBy.uid to us.
//  - After the code is marked used, we CAN read it (usedBy.uid == us).
//  - Extending the subscription is allowed only when lastCodeUsed changes.

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

  // Step 1 — claim the code. No read first (rules block reading unused codes).
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
    // Write rejected. Either the code doesn't exist, was revoked,
    // or was already used by someone else. Try to read it back:
    // if we can read it, it's ours (already used by us).
    try {
      const snap = await getDoc(codeRef);
      if (snap.exists()) {
        const data = snap.data() as SubscriptionCode;
        if (data.usedBy?.uid === params.uid) {
          return { success: false, error: 'CODE_ALREADY_USED' };
        }
      }
    } catch {
      // reading also denied — code is not ours
    }
    return { success: false, error: 'CODE_NOT_FOUND' };
  }

  // Step 2 — read the code back (now allowed) to get its duration.
  const codeSnap = await getDoc(codeRef);
  if (!codeSnap.exists()) {
    return { success: false, error: 'CODE_NOT_FOUND' };
  }
  const codeData = codeSnap.data() as SubscriptionCode;
  const duration = codeData.duration || 30;

  // Step 3 — compute the new end date.
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

  // Step 4 — extend the subscription. The rule allows endDate to move
  // only when lastCodeUsed changes — which is exactly what we do here.
  await setDoc(
    doc(db, 'organizationSubscriptions', params.organizationId),
    {
      organizationId: params.organizationId,
      status: 'active' as SubscriptionStatus,
      plan: 'monthly',
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
  duration: number;
  amount: number;
  createdBy: string;
  createdByName?: string;
  notes?: string;
}): Promise<string> {
  let attempts = 0;
  while (attempts < 5) {
    const code = generateCodeString();
    const snap = await getDoc(doc(db, 'subscriptionCodes', code));
    if (!snap.exists()) {
      await setDoc(doc(db, 'subscriptionCodes', code), {
        code,
        status: 'unused',
        duration: params.duration,
        amount: params.amount,
        currency: 'EGP',
        plan: 'monthly',
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
  duration: number;
  amount: number;
  createdBy: string;
  createdByName?: string;
  notes?: string;
}): Promise<string[]> {
  const codes: string[] = [];
  for (let i = 0; i < params.count; i++) {
    const code = await createCode({
      duration: params.duration,
      amount: params.amount,
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

export async function revokeCode(code: string): Promise<void> {
  await updateDoc(doc(db, 'subscriptionCodes', code), { status: 'revoked' });
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

export async function suspendSubscription(organizationId: string): Promise<void> {
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

export async function deleteUserData(uid: string): Promise<void> {
  const userSnap = await getDoc(doc(db, 'users', uid));
  if (!userSnap.exists()) throw new Error('USER_NOT_FOUND');
  const userData = userSnap.data() as { organizationId?: string };

  const orgId = userData.organizationId;

  if (orgId) {
    try {
      await deleteDoc(doc(db, 'organizationSubscriptions', orgId));
    } catch { /* ignore */ }
    try {
      await deleteDoc(doc(db, 'organizations', orgId));
    } catch { /* ignore */ }
  }

  await deleteDoc(doc(db, 'users', uid));

  try {
    await deleteDoc(doc(db, 'onboardingProgress', uid));
  } catch { /* ignore */ }
}