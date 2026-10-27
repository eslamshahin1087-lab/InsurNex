// ============================================================
// src/features/notifications/notification.service.new.ts
// خدمة إدارة الإشعارات في Firestore
// ============================================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  getDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type {
  Notification,
  NotificationType,
  NotificationPriority,
  NotificationPreferences,
  NotificationStats,
  NotificationFilter,
} from './types';

const NOTIFICATIONS_COLLECTION = 'notifications';
const PREFERENCES_COLLECTION = 'notificationPreferences';

// ============================================================
// أدوات مساعدة
// ============================================================

function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'string') return new Date(value);
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Timestamp(
      (value as { seconds: number }).seconds,
      (value as { nanoseconds?: number }).nanoseconds || 0,
    ).toDate();
  }
  return new Date();
}

function mapNotification(id: string, data: Record<string, unknown>): Notification {
  return {
    id,
    type: data.type as NotificationType,
    priority: data.priority as NotificationPriority,
    title: String(data.title || ''),
    titleEn: data.titleEn as string | undefined,
    body: String(data.body || ''),
    bodyEn: data.bodyEn as string | undefined,
    organizationId: String(data.organizationId || ''),
    userId: (data.userId as string | null | undefined) ?? null,
    clientId: data.clientId as string | undefined,
    policyId: data.policyId as string | undefined,
    documentId: data.documentId as string | undefined,
    leadId: data.leadId as string | undefined,
    taskId: data.taskId as string | undefined,
    link: data.link as string | undefined,
    actionRequired: Boolean(data.actionRequired),
    actionUrl: data.actionUrl as string | undefined,
    actionLabel: data.actionLabel as string | undefined,
    read: Boolean(data.read),
    readAt: data.readAt ? toDate(data.readAt) : null,
    channels: (data.channels as Notification['channels']) || ['in_app'],
    metadata: (data.metadata as Record<string, unknown>) || {},
    createdAt: toDate(data.createdAt),
    expiresAt: data.expiresAt ? toDate(data.expiresAt) : null,
  };
}

// ============================================================
// CRUD
// ============================================================

export async function createNotification(
  data: Omit<Notification, 'id' | 'createdAt' | 'read' | 'readAt'>,
): Promise<string> {
  const docRef = await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
    ...data,
    read: false,
    readAt: null,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export function subscribeToNotifications(
  userId: string,
  organizationId: string,
  callback: (notifications: Notification[]) => void,
  maxResults = 50,
) {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
    limit(maxResults),
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs
      .map((docSnap) => mapNotification(docSnap.id, docSnap.data()))
      .filter((n) => !n.userId || n.userId === userId);
    callback(notifications);
  });
}

export function subscribeToUnreadCount(
  userId: string,
  organizationId: string,
  callback: (count: number) => void,
) {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('organizationId', '==', organizationId),
    where('read', '==', false),
  );

  return onSnapshot(q, (snapshot) => {
    const count = snapshot.docs.filter((docSnap) => {
      const data = docSnap.data();
      return !data.userId || data.userId === userId;
    }).length;
    callback(count);
  });
}

export function subscribeToStats(
  userId: string,
  organizationId: string,
  callback: (stats: NotificationStats) => void,
) {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('organizationId', '==', organizationId),
  );

  return onSnapshot(q, (snapshot) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats: NotificationStats = {
      total: 0, unread: 0, urgent: 0, high: 0, today: 0,
    };

    snapshot.docs.forEach((docSnap) => {
      const n = mapNotification(docSnap.id, docSnap.data());
      if (n.userId && n.userId !== userId) return;
      stats.total++;
      if (!n.read) stats.unread++;
      if (n.priority === 'urgent') stats.urgent++;
      if (n.priority === 'high') stats.high++;
      if (n.createdAt >= today) stats.today++;
    });

    callback(stats);
  });
}

export async function fetchNotifications(
  userId: string,
  organizationId: string,
  filter: NotificationFilter = {},
  maxResults = 100,
): Promise<Notification[]> {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
    limit(maxResults),
  );

  const snapshot = await getDocs(q);
  let notifications = snapshot.docs
    .map((docSnap) => mapNotification(docSnap.id, docSnap.data()))
    .filter((n) => !n.userId || n.userId === userId);

  if (filter.unreadOnly) notifications = notifications.filter((n) => !n.read);
  if (filter.types?.length) notifications = notifications.filter((n) => filter.types!.includes(n.type));
  if (filter.priorities?.length) notifications = notifications.filter((n) => filter.priorities!.includes(n.priority));
  if (filter.fromDate) notifications = notifications.filter((n) => n.createdAt >= filter.fromDate!);
  if (filter.toDate) notifications = notifications.filter((n) => n.createdAt <= filter.toDate!);

  return notifications;
}

