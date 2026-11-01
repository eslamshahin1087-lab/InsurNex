// Supabase Edge Function: document-storage
// All document operations require an active InsurNex profile in the requested
// organization and access to the target client record.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  metadataMatchesPath,
  parseDocumentPath,
  roleCanAccessDocument,
  parseOperationAttachmentPath,
  operationAttachmentMetadataMatchesPath,
  roleCanAccessOperationAttachment,
  parseLegacyClientDocumentReference,
  roleCanAccessLegacyClientDocument,
  legacyObjectMetadataMatches,
} from './access-policy.mjs';
import { isAllowedSupabaseApiKey } from '../_shared/api-key-authorization.ts';

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

function authorizationFailure(error: unknown): Response {
  if (error instanceof Error && error.message === 'FIRESTORE_LOOKUP_UNAVAILABLE') {
    return errorResponse('AUTHORIZATION_TEMPORARILY_UNAVAILABLE', 503);
  }
  return errorResponse('AUTHORIZATION_CHECK_FAILED', 403);
}

async function readLimitedRequestBody(req: Request): Promise<string> {
  const declaredLength = Number(req.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
    throw new Error('REQUEST_TOO_LARGE');
  }
  if (!req.body) return '';

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel();
        throw new Error('REQUEST_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}


const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FIREBASE_API_KEY = Deno.env.get('FIREBASE_API_KEY') ?? Deno.env.get('FIREBASE_WEB_API_KEY') ?? '';
// Must be configured in Supabase Edge Function secrets. Missing config fails closed.
const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID') ?? '';
const DEFAULT_BUCKET = Deno.env.get('DOCUMENT_BUCKET') ?? 'insurnex-documents';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_REQUEST_BODY_BYTES = 64 * 1024;
const FIREBASE_TOKEN_TIMEOUT_MS = 10_000;
const FIRESTORE_READ_TIMEOUT_MS = 10_000;
const DOWNLOAD_URL_TTL_SECONDS = 15 * 60;
const MAX_FIREBASE_TOKEN_LENGTH = 16_384;
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

interface FirestoreValue {
  stringValue?: string;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  mapValue?: { fields?: Record<string, FirestoreValue> };
  arrayValue?: { values?: FirestoreValue[] };
}

interface FirestoreDocument {
  fields?: Record<string, FirestoreValue>;
}

async function verifyFirebaseToken(token: string): Promise<FirebaseUser> {
  if (!FIREBASE_API_KEY) throw new Error('FIREBASE_VERIFICATION_UNAVAILABLE');
  if (!token || token.length > MAX_FIREBASE_TOKEN_LENGTH) throw new Error('FIREBASE_TOKEN_INVALID');

  let res: Response;
  try {
    res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
        signal: AbortSignal.timeout(FIREBASE_TOKEN_TIMEOUT_MS),
      },
    );
  } catch {
    throw new Error('FIREBASE_VERIFICATION_UNAVAILABLE');
  }

  if (res.status === 429 || res.status >= 500) {
    throw new Error('FIREBASE_VERIFICATION_UNAVAILABLE');
  }
  if (!res.ok) throw new Error('FIREBASE_TOKEN_INVALID');

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error('FIREBASE_VERIFICATION_UNAVAILABLE');
  }
  const user = (data as { users?: Array<{ localId?: string; disabled?: boolean; email?: string; displayName?: string }> })?.users?.[0];
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

function stringValue(value: FirestoreValue | undefined): string | null {
  return typeof value?.stringValue === 'string' ? value.stringValue : null;
}

function stringFieldsValue(fields: Record<string, FirestoreValue> | undefined, field: string): string | null {
  return stringValue(fields?.[field]);
}

function stringField(document: FirestoreDocument | null, field: string): string | null {
  return stringFieldsValue(document?.fields, field);
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
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(FIRESTORE_READ_TIMEOUT_MS),
    });
  } catch {
    throw new Error('FIRESTORE_LOOKUP_UNAVAILABLE');
  }
  if (res.status === 404) return null;
  if (res.status === 429 || res.status >= 500) throw new Error('FIRESTORE_LOOKUP_UNAVAILABLE');
  if (res.status === 401 || res.status === 403) throw new Error('FIRESTORE_ACCESS_DENIED');
  if (!res.ok) throw new Error('FIRESTORE_LOOKUP_FAILED');
  try {
    return await res.json() as FirestoreDocument;
  } catch {
    throw new Error('FIRESTORE_LOOKUP_FAILED');
  }
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
    console.error('Document authorization failed');
    return { ok: false, response: authorizationFailure(error) };
  }
}


