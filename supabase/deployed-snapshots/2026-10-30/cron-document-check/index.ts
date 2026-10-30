// ============================================================
// Supabase Edge Function: cron-document-check
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

function isAuthorized(req: Request): { ok: boolean; reason?: string } {
  const cronHeader = req.headers.get('x-cron-secret') ?? '';
  const authHeader = req.headers.get('authorization') ?? '';
  const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (CRON_SECRET && cronHeader === CRON_SECRET) {
    return { ok: true };
  }
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
    const in15Days = new Date();
    in15Days.setDate(now.getDate() + 15);

    const snapshot = await firestore
      .collection('documents')
      .where('expiryDate', '>=', now.toISOString())
      .where('expiryDate', '<=', in15Days.toISOString())
      .get();

    if (snapshot.empty) {
      return new Response(
        JSON.stringify({ ok: true, created: 0 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const batch = firestore.batch();
    const notificationsRef = firestore.collection('notifications');
    let count = 0;

    for (const docSnap of snapshot.docs) {
      const document = docSnap.data();
      const expiryDate = new Date(document.expiryDate);
      const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / 86400000);

      const notifRef = notificationsRef.doc();
      batch.set(notifRef, {
        type: 'document_expiring',
        priority: daysLeft <= 7 ? 'high' : 'normal',
        title: `📄 مستند "${document.name || document.label || ''}" ينتهي خلال ${daysLeft} يوم`,
        body: `مستند "${document.name || document.label || ''}" سينتهي قريباً.`,
        organizationId: document.organizationId,
        userId: document.assignedTo || null,
        documentId: docSnap.id,
        clientId: document.clientId,
        link: `/documents/${docSnap.id}`,
        read: false,
        actionRequired: true,
        actionUrl: `/documents/${docSnap.id}`,
        actionLabel: 'تحديث المستند',
        channels: ['in_app'],
        metadata: { daysLeft, documentName: document.name },
        createdAt: FieldValue.serverTimestamp(),
      });

      count++;
    }

    await batch.commit();

    return new Response(
      JSON.stringify({ ok: true, created: count }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('cron-document-check failed:', e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : 'UNKNOWN' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});