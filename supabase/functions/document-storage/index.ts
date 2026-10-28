// Supabase Edge Function: document-storage
// All document operations require an active InsurNex profile in the requested
// organization and access to the target client record.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { metadataMatchesPath, parseDocumentPath, roleCanAccessDocument } from './access-policy.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-firebase-token',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(error: string, status = 400): Response {
  return jsonResponse({ ok: false, error }, status);
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FIREBASE_API_KEY = Deno.env.get('FIREBASE_API_KEY') ?? Deno.env.get('FIREBASE_WEB_API_KEY') ?? '';
// Must be configured in Supabase Edge Function secrets. Missing config fails closed.
const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID') ?? '';
const DEFAULT_BUCKET = Deno.env.get('DOCUMENT_BUCKET') ?? 'insurnex-documents';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

function adminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_CONFIG_MISSING');
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface FirebaseUser {
  uid: string;
  email?: string;
  name?: string;
}

interface FirestoreDocument {
  fields?: Record<string, {
    stringValue?: string;
    booleanValue?: boolean;
    integerValue?: string;
    doubleValue?: number;
  }>;
}

async function verifyFirebaseToken(token: string): Promise<FirebaseUser> {
  if (!FIREBASE_API_KEY) throw new Error('FIREBASE_API_KEY_NOT_CONFIGURED');
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    },
  );
  if (!res.ok) throw new Error('FIREBASE_TOKEN_INVALID');
  const data = await res.json();
  const user = data?.users?.[0];
  if (!user?.localId || user.disabled === true) throw new Error('FIREBASE_TOKEN_INVALID');
  return { uid: user.localId, email: user.email, name: user.displayName };
}

function extractToken(req: Request): string | null {
  const headerToken = req.headers.get('x-firebase-token');
  if (headerToken) return headerToken;
  const auth = req.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return null;
}

function stringField(document: FirestoreDocument | null, field: string): string | null {
  const value = document?.fields?.[field]?.stringValue;
  return typeof value === 'string' ? value : null;
}