type AuthorizedOperationAttachment = {
  layout: 'operation';
  organizationId: string;
  operationId: string;
  path: string;
  filename: string;
};

const OPERATION_ATTACHMENT_MIME = new Set([
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/csv',
]);

async function authorizeOperationAttachmentAccess(
  organizationId: string,
  operationId: string,
  attachmentId: string,
  path: string,
  user: FirebaseUser,
  token: string,
  action: 'read' | 'write' | 'delete',
  expectedFile?: { contentType?: string; size?: number },
): Promise<{ ok: true; attachment: AuthorizedOperationAttachment } | { ok: false; response: Response }> {
  if (!organizationId || !/^[A-Za-z0-9_-]{1,128}$/.test(organizationId)) {
    return { ok: false, response: errorResponse('INVALID_ORGANIZATION', 400) };
  }
  if (!operationId || !/^[A-Za-z0-9_-]{1,128}$/.test(operationId)) {
    return { ok: false, response: errorResponse('INVALID_OPERATION_ID', 400) };
  }
  if (!attachmentId || !/^[A-Za-z0-9_-]{1,128}$/.test(attachmentId)) {
    return { ok: false, response: errorResponse('INVALID_ATTACHMENT_ID', 400) };
  }
  const parsed = parseOperationAttachmentPath(path, organizationId) as AuthorizedOperationAttachment | null;
  if (!parsed || parsed.operationId !== operationId || !parsed.filename.startsWith(attachmentId + '-')) {
    return { ok: false, response: errorResponse('INVALID_OPERATION_ATTACHMENT_PATH', 400) };
  }

  try {
    const profile = await readCallerVisibleDocument(`users/${user.uid}`, token);
    if (!profile) return { ok: false, response: errorResponse('ACTIVE_PROFILE_REQUIRED', 403) };
    const role = stringField(profile, 'role') ?? '';
    if (stringField(profile, 'status') !== 'active'
        || stringField(profile, 'organizationId') !== organizationId) {
      return { ok: false, response: errorResponse('ORGANIZATION_ACCESS_DENIED', 403) };
    }

    const metadata = await readCallerVisibleDocument(`operationAttachments/${attachmentId}`, token);
    if (!metadata) return { ok: false, response: errorResponse('OPERATION_ATTACHMENT_NOT_FOUND', 404) };
    const metadataView = {
      organizationId: stringField(metadata, 'organizationId'),
      operationId: stringField(metadata, 'operationId'),
      storagePath: stringField(metadata, 'storagePath'),
      storageProvider: stringField(metadata, 'storageProvider'),
      storageBucket: stringField(metadata, 'storageBucket'),
      storageKeyVersion: numberField(metadata, 'storageKeyVersion'),
      downloadUrl: stringField(metadata, 'downloadUrl'),
      uploadedBy: stringField(metadata, 'uploadedBy'),
      contentType: stringField(metadata, 'contentType'),
      size: numberField(metadata, 'size'),
    };
    if (!operationAttachmentMetadataMatchesPath(metadataView, {
      organizationId, operationId, attachmentId, path, filename: parsed.filename,
      bucket: DEFAULT_BUCKET,
      ...(action === 'write' ? { actorUid: user.uid } : {}),
      ...(expectedFile?.contentType ? { contentType: expectedFile.contentType } : {}),
      ...(typeof expectedFile?.size === 'number' ? { size: expectedFile.size } : {}),
    })) {
      return { ok: false, response: errorResponse('OPERATION_ATTACHMENT_RECORD_MISMATCH', 403) };
    }
    const uploadState = stringField(metadata, 'uploadState');
    if ((action === 'write' && uploadState !== 'pending') || (action !== 'write' && uploadState !== 'ready')) {
      return { ok: false, response: errorResponse('OPERATION_ATTACHMENT_STATE_INVALID', 409) };
    }
    if (!roleCanAccessOperationAttachment(role, action)) {
      return { ok: false, response: errorResponse(action === 'delete' ? 'DELETE_NOT_ALLOWED' : 'OPERATION_ATTACHMENT_ACCESS_DENIED', 403) };
    }

    const operation = await readCallerVisibleDocument(`operations/${operationId}`, token);
    if (!operation) return { ok: false, response: errorResponse('OPERATION_NOT_FOUND', 404) };
    if (stringField(operation, 'organizationId') !== organizationId) {
      return { ok: false, response: errorResponse('OPERATION_ACCESS_DENIED', 403) };
    }
    return { ok: true, attachment: parsed };
  } catch (error) {
    console.error('Operation attachment authorization failed');
    return { ok: false, response: authorizationFailure(error) };
  }
}

