// ============================================================
// Supabase Edge Function: cron-policy-check
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import {
  initializeApp,
  cert,
  getApps,
} from 'npm:firebase-admin@12.7.0/app';
import {
  getFirestore,
  FieldValue,
} from 'npm:firebase-admin@12.7.0/firestore';

const SERVICE_ACCOUNT_JSON = Deno.env.get('FIREBASE_SERVICE_ACCOUNT') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

let db: ReturnType<typeof getFirestore> | null = null;

function initAdmin() {
  if (db) return db;
  if (!SERVICE_ACCOUNT_JSON) throw new Error('FIREBASE_SERVICE_ACCOUNT_NOT_CONFIGURED');
  const credentials = JSON.parse(SERVICE_ACCOUNT_JSON);
  if (!getApps().length) {
    initializeApp({ credential: cert(credentials) });
  }
  db = getFirestore();
  db.settings({ preferRest: true });
  return db;
}

// ============================================================
// التحقق من الطلب — يقبل طريقتين
// ============================================================
function isAuthorized(req: Request): { ok: boolean; reason?: string } {
  const cronHeader = req.headers.get('x-cron-secret') ?? '';
  const authHeader = req.headers.get('authorization') ?? '';
  const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();

  // طريقة 1: x-cron-secret
  if (CRON_SECRET && cronHeader === CRON_SECRET) {
    return { ok: true };
  }

  // طريقة 2: Bearer مع Service Role Key
  if (SERVICE_ROLE_KEY && bearer === SERVICE_ROLE_KEY) {
    return { ok: true };
  }

  return {
    ok: false,
    reason: `CRON_SECRET_configured=${!!CRON_SECRET}, SERVICE_ROLE_configured=${!!SERVICE_ROLE_KEY}`,
  };
}

serve(async (req) => {
  const auth = isAuthorized(req);
  if (!auth.ok) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', detail: auth.reason }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const firestore = initAdmin();
    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(now.getDate() + 30);

    const snapshot = await firestore
      .collection('policies')
      .where('endDate', '>=', now.toISOString())
      .where('endDate', '<=', in30Days.toISOString())
      .where('status', '==', 'active')
      .get();

    if (snapshot.empty) {
      return new Response(
        JSON.stringify({ ok: true, created: 0, message: 'No expiring policies' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const batch = firestore.batch();
    const notificationsRef = firestore.collection('notifications');
    let count = 0;

    for (const docSnap of snapshot.docs) {
      const policy = docSnap.data();
      const endDate = new Date(policy.endDate);
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / 86400000);

      const lastNotified = policy.lastNotifiedAt?.toDate?.();
      if (lastNotified && now.getTime() - lastNotified.getTime() < 3 * 86400000) {
        continue;
      }

      const notifRef = notificationsRef.doc();
      batch.set(notifRef, {
        type: 'policy_expiring',
        priority: daysLeft <= 7 ? 'urgent' : daysLeft <= 15 ? 'high' : 'normal',
        title: `⚠️ بوليصة ${policy.policyNumber || ''} تنتهي خلال ${daysLeft} يوم`,
        body: `بوليصة العميل ${policy.clientName || ''} ستنتهي خلال ${daysLeft} يوم.`,
        organizationId: policy.organizationId,
        userId: policy.assignedTo || null,
        clientId: policy.clientId,
        policyId: docSnap.id,
        link: `/policies/${docSnap.id}`,
        read: false,
        actionRequired: true,
        actionUrl: `/policies/${docSnap.id}/renew`,
        actionLabel: 'تجديد الآن',
        channels: ['in_app'],
        metadata: { daysLeft, policyNumber: policy.policyNumber },
        createdAt: FieldValue.serverTimestamp(),
      });

      batch.update(docSnap.ref, {
        lastNotifiedAt: FieldValue.serverTimestamp(),
      });

      count++;
    }

    await batch.commit();

    return new Response(
      JSON.stringify({ ok: true, created: count }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('cron-policy-check failed:', e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'UNKNOWN' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});