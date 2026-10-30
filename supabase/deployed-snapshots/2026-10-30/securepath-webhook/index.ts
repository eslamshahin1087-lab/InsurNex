// ============================================================
// Supabase Edge Function: securepath-webhook
// ============================================================
// Receives events from SecurePath (external insurance platform).
// Creates clients + leads + notifications in InsurNex at signup.
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

// ============================================================
// CORS
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(error: string, status = 400, extra?: unknown): Response {
  return jsonResponse({ ok: false, error, ...(extra as object) }, status);
}

// ============================================================
// Firebase Admin Init
// ============================================================

const SERVICE_ACCOUNT_JSON = Deno.env.get('FIREBASE_SERVICE_ACCOUNT') ?? '';

let db: ReturnType<typeof getFirestore> | null = null;

function initAdmin() {
  if (db) return db;
  if (!SERVICE_ACCOUNT_JSON) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_NOT_CONFIGURED');
  }
  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(SERVICE_ACCOUNT_JSON);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_INVALID_JSON');
  }
  if (!getApps().length) {
    initializeApp({ credential: cert(credentials as never) });
  }
  db = getFirestore();
  db.settings({ preferRest: true });
  return db;
}

// ============================================================
// Types
// ============================================================

type EventSource =
  | 'signup'
  | 'points_redemption'
  | 'complaint'
  | 'renewal_request'
  | 'offer'
  | 'company_ad'
  | 'assessment'
  | 'referral'
  | 'offer_referral'
  | 'manual';

interface SecurePathPayload {
  source: 'securepath';
  eventSource: EventSource;
  securepathUid: string;
  externalId: string;
  submittedAt?: string;

  organizationId?: string;
  targetBrokerUid?: string;
  targetBrokerEmail?: string;

  client: {
    type: 'individual' | 'corporate';
    fullName?: string;
    nationalId?: string;
    dateOfBirth?: string;
    gender?: 'male' | 'female';
    maritalStatus?: string;
    companyName?: string;
    commercialRegister?: string;
    taxCard?: string;
    phone: string;
    email?: string;
    city?: string;
    area?: string;
    street?: string;
    occupation?: string;
    monthlyIncome?: number;
  };

  needs?: string[];
  riskData?: Record<string, unknown>;
  documents?: Array<{
    type: string;
    name: string;
    url: string;
    mimeType?: string;
    size?: number;
  }>;
  notes?: string;
}

// ============================================================
// Helpers
// ============================================================

async function hashKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function validatePayload(
  body: unknown,
): { ok: true; data: SecurePathPayload } | { ok: false; error: string } {
  if (!body || typeof body !== 'object')
    return { ok: false, error: 'INVALID_BODY' };
  const b = body as Record<string, unknown>;

  if (b.source !== 'securepath')
    return { ok: false, error: 'INVALID_SOURCE' };
  if (typeof b.externalId !== 'string' || !b.externalId)
    return { ok: false, error: 'MISSING_EXTERNAL_ID' };
  if (typeof b.securepathUid !== 'string' || !b.securepathUid)
    return { ok: false, error: 'MISSING_SECUREPATH_UID' };
  if (typeof b.eventSource !== 'string' || !b.eventSource)
    return { ok: false, error: 'MISSING_EVENT_SOURCE' };

  const hasOrg = typeof b.organizationId === 'string' && b.organizationId;
  const hasBrokerUid =
    typeof b.targetBrokerUid === 'string' && b.targetBrokerUid;
  const hasBrokerEmail =
    typeof b.targetBrokerEmail === 'string' && b.targetBrokerEmail;

  if (!hasOrg && !hasBrokerUid && !hasBrokerEmail) {
    return {
      ok: false,
      error: 'MISSING_TARGET — need organizationId/targetBrokerUid/Email',
    };
  }

  const client = b.client as Record<string, unknown> | undefined;
  if (!client || typeof client !== 'object')
    return { ok: false, error: 'MISSING_CLIENT' };
  if (typeof client.phone !== 'string' || !client.phone)
    return { ok: false, error: 'MISSING_CLIENT_PHONE' };
  if (client.type !== 'individual' && client.type !== 'corporate')
    return { ok: false, error: 'INVALID_CLIENT_TYPE' };

  return { ok: true, data: b as unknown as SecurePathPayload };
}

