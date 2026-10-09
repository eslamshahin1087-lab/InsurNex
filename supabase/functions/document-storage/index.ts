import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  authorizeRecordAction,
  authorizeUpload,
  classifyStoragePath,
  parentRecordPath,
  resolveUniqueAttachmentRecord,
  resolveActiveMembership,
} from './policy.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-firebase-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const bucket = Deno.env.get('SUPABASE_DOCUMENT_BUCKET') || 'insurnex-documents';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function firestoreField(field: any): unknown {
  if (!field || typeof field !== 'object') return undefined;
  if ('stringValue' in field) return field.stringValue;
  if ('integerValue' in field) return Number(field.integerValue);
  if ('doubleValue' in field) return Number(field.doubleValue);
  if ('booleanValue' in field) return Boolean(field.booleanValue);
  if ('timestampValue' in field) return field.timestampValue;
  if ('nullValue' in field) return null;
  return undefined;
}

function firestoreData(document: any): Record<string, unknown> {
  const fields = document?.fields || {};
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, firestoreField(value)]));
}

function firestoreDocumentUrl(projectId: string, path: string) {
  const safePath = path.split('/').map(encodeURIComponent).join('/');
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${safePath}`;
}

async function getFirestoreDocument(projectId: string, path: string, token: string) {
  const response = await fetch(firestoreDocumentUrl(projectId, path), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('FIRESTORE_AUTHORIZATION_CHECK_FAILED');
  return firestoreData(await response.json());
}

async function verifyFirebase(token: string) {
  const apiKey = Deno.env.get('FIREBASE_WEB_API_KEY');
  if (!apiKey) throw new Error('FIREBASE_WEB_API_KEY_MISSING');
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    },
  );
  if (!response.ok) throw new Error('INVALID_FIREBASE_TOKEN');
  const data = await response.json();
  const uid = data?.users?.[0]?.localId as string | undefined;
  if (!uid) throw new Error('INVALID_FIREBASE_USER');
  return uid;
}

async function verifyMembership(projectId: string, organizationId: string, uid: string, token: string) {
  const [profile, member] = await Promise.all([
    getFirestoreDocument(projectId, `users/${uid}`, token),
    getFirestoreDocument(projectId, `organizations/${organizationId}/members/${uid}`, token),
  ]);
  const membership = resolveActiveMembership({ profile, member, organizationId, uid });
  if (!membership) throw new Error('ACTIVE_PROFILE_AND_ORGANIZATION_MEMBERSHIP_REQUIRED');
  return membership;
}

async function findAttachmentRecord(projectId: string, organizationId: string, path: string, token: string, uploaderId: string | null) {
  const records: Record<string, unknown>[] = [];
  for (const collectionName of ['documents', 'operationAttachments']) {
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents:runQuery`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: collectionName }],
            where: {
              compositeFilter: {
                op: 'AND',
                filters: [
                  {
                    fieldFilter: {
                      field: { fieldPath: 'organizationId' },
                      op: 'EQUAL',
                      value: { stringValue: organizationId },
                    },
                  },
                  {
                    fieldFilter: {
                      field: { fieldPath: 'storagePath' },
                      op: 'EQUAL',
                      value: { stringValue: path },
                    },
                  },
                ],
              },
            },
            limit: 2,
          },
        }),
      },
    );
    if (!response.ok) throw new Error('FILE_METADATA_AUTHORIZATION_CHECK_FAILED');
    const results = await response.json();
    records.push(...(Array.isArray(results) ? results : [])
      .filter((entry: any) => entry?.document)
      .map((entry: any) => firestoreData(entry.document))
      .filter((record: any) => record.organizationId === organizationId && record.storagePath === path));
  }

  // Reject ambiguous/duplicated metadata instead of choosing an arbitrary record.
  return resolveUniqueAttachmentRecord(records, organizationId, path, uploaderId);
}

async function verifyParentResource(projectId: string, organizationId: string, pathInfo: NonNullable<ReturnType<typeof classifyStoragePath>>, token: string) {
  const parent = parentRecordPath(pathInfo);
  if (!parent) throw new Error('INVALID_STORAGE_PATH');
  const data = await getFirestoreDocument(projectId, `${parent.collectionName}/${parent.documentId}`, token);
  if (!data || data.organizationId !== organizationId) {
    throw new Error('PARENT_RESOURCE_ORGANIZATION_MISMATCH');
  }
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const token = req.headers.get('x-firebase-token') || '';
    if (!token) return json({ ok: false, error: 'AUTH_REQUIRED' }, 401);

    const body = await req.json();
    const action = String(body.action || '');
    const organizationId = String(body.organizationId || '');
    const path = String(body.path || '');
    if (!organizationId || !path) return json({ ok: false, error: 'INVALID_STORAGE_PATH' }, 400);

    const uid = await verifyFirebase(token);
    const projectId = Deno.env.get('FIREBASE_PROJECT_ID') || '';
    if (!projectId) throw new Error('FIREBASE_PROJECT_ID_MISSING');

    const membership = await verifyMembership(projectId, organizationId, uid, token);
    const pathInfo = classifyStoragePath(path, organizationId, uid);
    if (!pathInfo) return json({ ok: false, error: 'INVALID_STORAGE_PATH' }, 400);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRole) throw new Error('SUPABASE_STORAGE_NOT_CONFIGURED');
    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    if (action === 'sign-upload') {
      const size = Number(body.size);
      const contentType = String(body.contentType || '');
      if (!authorizeUpload({ role: membership.role, pathInfo, uid, size, contentType })) {
        return json({ ok: false, error: 'UPLOAD_NOT_AUTHORIZED' }, 403);
      }
      await verifyParentResource(projectId, organizationId, pathInfo, token);
      const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path, { upsert: false });
      if (error) throw error;
      return json({ ok: true, path, token: data.token });
    }

    if (action === 'delete' || action === 'sign-download') {
      const record = await findAttachmentRecord(projectId, organizationId, path, token, pathInfo.uploaderId);
      if (!authorizeRecordAction({
        action,
        organizationId,
        path,
        pathInfo,
        role: membership.role,
        uid,
        record,
      })) {
        return json({ ok: false, error: 'FILE_ACCESS_DENIED' }, 403);
      }
      if (action === 'delete') {
        const { error } = await admin.storage.from(bucket).remove([path]);
        if (error) throw error;
        return json({ ok: true });
      }
      const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 300);
      if (error) throw error;
      return json({ ok: true, signedUrl: data.signedUrl });
    }

    return json({ ok: false, error: 'UNKNOWN_ACTION' }, 400);
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: error instanceof Error ? error.message : 'DOCUMENT_STORAGE_ERROR' }, 403);
  }
});