async function handleOperationAttachmentSignUpload(body: Record<string, unknown>, user: FirebaseUser, token: string): Promise<Response> {
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId : '';
  const operationId = typeof body.operationId === 'string' ? body.operationId : '';
  const attachmentId = typeof body.attachmentId === 'string' ? body.attachmentId : '';
  const path = typeof body.path === 'string' ? body.path : '';
  const contentType = typeof body.contentType === 'string' ? body.contentType : '';
  const size = body.size;
  if (!OPERATION_ATTACHMENT_MIME.has(contentType)) return errorResponse('FILE_TYPE_NOT_ALLOWED', 415);
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) return errorResponse('INVALID_FILE_SIZE', 400);
  if (size > MAX_FILE_SIZE) return errorResponse('FILE_TOO_LARGE', 413);
  const extension = path.toLowerCase().split('.').pop() ?? '';
  const allowedExtension = (extension === 'pdf' && contentType === 'application/pdf')
    || (extension === 'xls' && contentType === 'application/vnd.ms-excel')
    || (extension === 'xlsx' && contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    || (extension === 'csv' && ['text/csv', 'application/csv'].includes(contentType));
  if (!allowedExtension) return errorResponse('FILE_TYPE_EXTENSION_MISMATCH', 415);

  const access = await authorizeOperationAttachmentAccess(organizationId, operationId, attachmentId, path, user, token, 'write', { contentType, size });
  if (!access.ok) return access.response;
  const { data, error } = await adminClient().storage.from(DEFAULT_BUCKET).createSignedUploadUrl(access.attachment.path);
  if (error || !data?.token || !data?.path) {
    console.error('Create operation attachment signed upload URL failed');
    return errorResponse('SIGN_UPLOAD_FAILED', 500);
  }
  return jsonResponse({ ok: true, provider: 'supabase', bucket: DEFAULT_BUCKET, path: data.path, token: data.token });
}

async function handleOperationAttachmentSignDownload(body: Record<string, unknown>, user: FirebaseUser, token: string): Promise<Response> {
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId : '';
  const operationId = typeof body.operationId === 'string' ? body.operationId : '';
  const attachmentId = typeof body.attachmentId === 'string' ? body.attachmentId : '';
  const path = typeof body.path === 'string' ? body.path : '';
  const access = await authorizeOperationAttachmentAccess(organizationId, operationId, attachmentId, path, user, token, 'read');
  if (!access.ok) return access.response;
  const { data, error } = await adminClient().storage.from(DEFAULT_BUCKET).createSignedUrl(access.attachment.path, DOWNLOAD_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error('Create operation attachment signed URL failed');
    return errorResponse('SIGNED_URL_FAILED', 500);
  }
  return jsonResponse({ ok: true, signedUrl: data.signedUrl, path: access.attachment.path, expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS });
}