// ============================================================
// Resolve target
// ============================================================

interface ResolvedTarget {
  organizationId: string;
  assignedTo: string | null;
  brokerName: string | null;
}

async function resolveTarget(
  payload: SecurePathPayload,
): Promise<
  | { ok: true; target: ResolvedTarget }
  | { ok: false; error: string; detail?: unknown }
> {
  const db = initAdmin();

  if (payload.targetBrokerUid) {
    const snap = await db
      .collection('users')
      .doc(payload.targetBrokerUid)
      .get();
    if (!snap.exists) {
      return {
        ok: false,
        error: 'TARGET_BROKER_NOT_FOUND',
        detail: { uid: payload.targetBrokerUid },
      };
    }
    const data = snap.data() as {
      organizationId?: string;
      displayName?: string;
      status?: string;
    };
    if (data.status !== 'active') {
      return {
        ok: false,
        error: 'TARGET_BROKER_NOT_ACTIVE',
        detail: { uid: payload.targetBrokerUid, status: data.status },
      };
    }
    if (!data.organizationId) {
      return {
        ok: false,
        error: 'TARGET_BROKER_HAS_NO_ORG',
        detail: { uid: payload.targetBrokerUid },
      };
    }
    return {
      ok: true,
      target: {
        organizationId: data.organizationId,
        assignedTo: snap.id,
        brokerName: data.displayName || null,
      },
    };
  }

  if (payload.targetBrokerEmail) {
    const snap = await db
      .collection('users')
      .where('email', '==', payload.targetBrokerEmail)
      .where('status', '==', 'active')
      .limit(1)
      .get();
    if (snap.empty) {
      return {
        ok: false,
        error: 'TARGET_BROKER_NOT_FOUND',
        detail: { email: payload.targetBrokerEmail },
      };
    }
    const doc = snap.docs[0];
    const data = doc.data() as { organizationId?: string; displayName?: string };
    if (!data.organizationId) {
      return {
        ok: false,
        error: 'TARGET_BROKER_HAS_NO_ORG',
      };
    }
    return {
      ok: true,
      target: {
        organizationId: data.organizationId,
        assignedTo: doc.id,
        brokerName: data.displayName || null,
      },
    };
  }

  const orgId = payload.organizationId;
  if (!orgId) return { ok: false, error: 'MISSING_TARGET' };

  const orgSnap = await db.collection('organizations').doc(orgId).get();
  if (!orgSnap.exists) {
    return {
      ok: false,
      error: 'ORGANIZATION_NOT_FOUND',
      detail: { organizationId: orgId },
    };
  }
  return {
    ok: true,
    target: {
      organizationId: orgId,
      assignedTo: null,
      brokerName: null,
    },
  };
}

// ============================================================
// Client by SecurePath UID
// ============================================================

async function findClientBySecurePathUid(
  organizationId: string,
  securepathUid: string,
): Promise<{ id: string; data: Record<string, unknown> } | null> {
  const snap = await initAdmin()
    .collection('clients')
    .where('organizationId', '==', organizationId)
    .where('securepathUid', '==', securepathUid)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return {
    id: snap.docs[0].id,
    data: snap.docs[0].data() as Record<string, unknown>,
  };
}

// ============================================================
// Code Generators
// ============================================================

