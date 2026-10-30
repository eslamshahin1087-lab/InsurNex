import { cert, getApps, initializeApp } from 'npm:firebase-admin@12.7.0/app';
import { FieldValue, getFirestore } from 'npm:firebase-admin@12.7.0/firestore';
import {
  daysUntilUtcDate,
  isCronRequestAuthorized,
  normalizeDateOnly,
  reminderPriority,
  renewalReminderWindow,
  stableNotificationId,
} from '../_shared/cron-auth.ts';

const FIREBASE_SERVICE_ACCOUNT = Deno.env.get('FIREBASE_SERVICE_ACCOUNT') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
let cachedFirestore: ReturnType<typeof getFirestore> | null = null;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function firestore() {
  if (cachedFirestore) return cachedFirestore;
  if (!FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT_NOT_CONFIGURED');
  const credentials = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
  const app = getApps()[0] ?? initializeApp({ credential: cert(credentials) });
  cachedFirestore = getFirestore(app);
  cachedFirestore.settings({ preferRest: true });
  return cachedFirestore;
}

function addUtcDays(now: Date, days: number): string {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
  return next.toISOString().slice(0, 10);
}

Deno.serve(async (request: Request) => {
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  if (!CRON_SECRET) return jsonResponse({ ok: false, error: 'SERVICE_NOT_CONFIGURED' }, 503);
  if (!isCronRequestAuthorized(request, CRON_SECRET)) return jsonResponse({ ok: false, error: 'UNAUTHORIZED' }, 401);

  try {
    const db = firestore();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const cutoff = addUtcDays(now, 90) + 'T23:59:59.999Z';
    const snapshot = await db.collection('documents')
      .where('expiryDate', '>=', today)
      .where('expiryDate', '<=', cutoff)
      .get();

    let created = 0;
    let skipped = 0;
    let invalid = 0;

    for (const documentSnapshot of snapshot.docs) {
      const document = documentSnapshot.data();
      const organizationId = typeof document.organizationId === 'string' ? document.organizationId : '';
      const expiryDate = normalizeDateOnly(document.expiryDate);
      const daysLeft = daysUntilUtcDate(document.expiryDate, now);
      if (!organizationId || !expiryDate || daysLeft === null
        || document.status === 'deleted' || document.status === 'archived') {
        invalid++;
        continue;
      }

      const windowDays = renewalReminderWindow(daysLeft);
      if (windowDays === null) {
        skipped++;
        continue;
      }

      const notificationId = await stableNotificationId('document', documentSnapshot.id, expiryDate, windowDays);
      const notificationRef = db.collection('notifications').doc(notificationId);
      const documentRef = documentSnapshot.ref;

      const wasCreated = await db.runTransaction(async (transaction) => {
        const [existingNotification, currentDocument] = await Promise.all([
          transaction.get(notificationRef),
          transaction.get(documentRef),
        ]);
        if (existingNotification.exists || !currentDocument.exists) return false;

        const current = currentDocument.data() ?? {};
        if (current.organizationId !== organizationId
          || normalizeDateOnly(current.expiryDate) !== expiryDate
          || current.status === 'deleted' || current.status === 'archived') return false;

        const relationType = typeof current.relatedType === 'string' ? current.relatedType : '';
        const relationId = typeof current.relatedId === 'string' ? current.relatedId : '';
        transaction.create(notificationRef, {
          type: 'document_expiring',
          priority: reminderPriority(windowDays),
          title: 'مستند يقترب من تاريخ الانتهاء',
          body: 'يوجد مستند مرتبط يحتاج إلى مراجعة تاريخ الانتهاء.',
          organizationId,
          ...(typeof current.assignedTo === 'string' ? { userId: current.assignedTo } : {}),
          ...(relationType === 'client' && relationId ? { clientId: relationId } : {}),
          ...(relationType === 'policy' && relationId ? { policyId: relationId } : {}),
          documentId: documentSnapshot.id,
          link: '/documents/' + documentSnapshot.id,
          read: false,
          actionRequired: true,
          actionUrl: '/documents/' + documentSnapshot.id,
          actionLabel: 'مراجعة المستند',
          channels: ['in_app'],
          metadata: { reminderWindowDays: windowDays, daysLeft, expiryDate },
          createdAt: FieldValue.serverTimestamp(),
        });
        return true;
      });

      if (wasCreated) created++;
      else skipped++;
    }

    return jsonResponse({
      ok: true,
      scanned: snapshot.size,
      created,
      skipped,
      invalid,
      cutoffDate: cutoff,
      reminderWindows: [7, 30, 45, 90],
    });
  } catch {
    console.error('cron-document-check failed; details suppressed');
    return jsonResponse({ ok: false, error: 'CRON_JOB_FAILED' }, 500);
  }
});