function numberField(document: FirestoreDocument | null, field: string): number | null {
  const value = document?.fields?.[field];
  if (typeof value?.doubleValue === 'number') return value.doubleValue;
  if (typeof value?.integerValue === 'string') {
    const parsed = Number(value.integerValue);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Reads Firestore using the caller's ID token so Firestore Security Rules apply.
 * No service/admin credentials are used for authorization reads.
 */
async function readCallerVisibleDocument(path: string, token: string): Promise<FirestoreDocument | null> {
  if (!FIREBASE_PROJECT_ID) throw new Error('FIREBASE_PROJECT_ID_NOT_CONFIGURED');
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}/databases/(default)/documents/${encodedPath}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (res.status === 401 || res.status === 403) throw new Error('FIRESTORE_ACCESS_DENIED');
  if (!res.ok) throw new Error('FIRESTORE_LOOKUP_FAILED');
  return await res.json() as FirestoreDocument;
}

type AuthorizedDocument = {
  layout: 'client' | 'general';
  organizationId: string;
  clientId?: string;
  documentId: string;
  area?: string;
  path: string;
  filename: string;
};

const RELATION_COLLECTION: Record<string, string> = {
  client: 'clients',
  policy: 'policies',
  claim: 'claims',
};

async function authorizeDocumentAccess(
  organizationId: string,
  documentId: string,
  path: string,
  user: FirebaseUser,
  token: string,
  action: 'read' | 'write' | 'delete',
  expectedFile?: { contentType?: string; size?: number },
): Promise<{ ok: true; document: AuthorizedDocument } | { ok: false; response: Response }> {
  if (!organizationId || !/^[A-Za-z0-9_-]{1,128}$/.test(organizationId)) {
    return { ok: false, response: errorResponse('INVALID_ORGANIZATION', 400) };
  }
  if (!documentId || !/^[A-Za-z0-9_-]{1,128}$/.test(documentId)) {
    return { ok: false, response: errorResponse('INVALID_DOCUMENT_ID', 400) };
  }
  const parsed = parseDocumentPath(path, organizationId) as AuthorizedDocument | null;
  if (!parsed) return { ok: false, response: errorResponse('INVALID_DOCUMENT_PATH', 400) };

  // A caller must present the ID of the exact metadata record, and the path's
  // embedded ID (or client-file prefix) must agree with it.
  if (parsed.layout === 'general' && parsed.documentId !== documentId) {
    return { ok: false, response: errorResponse('DOCUMENT_PATH_ID_MISMATCH', 403) };
  }

  try {
    const profile = await readCallerVisibleDocument(`users/${user.uid}`, token);
    if (!profile) return { ok: false, response: errorResponse('ACTIVE_PROFILE_REQUIRED', 403) };

    const profileOrg = stringField(profile, 'organizationId');
    const status = stringField(profile, 'status');
    const role = stringField(profile, 'role') ?? '';
    if (status !== 'active' || profileOrg !== organizationId) {
      return { ok: false, response: errorResponse('ORGANIZATION_ACCESS_DENIED', 403) };
    }

    // All storage layouts are authorized against the specific Firestore metadata
    // record read with the caller token so Firestore Rules remain in force.
    const metadata = await readCallerVisibleDocument(`documents/${documentId}`, token);
    if (!metadata) return { ok: false, response: errorResponse('DOCUMENT_RECORD_NOT_FOUND', 404) };
    const metadataView = {
      organizationId: stringField(metadata, 'organizationId'),
      storagePath: stringField(metadata, 'storagePath'),
      storageProvider: stringField(metadata, 'storageProvider'),
      storageBucket: stringField(metadata, 'storageBucket'),
      storageKeyVersion: numberField(metadata, 'storageKeyVersion'),
      uploadedBy: stringField(metadata, 'uploadedBy'),
      relatedType: stringField(metadata, 'relatedType'),
      relatedId: stringField(metadata, 'relatedId'),
      category: stringField(metadata, 'category'),
      contentType: stringField(metadata, 'contentType'),
      size: numberField(metadata, 'size'),
    };
    if (!metadataMatchesPath(metadataView, {
      layout: parsed.layout,
      organizationId,
      ...(parsed.clientId ? { clientId: parsed.clientId } : {}),
      documentId,
      ...(parsed.documentId ? { pathDocumentId: parsed.documentId } : {}),
      ...(parsed.area ? { area: parsed.area } : {}),
      path,
      filename: parsed.filename,
      bucket: DEFAULT_BUCKET,
      ...(action === 'write' ? { actorUid: user.uid } : {}),
      ...(expectedFile?.contentType ? { contentType: expectedFile.contentType } : {}),
      ...(typeof expectedFile?.size === 'number' ? { size: expectedFile.size } : {}),
    })) {
      return { ok: false, response: errorResponse('DOCUMENT_RECORD_MISMATCH', 403) };
    }

    if (!roleCanAccessDocument(role, metadataView.category, action, {
      layout: parsed.layout,
      relatedType: metadataView.relatedType,
      documentIdMatchesPath: parsed.layout === 'general' || parsed.filename.startsWith(documentId + '-'),
    })) {
      return { ok: false, response: errorResponse(action === 'delete' ? 'DELETE_NOT_ALLOWED' : 'DOCUMENT_ROLE_ACCESS_DENIED', 403) };
    }

    if (parsed.layout === 'client') {
      const client = await readCallerVisibleDocument(`clients/${parsed.clientId}`, token);
      if (!client) return { ok: false, response: errorResponse('CLIENT_NOT_FOUND', 404) };
      if (stringField(client, 'organizationId') !== organizationId) {
        return { ok: false, response: errorResponse('CLIENT_ACCESS_DENIED', 403) };
      }
    } else {
      // General document paths may relate to a client, policy, claim, or the
      // organization itself. Verify parent tenancy before signing any URL.
      const relatedType = metadataView.relatedType;
      if (relatedType === 'general') {
        if (!['owner', 'admin', 'broker'].includes(role)) {
          return { ok: false, response: errorResponse('GENERAL_DOCUMENT_ACCESS_DENIED', 403) };
        }
      } else {
        const parentCollection = RELATION_COLLECTION[relatedType ?? ''];
        const relatedId = metadataView.relatedId;
        if (!parentCollection || !relatedId || !/^[A-Za-z0-9_-]{1,128}$/.test(relatedId)) {
          return { ok: false, response: errorResponse('INVALID_DOCUMENT_RELATION', 403) };
        }
        const parent = await readCallerVisibleDocument(`${parentCollection}/${relatedId}`, token);
        if (!parent) return { ok: false, response: errorResponse('RELATED_RECORD_NOT_FOUND', 404) };
        if (stringField(parent, 'organizationId') !== organizationId) {
          return { ok: false, response: errorResponse('RELATED_RECORD_ACCESS_DENIED', 403) };
        }
      }
    }

    return { ok: true, document: parsed };
  } catch (error) {
    // Do not disclose upstream errors or document metadata to the caller.
    console.error('Document authorization failed:', error instanceof Error ? error.message : 'UNKNOWN');
    return { ok: false, response: errorResponse('AUTHORIZATION_CHECK_FAILED', 403) };
  }
}

async function handleSignUpload(body: Record<string, unknown>, user: FirebaseUser, token: string): Promise<Response> {
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId : '';
  const documentId = typeof body.documentId === 'string' ? body.documentId : '';
  const path = typeof body.path === 'string' ? body.path : '';
  const contentType = typeof body.contentType === 'string' ? body.contentType : '';
  const size = body.size;

  if (!contentType) return errorResponse('MISSING_CONTENT_TYPE', 400);
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) {
    return errorResponse('INVALID_FILE_SIZE', 400);
  }
  if (size > MAX_FILE_SIZE) return errorResponse('FILE_TOO_LARGE', 413);
  if (!ALLOWED_MIME.has(contentType)) return errorResponse('FILE_TYPE_NOT_ALLOWED', 415);

  const access = await authorizeDocumentAccess(organizationId, documentId, path, user, token, 'write', { contentType, size });
  if (!access.ok) return access.response;

  const { data, error } = await adminClient().storage.from(DEFAULT_BUCKET).createSignedUploadUrl(access.document.path);
  if (error || !data?.token || !data?.path) {
    console.error('Create signed upload URL failed:', error?.message ?? 'NO_URL');
    return errorResponse('SIGN_UPLOAD_FAILED', 500);
  }
  return jsonResponse({
    ok: true,
    provider: 'supabase',
    bucket: DEFAULT_BUCKET,
    path: data.path,
    token: data.token,
    uploadedBy: user.uid,
  });
}

