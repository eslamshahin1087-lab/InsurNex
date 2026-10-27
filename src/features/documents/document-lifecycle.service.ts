// ============================================================
// src/features/documents/document-lifecycle.service.ts
// خدمة دورة حياة الوثائق — تتبع الانتهاء، الإحصائيات، التحقق
// ============================================================

import {
  collection,
  doc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';import { db } from '../../firebase/config';
import type {
  DocumentRecord,
  DocumentStatus,
  DocumentStats,
  DocumentCategory,
  DocumentRelationType,
} from '../../types/document';

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

function mapDocument(id: string, data: Record<string, unknown>): DocumentRecord {
  return {
    id,
    ...data,
    status: (data.status as DocumentStatus) || 'active',
    tags: Array.isArray(data.tags) ? data.tags : [],
  } as DocumentRecord;
}

// ============================================================
// 1. الوثائق التي على وشك الانتهاء
// ============================================================

export async function getExpiringDocuments(
  organizationId: string,
  daysAhead = 30,
): Promise<Array<DocumentRecord & { daysLeft: number }>> {
  const now = new Date();
  const future = new Date();
  future.setDate(now.getDate() + daysAhead);

  const nowISO = now.toISOString().slice(0, 10);
  const futureISO = future.toISOString().slice(0, 10);

  const q = query(
    collection(db, 'documents'),
    where('organizationId', '==', organizationId),
    where('expiryDate', '>=', nowISO),
    where('expiryDate', '<=', futureISO),
    orderBy('expiryDate', 'asc'),
    limit(200),
  );

  const snap = await getDocs(q);

  return snap.docs
    .map((d) => mapDocument(d.id, d.data()))
    .filter((doc) => doc.status === 'active')
    .map((doc) => {
      const expiry = new Date(doc.expiryDate!);
      const daysLeft = daysBetween(now, expiry);
      return { ...doc, daysLeft };
    });
}

// ============================================================
// 2. الوثائق المنتهية فعلياً
// ============================================================

export async function getExpiredDocuments(
  organizationId: string,
): Promise<Array<DocumentRecord & { daysOverdue: number }>> {
  const now = new Date();
  const nowISO = now.toISOString().slice(0, 10);

  const q = query(
    collection(db, 'documents'),
    where('organizationId', '==', organizationId),
    where('expiryDate', '<', nowISO),
    orderBy('expiryDate', 'asc'),
    limit(200),
  );

  const snap = await getDocs(q);

  return snap.docs
    .map((d) => mapDocument(d.id, d.data()))
    .filter((doc) => doc.status === 'active')
    .map((doc) => {
      const expiry = new Date(doc.expiryDate!);
      return { ...doc, daysOverdue: Math.abs(daysBetween(now, expiry)) };
    });
}

// ============================================================
// 3. تحديث تاريخ انتهاء وثيقة
// ============================================================

export async function updateDocumentExpiry(
  documentId: string,
  expiryDate: string,
  issuedDate?: string,
): Promise<void> {
  const updates: Record<string, unknown> = {
    expiryDate,
    updatedAt: serverTimestamp(),
    // إعادة تفعيل الوثيقة إذا كانت منتهية
    status: 'active' as DocumentStatus,
    lastNotifiedAt: null,
    notificationCount: 0,
  };

  if (issuedDate) updates.issuedDate = issuedDate;

  await updateDoc(doc(db, 'documents', documentId), updates);
}

// ============================================================
// 4. تعليم وثيقة كمنتهية يدوياً
// ============================================================

export async function expireDocument(documentId: string): Promise<void> {
  await updateDoc(doc(db, 'documents', documentId), {
    status: 'expired' as DocumentStatus,
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// 5. تعليم وثيقة كمُتحقق منها
// ============================================================

export async function verifyDocument(
  documentId: string,
  verifiedBy: string,
): Promise<void> {
  await updateDoc(doc(db, 'documents', documentId), {
    verified: true,
    verifiedAt: serverTimestamp(),
    verifiedBy,
    status: 'active' as DocumentStatus,
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// 6. إلغاء التحقق
// ============================================================

export async function unverifyDocument(documentId: string): Promise<void> {
  await updateDoc(doc(db, 'documents', documentId), {
    verified: false,
    verifiedAt: null,
    verifiedBy: null,
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// 7. إحصائيات الوثائق
// ============================================================

export async function getDocumentStats(
  organizationId: string,
): Promise<DocumentStats> {
  const q = query(
    collection(db, 'documents'),
    where('organizationId', '==', organizationId),
    limit(500),
  );
  const snap = await getDocs(q);
  const documents = snap.docs.map((d) => mapDocument(d.id, d.data()));

  const now = new Date();
  const in7Days = new Date();
  in7Days.setDate(now.getDate() + 7);
  const in30Days = new Date();
  in30Days.setDate(now.getDate() + 30);

  const byCategory: Record<DocumentCategory, number> = {
    policy: 0,
    claim: 0,
    client: 0,
    identity: 0,
    proposal: 0,
    correspondence: 0,
    invoice: 0,
    receipt: 0,
    other: 0,
  };

  const stats: DocumentStats = {
    total: documents.length,
    active: 0,
    expired: 0,
    pendingReview: 0,
    expiringIn30Days: 0,
    expiringIn7Days: 0,
    byCategory,
    totalSize: 0,
  };

  for (const d of documents) {
    if (d.status === 'active') stats.active++;
    else if (d.status === 'expired') stats.expired++;
    else if (d.status === 'pending_review') stats.pendingReview++;

    stats.totalSize += Number(d.size) || 0;

    if (byCategory[d.category] !== undefined) {
      byCategory[d.category]++;
    } else {
      byCategory.other++;
    }

    // الوثائق التي على وشك الانتهاء
    if (d.status === 'active' && d.expiryDate) {
      const expiry = new Date(d.expiryDate);
      if (expiry >= now && expiry <= in30Days) stats.expiringIn30Days++;
      if (expiry >= now && expiry <= in7Days) stats.expiringIn7Days++;
    }
  }

  return stats;
}

// ============================================================
// 8. وثائق بوليصة معينة
// ============================================================

export async function getPolicyDocuments(
  organizationId: string,
  policyId: string,
): Promise<DocumentRecord[]> {
  const q = query(
    collection(db, 'documents'),
    where('organizationId', '==', organizationId),
    where('relatedType', '==', 'policy' as DocumentRelationType),
    where('relatedId', '==', policyId),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapDocument(d.id, d.data()));
}

// ============================================================
// 9. وثائق عميل معين
// ============================================================

export async function getClientDocuments(
  organizationId: string,
  clientId: string,
): Promise<DocumentRecord[]> {
  const q = query(
    collection(db, 'documents'),
    where('organizationId', '==', organizationId),
    where('relatedType', '==', 'client' as DocumentRelationType),
    where('relatedId', '==', clientId),
    orderBy('createdAt', 'desc'),
    limit(100),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapDocument(d.id, d.data()));
}

// ============================================================
// 10. جلب وثيقة واحدة
// ============================================================

export async function getDocument(
  documentId: string,
): Promise<DocumentRecord | null> {
  const snap = await getDoc(doc(db, 'documents', documentId));
  if (!snap.exists()) return null;
  return mapDocument(snap.id, snap.data());
}

// ============================================================
// 11. تحديث وثيقة (عام)
// ============================================================

export async function updateDocument(
  documentId: string,
  updates: Partial<DocumentRecord>,
): Promise<void> {
  await updateDoc(doc(db, 'documents', documentId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// 12. حذف وثيقة (مع الملف)
// ============================================================

export async function deleteDocument(
  documentId: string,
): Promise<void> {
  const { deleteDoc } = await import('firebase/firestore');
  const { deleteObject, ref: storageRef } = await import('firebase/storage');
  const { storage } = await import('../../firebase/config');

  const docSnap = await getDoc(doc(db, 'documents', documentId));
  if (!docSnap.exists()) return;

  const data = docSnap.data();
  if (data.storagePath) {
    try {
      await deleteObject(storageRef(storage, data.storagePath));
    } catch (e) {
      console.warn('Storage deletion failed:', e);
    }
  }

  await deleteDoc(doc(db, 'documents', documentId));
}

// ============================================================
// 13. جدولة تنبيه انتهاء الوثيقة
// ============================================================

export async function scheduleDocumentExpiryNotification(
  documentId: string,
): Promise<void> {
  await updateDoc(doc(db, 'documents', documentId), {
    lastNotifiedAt: serverTimestamp(),
    notificationCount: (await getDoc(doc(db, 'documents', documentId)))
      .data()
      ?.notificationCount
      ? (await getDoc(doc(db, 'documents', documentId))).data()!
          .notificationCount + 1
      : 1,
    updatedAt: serverTimestamp(),
  });
}

// ============================================================
// تصدير موحّد
// ============================================================

export { toDate, daysBetween, mapDocument };