async function handleOperationAttachmentCleanup(body: Record<string, unknown>, user: FirebaseUser, token: string): Promise<Response> {
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId : '';
  const operationId = typeof body.operationId === 'string' ? body.operationId : '';
  const attachmentId = typeof body.attachmentId === 'string' ? body.attachmentId : '';
  const path = typeof body.path === 'string' ? body.path : '';
  if (!organizationId || !/^[A-Za-z0-9_-]{1,128}$/.test(organizationId)
      || !operationId || !/^[A-Za-z0-9_-]{1,128}$/.test(operationId)
      || !attachmentId || !/^[A-Za-z0-9_-]{1,128}$/.test(attachmentId)) {
    return errorResponse('INVALID_OPERATION_ATTACHMENT_CONTEXT', 400);
  }
  const parsed = parseOperationAttachmentPath(path, organizationId) as AuthorizedOperationAttachment | null;
  if (!parsed || parsed.operationId !== operationId || !parsed.filename.startsWith(attachmentId + '-')) {
    return errorResponse('INVALID_OPERATION_ATTACHMENT_PATH', 400);
  }
  try {
    const profile = await readCallerVisibleDocument(`users/${user.uid}`, token);
    if (!profile || stringField(profile, 'status') !== 'active'
        || stringField(profile, 'organizationId') !== organizationId) {
      return errorResponse('ORGANIZATION_ACCESS_DENIED', 403);
    }
    const metadata = await readCallerVisibleDocument(`operationAttachments/${attachmentId}`, token);
    if (!metadata) return errorResponse('OPERATION_ATTACHMENT_NOT_FOUND', 404);
    const metadataView = {
      organizationId: stringField(metadata, 'organizationId'),
      operationId: stringField(metadata, 'operationId'),
      storagePath: stringField(metadata, 'storagePath'),
      storageProvider: stringField(metadata, 'storageProvider'),
      storageBucket: stringField(metadata, 'storageBucket'),
      storageKeyVersion: numberField(metadata, 'storageKeyVersion'),
      downloadUrl: stringField(metadata, 'downloadUrl'),
      uploadedBy: stringField(metadata, 'uploadedBy'),
      contentType: stringField(metadata, 'contentType'),
      size: numberField(metadata, 'size'),
    };
    if (stringField(metadata, 'uploadState') !== 'pending'
        || !operationAttachmentMetadataMatchesPath(metadataView, {
          organizationId, operationId, attachmentId, path,
          filename: parsed.filename, bucket: DEFAULT_BUCKET, actorUid: user.uid,
        })) {
      return errorResponse('OPERATION_ATTACHMENT_CLEANUP_DENIED', 403);
    }
    const operation = await readCallerVisibleDocument(`operations/${operationId}`, token);
    if (!operation || stringField(operation, 'organizationId') !== organizationId) {
      return errorResponse('OPERATION_ACCESS_DENIED', 403);
    }
    const { error } = await adminClient().storage.from(DEFAULT_BUCKET).remove([path]);
    if (error) {
      console.error('Cleanup pending operation attachment failed');
      return errorResponse('CLEANUP_FAILED', 500);
    }
    return jsonResponse({ ok: true });
  } catch (error) {
    console.error('Pending operation attachment cleanup failed');
    return error instanceof Error && error.message === 'FIRESTORE_LOOKUP_UNAVAILABLE'
      ? errorResponse('AUTHORIZATION_TEMPORARILY_UNAVAILABLE', 503)
      : errorResponse('CLEANUP_FAILED', 500);
  }
}

async function handleOperationAttachmentDelete(body: Record<string, unknown>, user: FirebaseUser, token: string): Promise<Response> {
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId : '';
  const operationId = typeof body.operationId === 'string' ? body.operationId : '';
  const attachmentId = typeof body.attachmentId === 'string' ? body.attachmentId : '';
  const path = typeof body.path === 'string' ? body.path : '';
  const access = await authorizeOperationAttachmentAccess(organizationId, operationId, attachmentId, path, user, token, 'delete');
  if (!access.ok) return access.response;
  const { error } = await adminClient().storage.from(DEFAULT_BUCKET).remove([access.attachment.path]);
  if (error) {
    console.error('Delete operation attachment failed');
    return errorResponse('DELETE_FAILED', 500);
  }
  return jsonResponse({ ok: true });
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
    console.error('Create signed upload URL failed');
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
    .createSignedUrl(access.document.path, DOWNLOAD_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error('Create signed download URL failed');
    return errorResponse('SIGNED_URL_FAILED', 500);
  }
  return jsonResponse({ ok: true, signedUrl: data.signedUrl, path: access.document.path, expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS });
}

/**
 * Read-only compatibility gateway for older client documents stored inside
 * clients.documents[]. The client sends only the client ID and embedded item
 * ID; the canonical object path is derived from the caller-visible Firestore
 * record and never trusted from the request body.
 */