async function handleSignDownload(body: Record<string, unknown>, user: FirebaseUser, token: string): Promise<Response> {
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId : '';
  const documentId = typeof body.documentId === 'string' ? body.documentId : '';
  const path = typeof body.path === 'string' ? body.path : '';
  const access = await authorizeDocumentAccess(organizationId, documentId, path, user, token, 'read');
  if (!access.ok) return access.response;

  const { data, error } = await adminClient().storage.from(DEFAULT_BUCKET)
    .createSignedUrl(access.document.path, 60 * 60); // 1 hour
  if (error || !data?.signedUrl) {
    console.error('Create signed download URL failed:', error?.message ?? 'NO_URL');
    return errorResponse('SIGNED_URL_FAILED', 500);
  }
  return jsonResponse({ ok: true, signedUrl: data.signedUrl, path: access.document.path });
}

async function handleDelete(body: Record<string, unknown>, user: FirebaseUser, token: string): Promise<Response> {
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId : '';
  const documentId = typeof body.documentId === 'string' ? body.documentId : '';
  const path = typeof body.path === 'string' ? body.path : '';
  const access = await authorizeDocumentAccess(organizationId, documentId, path, user, token, 'delete');
  if (!access.ok) return access.response;

  const { error } = await adminClient().storage.from(DEFAULT_BUCKET).remove([access.document.path]);
  if (error) {
    console.error('Delete document failed:', error.message);
    return errorResponse('DELETE_FAILED', 500);
  }
  return jsonResponse({ ok: true });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Public liveness endpoint; do not disclose secret/configuration status.
  try {
    if (new URL(req.url).searchParams.get('ping') === '1') {
      return jsonResponse({
        ok: true,
        service: 'document-storage',
        supportedActions: ['sign-upload', 'sign-download', 'delete'],
        timestamp: new Date().toISOString(),
      });
    }
  } catch {
    // Invalid URL falls through to normal validation.
  }

  if (req.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', 405);

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return errorResponse('INVALID_JSON', 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return errorResponse('INVALID_JSON', 400);
  }

  const token = extractToken(req);
  if (!token) return errorResponse('AUTH_REQUIRED', 401);

  let user: FirebaseUser;
  try {
    user = await verifyFirebaseToken(token);
  } catch (error) {
    console.error('Firebase token verification failed:', error instanceof Error ? error.message : 'UNKNOWN');
    return errorResponse('AUTH_INVALID', 401);
  }

  try {
    switch (body.action) {
      case 'sign-upload': return await handleSignUpload(body, user, token);
      case 'sign-download': return await handleSignDownload(body, user, token);
      case 'delete': return await handleDelete(body, user, token);
      default: return errorResponse('UNKNOWN_ACTION', 400);
    }
  } catch (error) {
    console.error('Document storage operation failed:', error instanceof Error ? error.message : 'UNKNOWN');
    return errorResponse('INTERNAL_ERROR', 500);
  }
});