export async function getNotification(id: string): Promise<Notification | null> {
  const snap = await getDoc(doc(db, NOTIFICATIONS_COLLECTION, id));
  if (!snap.exists()) return null;
  return mapNotification(snap.id, snap.data());
}

export async function markAsRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId), {
    read: true, readAt: serverTimestamp(),
  });
}

export async function markAsUnread(notificationId: string): Promise<void> {
  await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId), {
    read: false, readAt: null,
  });
}

export async function markAllAsRead(
  userId: string,
  organizationId: string,
): Promise<number> {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('organizationId', '==', organizationId),
    where('read', '==', false),
  );

  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  let count = 0;

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.userId && data.userId !== userId) return;
    batch.update(docSnap.ref, { read: true, readAt: serverTimestamp() });
    count++;
  });

  if (count > 0) await batch.commit();
  return count;
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId));
}

export async function deleteAllRead(
  userId: string,
  organizationId: string,
): Promise<number> {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('organizationId', '==', organizationId),
    where('read', '==', true),
  );

  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  let count = 0;

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.userId && data.userId !== userId) return;
    batch.delete(docSnap.ref);
    count++;
  });

  if (count > 0) await batch.commit();
  return count;
}

// ============================================================
// التفضيلات
// ============================================================

export async function getPreferences(
  userId: string,
): Promise<NotificationPreferences | null> {
  const q = query(
    collection(db, PREFERENCES_COLLECTION),
    where('userId', '==', userId),
    limit(1),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const data = snapshot.docs[0].data();
  return { ...data, updatedAt: toDate(data.updatedAt) } as NotificationPreferences;
}

export async function savePreferences(
  preferences: Omit<NotificationPreferences, 'updatedAt'>,
): Promise<void> {
  const q = query(
    collection(db, PREFERENCES_COLLECTION),
    where('userId', '==', preferences.userId),
    limit(1),
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    await addDoc(collection(db, PREFERENCES_COLLECTION), {
      ...preferences, updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(snapshot.docs[0].ref, {
      ...preferences, updatedAt: serverTimestamp(),
    });
  }
}

// ============================================================
// مساعدات إنشاء إشعارات جاهزة
// ============================================================

export async function notifyPolicyExpiring(params: {
  policyId: string; clientId: string; clientName: string;
  policyNumber: string; daysLeft: number;
  organizationId: string; userId: string | null;
}): Promise<string> {
  return createNotification({
    type: 'policy_expiring',
    priority: params.daysLeft <= 7 ? 'urgent' : params.daysLeft <= 15 ? 'high' : 'normal',
    title: `⚠️ بوليصة ${params.policyNumber} تنتهي خلال ${params.daysLeft} يوم`,
    body: `بوليصة العميل ${params.clientName} ستنتهي خلال ${params.daysLeft} يوم.`,
    organizationId: params.organizationId,
    userId: params.userId,
    clientId: params.clientId,
    policyId: params.policyId,
    link: `/policies/${params.policyId}`,
    actionRequired: true,
    actionUrl: `/policies/${params.policyId}/renew`,
    actionLabel: 'تجديد الآن',
    channels: ['in_app'],
    metadata: { daysLeft: params.daysLeft, policyNumber: params.policyNumber },
  });
}

export async function notifyLeadCreated(params: {
  leadId: string; leadCode: string; clientName: string;
  source: string; organizationId: string;
  userId: string | null; riskScore?: number;
}): Promise<string> {
  const isHigh = (params.riskScore || 0) >= 75;
  return createNotification({
    type: 'lead_created',
    priority: isHigh ? 'high' : 'normal',
    title: `🎯 عميل محتمل جديد: ${params.clientName}`,
    body: `تم إضافة عميل محتمل جديد من ${params.source}. كود: ${params.leadCode}`,
    organizationId: params.organizationId,
    userId: params.userId,
    leadId: params.leadId,
    link: `/leads/${params.leadId}`,
    channels: ['in_app'],
    metadata: { source: params.source, leadCode: params.leadCode, riskScore: params.riskScore },
  });
}

export async function notifyDocumentExpiring(params: {
  documentId: string; clientId: string; documentName: string;
  daysLeft: number; organizationId: string; userId: string | null;
}): Promise<string> {
  return createNotification({
    type: 'document_expiring',
    priority: params.daysLeft <= 7 ? 'high' : 'normal',
    title: `📄 مستند "${params.documentName}" ينتهي خلال ${params.daysLeft} يوم`,
    body: `مستند "${params.documentName}" سينتهي قريباً.`,
    organizationId: params.organizationId,
    userId: params.userId,
    documentId: params.documentId,
    clientId: params.clientId,
    link: `/documents/${params.documentId}`,
    actionRequired: true,
    actionUrl: `/documents/${params.documentId}/renew`,
    actionLabel: 'تحديث المستند',
    channels: ['in_app'],
    metadata: { daysLeft: params.daysLeft, documentName: params.documentName },
  });
}