async function handleLegacyClientSignDownload(
  body: Record<string, unknown>,
  user: FirebaseUser,
  token: string,
): Promise<Response> {
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId : '';
  const clientId = typeof body.clientId === 'string' ? body.clientId : '';
  const embeddedDocumentId = typeof body.documentId === 'string' ? body.documentId : '';

  if (!organizationId || !/^[A-Za-z0-9_-]{1,128}$/.test(organizationId)) {
    return errorResponse('INVALID_ORGANIZATION', 400);
  }
  if (!clientId || !/^[A-Za-z0-9_-]{1,128}$/.test(clientId)) {
    return errorResponse('INVALID_CLIENT_ID', 400);
  }
  if (!embeddedDocumentId || !/^[A-Za-z0-9_-]{1,128}$/.test(embeddedDocumentId)) {
    return errorResponse('INVALID_LEGACY_DOCUMENT_ID', 400);
  }

  try {
    const profile = await readCallerVisibleDocument(`users/${user.uid}`, token);
    if (!profile || stringField(profile, 'status') !== 'active') {
      return errorResponse('ACTIVE_PROFILE_REQUIRED', 403);
    }
    if (stringField(profile, 'organizationId') !== organizationId) {
      return errorResponse('ORGANIZATION_ACCESS_DENIED', 403);
    }

    const client = await readCallerVisibleDocument(`clients/${clientId}`, token);
    if (!client) return errorResponse('CLIENT_NOT_FOUND', 404);
    if (stringField(client, 'organizationId') !== organizationId) {
      return errorResponse('CLIENT_ACCESS_DENIED', 403);
    }

    const embeddedValues = client.fields?.documents?.arrayValue?.values ?? [];
    const matchingReferences = embeddedValues
      .map(value => value.mapValue?.fields)
      .filter((fields): fields is Record<string, FirestoreValue> =>
        stringFieldsValue(fields, 'id') === embeddedDocumentId);
    if (matchingReferences.length === 0) return errorResponse('LEGACY_CLIENT_DOCUMENT_NOT_FOUND', 404);
    if (matchingReferences.length !== 1) {
      return errorResponse('LEGACY_CLIENT_DOCUMENT_REFERENCE_AMBIGUOUS', 409);
    }
    const embedded = matchingReferences[0];

    const reference = {
      storageProvider: stringFieldsValue(embedded, 'storageProvider') ?? undefined,
      storageBucket: stringFieldsValue(embedded, 'storageBucket') ?? undefined,
      storagePath: stringFieldsValue(embedded, 'storagePath') ?? undefined,
      url: stringFieldsValue(embedded, 'url') ?? undefined,
      downloadUrl: stringFieldsValue(embedded, 'downloadUrl') ?? undefined,
    };
    let expectedHost = '';
    try {
      expectedHost = new URL(SUPABASE_URL).hostname;
    } catch {
      return errorResponse('STORAGE_CONFIG_MISSING', 503);
    }

    const parsed = parseLegacyClientDocumentReference(reference, {
      organizationId,
      clientId,
      expectedBucket: DEFAULT_BUCKET,
      expectedHost,
    });
    if (!parsed) return errorResponse('LEGACY_CLIENT_DOCUMENT_REFERENCE_INVALID', 409);

    const role = stringField(profile, 'role') ?? '';
    const category = stringFieldsValue(embedded, 'category') ?? stringFieldsValue(embedded, 'type') ?? '';
    if (!roleCanAccessLegacyClientDocument(role, 'read', category)) {
      return errorResponse('LEGACY_CLIENT_DOCUMENT_ACCESS_DENIED', 403);
    }

    const storage = adminClient().storage.from(DEFAULT_BUCKET);
    const { data: fileInfo, error: infoError } = await storage.info(parsed.path);
    if (infoError || !fileInfo) {
      console.error('Legacy client document metadata lookup failed');
      return errorResponse('LEGACY_CLIENT_DOCUMENT_UNAVAILABLE', 404);
    }

    const referenceSize = numberField({ fields: { size: embedded.size } }, 'size');
    const metadata = (fileInfo as { metadata?: Record<string, unknown> }).metadata ?? {};
    const rawActualSize = metadata.size ?? (fileInfo as { size?: unknown }).size;
    const actualSize = typeof rawActualSize === 'number'
      ? rawActualSize
      : typeof rawActualSize === 'string' && rawActualSize.trim() && Number.isFinite(Number(rawActualSize))
        ? Number(rawActualSize)
        : null;
    const referenceContentType = stringFieldsValue(embedded, 'mimeType')
      ?? stringFieldsValue(embedded, 'contentType');
    const actualContentType = typeof metadata.mimetype === 'string'
      ? metadata.mimetype
      : typeof metadata.contentType === 'string' ? metadata.contentType
        : typeof (fileInfo as { contentType?: unknown }).contentType === 'string'
          ? (fileInfo as { contentType: string }).contentType
          : '';
    if (!legacyObjectMetadataMatches(
      { size: referenceSize, contentType: referenceContentType },
      { size: actualSize, contentType: actualContentType },
    )) {
      console.warn('Legacy client document metadata missing or mismatched; signed URL not issued.');
      return errorResponse('LEGACY_CLIENT_DOCUMENT_METADATA_MISMATCH', 409);
    }

    const { data, error } = await storage.createSignedUrl(parsed.path, 15 * 60);
    if (error || !data?.signedUrl) {
      console.error('Create legacy client document signed URL failed');
      return errorResponse('LEGACY_CLIENT_DOCUMENT_UNAVAILABLE', 404);
    }

    return jsonResponse({
      ok: true,
      signedUrl: data.signedUrl,
      expiresInSeconds: 15 * 60,
      fileName: parsed.filename,
    });
  } catch (error) {
    console.error('Legacy client document authorization failed');
    return authorizationFailure(error);
  }
}

