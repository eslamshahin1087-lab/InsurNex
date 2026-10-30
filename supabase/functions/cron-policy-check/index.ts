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
    const snapshot = await db.collection('policies')
      .where('endDate', '>=', today)
      .where('endDate', '<=', cutoff)
      .get();

    let created = 0;
    let skipped = 0;
    let invalid = 0;

    for (const policySnapshot of snapshot.docs) {
      const policy = policySnapshot.data();
      const organizationId = typeof policy.organizationId === 'string' ? policy.organizationId : '';
      const expiryDate = normalizeDateOnly(policy.endDate);
      const daysLeft = daysUntilUtcDate(policy.endDate, now);
      if (!organizationId || !expiryDate || daysLeft === null || policy.status !== 'active') {
        invalid++;
        continue;
      }

      const windowDays = renewalReminderWindow(daysLeft);
      if (windowDays === null) {
        skipped++;
        continue;
      }

      const notificationId = await stableNotificationId('policy', policySnapshot.id, expiryDate, windowDays);
      const notificationRef = db.collection('notifications').doc(notificationId);
      const policyRef = policySnapshot.ref;

      const wasCreated = await db.runTransaction(async (transaction) => {
        const [existingNotification, currentPolicy] = await Promise.all([
          transaction.get(notificationRef),
          transaction.get(policyRef),
        ]);
        if (existingNotification.exists || !currentPolicy.exists) return false;

        const current = currentPolicy.data() ?? {};
        if (current.organizationId !== organizationId
          || current.status !== 'active'
          || normalizeDateOnly(current.endDate) !== expiryDate) return false;

        transaction.create(notificationRef, {
          type: 'policy_expiring',
          priority: reminderPriority(windowDays),
          title: 'وثيقة تأمين تقترب من تاريخ الانتهاء',
          body: 'توجد وثيقة تأمين مرتبطة بالعميل تحتاج إلى مراجعة التجديد.',
          organizationId,
          ...(typeof current.assignedTo === 'string' ? { userId: current.assignedTo } : {}),
          ...(typeof current.clientId === 'string' ? { clientId: current.clientId } : {}),
          policyId: policySnapshot.id,
          link: '/policies/' + policySnapshot.id,
          read: false,
          actionRequired: true,
          actionUrl: '/policies/' + policySnapshot.id + '/renew',
          actionLabel: 'مراجعة التجديد',
          channels: ['in_app'],
          metadata: { reminderWindowDays: windowDays, daysLeft, expiryDate },
          createdAt: FieldValue.serverTimestamp(),
        });
        transaction.update(policyRef, { lastNotifiedAt: FieldValue.serverTimestamp() });
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
    console.error('cron-policy-check failed; details suppressed');
    return jsonResponse({ ok: false, error: 'CRON_JOB_FAILED' }, 500);
  }
});