async function generateClientCode(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const counterId = `${organizationId}-${year}`;
  const counterRef = initAdmin().collection('clientCounters').doc(counterId);

  return await initAdmin().runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    if (!snap.exists) {
      tx.set(counterRef, {
        organizationId,
        year,
        count: 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return `CLI-${year}-0001`;
    }
    const current = (snap.data()?.count as number) || 0;
    const next = current + 1;
    tx.update(counterRef, {
      count: next,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return `CLI-${year}-${String(next).padStart(4, '0')}`;
  });
}

async function generateLeadCode(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const counterId = `lead-${organizationId}-${year}`;
  const counterRef = initAdmin().collection('clientCounters').doc(counterId);

  return await initAdmin().runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    if (!snap.exists) {
      tx.set(counterRef, {
        organizationId,
        year,
        type: 'lead',
        count: 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return `LEAD-${year}-0001`;
    }
    const current = (snap.data()?.count as number) || 0;
    const next = current + 1;
    tx.update(counterRef, {
      count: next,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return `LEAD-${year}-${String(next).padStart(4, '0')}`;
  });
}

// ============================================================
// Risk Assessment
// ============================================================

function computeRisk(payload: SecurePathPayload): {
  score: number;
  level: 'low' | 'medium' | 'high';
  factors: Array<{ name: string; impact: number; severity: string }>;
} {
  const factors: Array<{
    name: string;
    impact: number;
    severity: 'low' | 'medium' | 'high';
  }> = [];
  const add = (
    name: string,
    impact: number,
    severity: 'low' | 'medium' | 'high',
  ) => {
    if (impact > 0) factors.push({ name, impact, severity });
  };

  if (payload.client.dateOfBirth) {
    const age = Math.floor(
      (Date.now() - new Date(payload.client.dateOfBirth).getTime()) /
        (365.25 * 24 * 3600 * 1000),
    );
    if (age < 25) add('عمر صغير', 15, 'medium');
    else if (age > 60) add('عمر كبير', 20, 'high');
  }

  const total = factors.reduce((s, f) => s + f.impact, 0);
  const score = Math.max(0, Math.min(100, 100 - total));
  let level: 'low' | 'medium' | 'high' = 'low';
  if (score < 50) level = 'high';
  else if (score < 75) level = 'medium';

  return { score, level, factors };
}

// ============================================================
// Build Documents
// ============================================================

function buildClientDoc(
  payload: SecurePathPayload,
  organizationId: string,
  assignedTo: string | null,
  code: string,
  riskAssessment: ReturnType<typeof computeRisk>,
): Record<string, unknown> {
  const name =
    payload.client.type === 'individual'
      ? payload.client.fullName || 'بدون اسم'
      : payload.client.companyName || 'بدون اسم';

  const address = [
    payload.client.city,
    payload.client.area,
    payload.client.street,
  ]
    .filter(Boolean)
    .join(' — ');

  const doc: Record<string, unknown> = {
    code,
    type: payload.client.type,
    status: 'active',
    organizationId,
    source: 'securepath',
    eventSource: payload.eventSource,
    securepathUid: payload.securepathUid,
    externalId: payload.externalId,
    leadSource: payload.eventSource,

    name,
    phone: payload.client.phone,
    email: payload.client.email || '',
    city: payload.client.city || '',
    address,
    nationalId: payload.client.nationalId || '',

    needs: payload.needs || [],
    riskData: payload.riskData || {},
    documents: (payload.documents || []).map((d) => ({
      id: crypto.randomUUID(),
      type: d.type,
      label: d.name,
      url: d.url,
      fileName: d.name,
      mimeType: d.mimeType || 'application/pdf',
      size: d.size || 0,
      uploadedAt: new Date(),
      verified: false,
    })),

    riskAssessment,

    preferences: {
      contactMethod: 'whatsapp',
      bestTime: 'morning',
      whatsappOptIn: true,
    },
    lifetimeValue: 0,
    completeness: 70,
    tags: ['securepath', payload.eventSource],
    createdBy: 'securepath-webhook',
    notes: payload.notes || '',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (payload.client.type === 'individual') {
    doc.individual = {
      fullName: payload.client.fullName || '',
      nationalId: payload.client.nationalId || '',
      dateOfBirth: payload.client.dateOfBirth || '',
      gender: payload.client.gender || 'male',
      maritalStatus: payload.client.maritalStatus || 'single',
      phone: payload.client.phone,
      email: payload.client.email || '',
      city: payload.client.city || '',
      area: payload.client.area || '',
      street: payload.client.street || '',
      occupation: payload.client.occupation || '',
      employer: '',
      monthlyIncome: payload.client.monthlyIncome || 0,
    };
  }

  if (payload.client.type === 'corporate') {
    doc.corporate = {
      companyName: payload.client.companyName || '',
      commercialRegister: payload.client.commercialRegister || '',
      taxCard: payload.client.taxCard || '',
      phone: payload.client.phone,
      email: payload.client.email || '',
      city: payload.client.city || '',
      area: payload.client.area || '',
      street: payload.client.street || '',
    };
  }

  if (assignedTo) doc.assignedTo = assignedTo;

  return doc;
}

function buildLeadDoc(
  payload: SecurePathPayload,
  organizationId: string,
  assignedTo: string | null,
  leadCode: string,
  clientId: string,
  clientCode: string,
  riskAssessment: ReturnType<typeof computeRisk>,
  brokerName: string | null,
): Record<string, unknown> {
  const name =
    payload.client.type === 'individual'
      ? payload.client.fullName || 'بدون اسم'
      : payload.client.companyName || 'بدون اسم';

  const priority =
    riskAssessment.score >= 75
      ? 'high'
      : riskAssessment.score >= 50
        ? 'normal'
        : 'low';

  const doc: Record<string, unknown> = {
    leadCode,
    clientId,
    clientCode,
    organizationId,
    assignedTo: assignedTo || null,
    brokerName: brokerName || null,

    clientName: name,
    clientPhone: payload.client.phone,
    clientEmail: payload.client.email || '',
    clientType: payload.client.type,

    source: 'securepath',
    eventSource: payload.eventSource,
    externalId: payload.externalId,
    securepathUid: payload.securepathUid,

    status: 'new',
    priority,
    pipeline: 'new_lead',
    stage: 'awareness',

    needs: payload.needs || [],
    riskData: payload.riskData || {},
    riskScore: riskAssessment.score,
    riskLevel: riskAssessment.level,

    city: payload.client.city || '',
    occupation: payload.client.occupation || '',

    notes: payload.notes || `تم استيراده من SecurePath — ${payload.eventSource}`,
    tags: ['securepath', payload.eventSource, 'auto-created'],

    contactAttempts: 0,
    lastContactAt: null,
    nextFollowUpAt: null,

    createdBy: 'securepath-webhook',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  return doc;
}

// ============================================================
// Update Existing Client
// ============================================================

async function appendEventToTimeline(
  clientId: string,
  organizationId: string,
  payload: SecurePathPayload,
  brokerName: string | null,
): Promise<void> {
  try {
    await initAdmin()
      .collection('clients')
      .doc(clientId)
      .collection('timeline')
      .add({
        clientId,
        organizationId,
        type: 'note',
        title: `حدث جديد من SecurePath — ${payload.eventSource}`,
        description:
          payload.notes ||
          `المصدر: ${payload.eventSource}` +
            (brokerName ? ` — موكل إلى ${brokerName}` : ''),
        by: 'securepath-webhook',
        byName: 'SecurePath Integration',
        at: FieldValue.serverTimestamp(),
        metadata: {
          externalId: payload.externalId,
          eventSource: payload.eventSource,
        },
      });
  } catch (e) {
    console.warn('Timeline append failed:', e);
  }
}

async function updateExistingClient(
  clientId: string,
  existingData: Record<string, unknown>,
  payload: SecurePathPayload,
  organizationId: string,
  brokerName: string | null,
): Promise<Response> {
  const db = initAdmin();

  const existingNeeds = Array.isArray(existingData.needs)
    ? (existingData.needs as string[])
    : [];
  const newNeeds = Array.isArray(payload.needs) ? payload.needs : [];
  const mergedNeeds = Array.from(new Set([...existingNeeds, ...newNeeds]));

  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    needs: mergedNeeds,
  };

  if (!existingData.email && payload.client.email) {
    updates.email = payload.client.email;
  }
  if (!existingData.city && payload.client.city) {
    updates.city = payload.client.city;
  }
  if (!existingData.nationalId && payload.client.nationalId) {
    updates.nationalId = payload.client.nationalId;
  }
  if (!existingData.occupation && payload.client.occupation) {
    updates.occupation = payload.client.occupation;
  }

  await db.collection('clients').doc(clientId).update(updates);

  await appendEventToTimeline(clientId, organizationId, payload, brokerName);

  await db.collection('incomingLeads').add({
    source: 'securepath',
    eventSource: payload.eventSource,
    externalId: payload.externalId,
    organizationId,
    status: 'updated',
    clientId,
    apiKeyId: 'from-request',
    clientName: String(existingData.name || ''),
    needs: newNeeds,
    receivedAt: FieldValue.serverTimestamp(),
  });

  return jsonResponse({
    ok: true,
    clientId,
    event: payload.eventSource,
    action: 'updated',
    message: 'Existing client updated with new event',
  });
}

// ============================================================
// Handle Webhook
// ============================================================

async function handleWebhook(
  payload: SecurePathPayload,
  apiKeyId: string,
): Promise<Response> {
  const db = initAdmin();

  // 1. Resolve target broker/org
  const resolved = await resolveTarget(payload);
  if (!resolved.ok) {
    return errorResponse(resolved.error, 404, resolved.detail);
  }
  const { organizationId, assignedTo, brokerName } = resolved.target;

  // 2. Check if client already exists
  const existing = await findClientBySecurePathUid(
    organizationId,
    payload.securepathUid,
  );

  if (existing) {
    return await updateExistingClient(
      existing.id,
      existing.data,
      payload,
      organizationId,
      brokerName,
    );
  }

  // ============================================================
  // 3. NEW CLIENT — Create client + lead + notification
  // ============================================================

  // 3.1: إنشاء كود العميل
  const code = await generateClientCode(organizationId);
  const riskAssessment = computeRisk(payload);
  const clientDoc = buildClientDoc(
    payload,
    organizationId,
    assignedTo,
    code,
    riskAssessment,
  );

  Object.keys(clientDoc).forEach((k) => {
    if (clientDoc[k] === null) delete clientDoc[k];
  });

  // 3.2: إنشاء العميل
  const clientRef = await db.collection('clients').add(clientDoc);
  const clientId = clientRef.id;

  // 3.3: إنشاء كود الـ Lead
  const leadCode = await generateLeadCode(organizationId);
  const leadDoc = buildLeadDoc(
    payload,
    organizationId,
    assignedTo,
    leadCode,
    clientId,
    code,
    riskAssessment,
    brokerName,
  );

  Object.keys(leadDoc).forEach((k) => {
    if (leadDoc[k] === null) delete leadDoc[k];
  });

  // 3.4: إنشاء الـ Lead
  const leadRef = await db.collection('leads').add(leadDoc);
  const leadId = leadRef.id;

  // 3.5: ربط الـ Lead بالعميل
  await db.collection('clients').doc(clientId).update({
    leadId,
    leadCode,
  });

  // 3.6: إضافة الحدث الأول في timeline
  try {
    await db
      .collection('clients')
      .doc(clientId)
      .collection('timeline')
      .add({
        clientId,
        organizationId,
        type: 'created',
        title: `تم استيراد العميل من SecurePath — ${payload.eventSource}`,
        description: brokerName
          ? `كود: ${code} — موكل إلى: ${brokerName}`
          : `كود: ${code}`,
        by: 'securepath-webhook',
        byName: 'SecurePath Integration',
        at: FieldValue.serverTimestamp(),
        metadata: {
          externalId: payload.externalId,
          securepathUid: payload.securepathUid,
          eventSource: payload.eventSource,
          assignedTo,
          leadId,
          leadCode,
        },
      });
  } catch (e) {
    console.warn('Timeline entry failed:', e);
  }

  // 3.7: إضافة الحدث الأول في lead timeline
  try {
    await db
      .collection('leads')
      .doc(leadId)
      .collection('timeline')
      .add({
        leadId,
        clientId,
        organizationId,
        type: 'created',
        title: `تم إنشاء الـ Lead من SecurePath`,
        description: `كود العميل: ${code} — كود الـ Lead: ${leadCode}`,
        by: 'securepath-webhook',
        byName: 'SecurePath Integration',
        at: FieldValue.serverTimestamp(),
        metadata: {
          externalId: payload.externalId,
          eventSource: payload.eventSource,
        },
      });
  } catch (e) {
    console.warn('Lead timeline entry failed:', e);
  }

  // ============================================================
  // 3.8: إنشاء إشعار للـ Lead الجديد (جديد!)
  // ============================================================
  try {
    await db.collection('notifications').add({
      type: 'lead_created',
      priority: riskAssessment.score >= 75 ? 'high' : 'normal',
      title: `🎯 عميل محتمل جديد: ${String(clientDoc.name || '')}`,
      body: `تم إضافة عميل محتمل جديد من SecurePath. كود: ${leadCode}`,
      organizationId,
      userId: assignedTo || null,
      clientId,
      leadId,
      link: `/leads/${leadId}`,
      read: false,
      actionRequired: false,
      actionUrl: `/leads/${leadId}`,
      actionLabel: 'عرض العميل المحتمل',
      channels: ['in_app'],
      metadata: {
        source: 'securepath',
        clientName: String(clientDoc.name || ''),
        riskScore: riskAssessment.score,
        leadCode,
        clientCode: code,
      },
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.warn('Notification creation failed:', e);
  }

  // 3.9: تسجيل في incomingLeads
  await db.collection('incomingLeads').add({
    source: 'securepath',
    eventSource: payload.eventSource,
    externalId: payload.externalId,
    securepathUid: payload.securepathUid,
    organizationId,
    status: 'created',
    clientId,
    clientCode: code,
    leadId,
    leadCode,
    apiKeyId,
    clientName: String(clientDoc.name || ''),
    assignedTo,
    needs: payload.needs || [],
    riskScore: riskAssessment.score,
    receivedAt: FieldValue.serverTimestamp(),
  });

  return jsonResponse({
    ok: true,
    clientId,
    clientCode: code,
    leadId,
    leadCode,
    organizationId,
    assignedTo,
    event: payload.eventSource,
    action: 'created',
    message: 'Client, Lead, and Notification created successfully',
  });
}

// ============================================================
// Main
// ============================================================

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    if (url.searchParams.get('ping') === '1') {
      return jsonResponse({
        ok: true,
        service: 'securepath-webhook',
        method: req.method,
        hasServiceAccount: !!SERVICE_ACCOUNT_JSON,
        version: 'v4-notifications',
        timestamp: new Date().toISOString(),
      });
    }
  } catch {
    /* ignore */
  }

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 405);
  }

  const apiKey =
    req.headers.get('x-api-key') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    '';
  if (!apiKey) {
    return errorResponse('MISSING_API_KEY', 401);
  }

  let apiKeyId = '';
  try {
    const db = initAdmin();
    const hashed = await hashKey(apiKey);
    const snap = await db
      .collection('integrationKeys')
      .where('hashedKey', '==', hashed)
      .where('enabled', '==', true)
      .limit(1)
      .get();
    if (snap.empty) {
      return errorResponse('INVALID_API_KEY', 401);
    }
    apiKeyId = snap.docs[0].id;
    snap.docs[0].ref
      .update({
        lastUsedAt: FieldValue.serverTimestamp(),
        usageCount: FieldValue.increment(1),
      })
      .catch(() => undefined);
  } catch (e) {
    console.error('API key validation failed:', e);
    return errorResponse('AUTH_CHECK_FAILED', 500, {
      detail: e instanceof Error ? e.message : 'UNKNOWN',
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('INVALID_JSON');
  }

  const validation = validatePayload(body);
  if (!validation.ok) {
    return errorResponse(validation.error);
  }

  try {
    return await handleWebhook(validation.data, apiKeyId);
  } catch (e) {
    console.error('Webhook error:', e);
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    return errorResponse('INTERNAL_ERROR', 500, { detail: msg });
  }
});