async function handleDelete(body: Record<string, unknown>, user: FirebaseUser, token: string): Promise<Response> {
  const organizationId = typeof body.organizationId === 'string' ? body.organizationId : '';
  const documentId = typeof body.documentId === 'string' ? body.documentId : '';
  const path = typeof body.path === 'string' ? body.path : '';
  const access = await authorizeDocumentAccess(organizationId, documentId, path, user, token, 'delete');
  if (!access.ok) return access.response;

  const { error } = await adminClient().storage.from(DEFAULT_BUCKET).remove([access.document.path]);
  if (error) {
    console.error('Delete document failed');
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
        supportedActions: ['sign-upload', 'sign-download', 'delete', 'legacy-client-sign-download', 'operation-sign-upload', 'operation-sign-download', 'operation-delete', 'operation-cleanup'],
        timestamp: new Date().toISOString(),
      });
    }
  } catch {
    // Invalid URL falls through to normal validation.
  }

  if (req.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', 405);

  const apiKey = req.headers.get('apikey');
  const hasValidSupabaseApiKey = isAllowedSupabaseApiKey(apiKey, {
    legacyAnonKey: Deno.env.get('SUPABASE_ANON_KEY'),
    publishableKeysJson: Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'),
    lookupEnvironmentVariable: (name) => Deno.env.get(name) ?? undefined,
  });
  if (!hasValidSupabaseApiKey) return errorResponse('API_KEY_INVALID', 401);

  let body: Record<string, unknown>;
  try {
    const rawBody = await readLimitedRequestBody(req);
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return errorResponse('INVALID_JSON', 400);
    }
    body = parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error && error.message === 'REQUEST_TOO_LARGE') {
      return errorResponse('REQUEST_TOO_LARGE', 413);
    }
    return errorResponse('INVALID_JSON', 400);
  }

  const token = extractToken(req);
  if (!token) return errorResponse('AUTH_REQUIRED', 401);

  let user: FirebaseUser;
  try {
    user = await verifyFirebaseToken(token);
  } catch (error) {
    console.error('Firebase token verification failed');
    return error instanceof Error && error.message === 'FIREBASE_VERIFICATION_UNAVAILABLE'
      ? errorResponse('AUTHENTICATION_TEMPORARILY_UNAVAILABLE', 503)
      : errorResponse('AUTH_INVALID', 401);
  }

  try {
    switch (body.action) {
      case 'sign-upload': return await handleSignUpload(body, user, token);
      case 'sign-download': return await handleSignDownload(body, user, token);
      case 'delete': return await handleDelete(body, user, token);
      case 'legacy-client-sign-download': return await handleLegacyClientSignDownload(body, user, token);
      case 'operation-sign-upload': return await handleOperationAttachmentSignUpload(body, user, token);
      case 'operation-sign-download': return await handleOperationAttachmentSignDownload(body, user, token);
      case 'operation-delete': return await handleOperationAttachmentDelete(body, user, token);
      case 'operation-cleanup': return await handleOperationAttachmentCleanup(body, user, token);
      default: return errorResponse('UNKNOWN_ACTION', 400);
    }
  } catch (error) {
    console.error('Document storage operation failed');
    return error instanceof Error && error.message === 'FIRESTORE_LOOKUP_UNAVAILABLE'
      ? errorResponse('AUTHORIZATION_TEMPORARILY_UNAVAILABLE', 503)
      : errorResponse('INTERNAL_ERROR', 500);
  }
});
