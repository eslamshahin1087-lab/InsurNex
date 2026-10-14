// ============================================================
// Supabase Edge Function: document-storage
// Contract matches src/features/storage/supabase-storage.provider.ts
// Actions: sign-upload | delete | sign-download | ping
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

// ============================================================
// CORS
// ============================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-firebase-token',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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
// Env
// ============================================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FIREBASE_API_KEY =
  Deno.env.get('FIREBASE_API_KEY') ??
  Deno.env.get('FIREBASE_WEB_API_KEY') ??
  '';
const DEFAULT_BUCKET = Deno.env.get('DOCUMENT_BUCKET') ?? 'insurnex-documents';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

// ============================================================
// Supabase admin client
// ============================================================

function adminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_CONFIG_MISSING');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ============================================================
// Firebase token verification
// ============================================================

interface FirebaseUser {
  uid: string;
  email?: string;
  name?: string;
}

async function verifyFirebaseToken(token: string): Promise<FirebaseUser> {
  if (!FIREBASE_API_KEY) {
    throw new Error('FIREBASE_API_KEY_NOT_CONFIGURED');
  }
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    },
  );
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.error('Firebase tokeninfo error:', res.status, errBody);
    throw new Error('FIREBASE_TOKEN_INVALID');
  }
  const data = await res.json();
  const user = data?.users?.[0];
  if (!user?.localId) throw new Error('FIREBASE_TOKEN_INVALID');
  return { uid: user.localId, email: user.email, name: user.displayName };
}

function extractToken(req: Request): string | null {
  const headerToken = req.headers.get('x-firebase-token');
  if (headerToken) return headerToken;
  const auth = req.headers.get('authorization');
  if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return null;
}

// ============================================================
// Handlers (contract matches client)
// ============================================================

/**
 * sign-upload
 * Client sends:
 *   { organizationId, path, contentType, size }
 * Client expects:
 *   { ok: true, token: string, path: string }
 */
async function handleSignUpload(
  body: {
    organizationId?: string;
    path?: string;
    contentType?: string;
    size?: number;
  },
  user: FirebaseUser,
): Promise<Response> {
  const { organizationId, path, contentType, size = 0 } = body;

  if (!organizationId) return errorResponse('MISSING_ORGANIZATION');
  if (!path) return errorResponse('MISSING_PATH');
  if (!contentType) return errorResponse('MISSING_CONTENT_TYPE');

  // Security: ensure the path starts with the organization's folder
  const expectedPrefix = `organizations/${organizationId}/`;
  if (!path.startsWith(expectedPrefix)) {
    return errorResponse('PATH_OUTSIDE_ORGANIZATION', 403, {
      expectedPrefix,
      got: path.slice(0, 80),
    });
  }

  if (size > MAX_FILE_SIZE) return errorResponse('FILE_TOO_LARGE');
  if (!ALLOWED_MIME.has(contentType)) {
    return errorResponse('FILE_TYPE_NOT_ALLOWED', 400, { contentType });
  }

  const supabase = adminClient();
  const { data, error } = await supabase.storage
    .from(DEFAULT_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data?.signedUrl) {
    console.error('Create signed upload URL error:', error);
    return errorResponse('SIGN_UPLOAD_FAILED', 500, {
      detail: error?.message,
    });
  }

  return jsonResponse({
    ok: true,
    provider: 'supabase',
    bucket: DEFAULT_BUCKET,
    path: data.path ?? path,
    signedUrl: data.signedUrl,
    token: data.token,
    uploadedBy: user.uid,
  });
}

/**
 * sign-download
 * Client sends: { organizationId, path }
 * Client expects: { ok: true, signedUrl: string }
 */
async function handleSignDownload(
  body: { organizationId?: string; path?: string },
): Promise<Response> {
  const { organizationId, path } = body;
  if (!organizationId) return errorResponse('MISSING_ORGANIZATION');
  if (!path) return errorResponse('MISSING_PATH');

  const expectedPrefix = `organizations/${organizationId}/`;
  if (!path.startsWith(expectedPrefix)) {
    return errorResponse('PATH_OUTSIDE_ORGANIZATION', 403, {
      expectedPrefix,
    });
  }

  const supabase = adminClient();
  const { data, error } = await supabase.storage
    .from(DEFAULT_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24); // 24 hours

  if (error || !data?.signedUrl) {
    console.error('Signed URL error:', error);
    return errorResponse('SIGNED_URL_FAILED', 500, { detail: error?.message });
  }

  return jsonResponse({
    ok: true,
    signedUrl: data.signedUrl,
    path,
  });
}

/**
 * delete
 * Client sends: { organizationId, path }
 * Client expects: { ok: true }
 */
async function handleDelete(
  body: { organizationId?: string; path?: string },
): Promise<Response> {
  const { organizationId, path } = body;
  if (!organizationId) return errorResponse('MISSING_ORGANIZATION');
  if (!path) return errorResponse('MISSING_PATH');

  const expectedPrefix = `organizations/${organizationId}/`;
  if (!path.startsWith(expectedPrefix)) {
    return errorResponse('PATH_OUTSIDE_ORGANIZATION', 403, {
      expectedPrefix,
    });
  }

  const supabase = adminClient();
  const { error } = await supabase.storage
    .from(DEFAULT_BUCKET)
    .remove([path]);

  if (error) {
    console.error('Delete error:', error);
    return errorResponse('DELETE_FAILED', 500, { detail: error.message });
  }

  return jsonResponse({ ok: true });
}

// ============================================================
// Main handler
// ============================================================

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Health check
  try {
    const url = new URL(req.url);
    if (url.searchParams.get('ping') === '1') {
      return jsonResponse({
        ok: true,
        service: 'document-storage',
        method: req.method,
        hasFirebaseKey: !!FIREBASE_API_KEY,
        hasServiceRole: !!SUPABASE_SERVICE_ROLE_KEY,
        bucket: DEFAULT_BUCKET,
        supportedActions: ['sign-upload', 'sign-download', 'delete'],
        timestamp: new Date().toISOString(),
      });
    }
  } catch {
    /* ignore */
  }

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 405, { method: req.method });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorResponse('INVALID_JSON');
  }

  const token = extractToken(req);
  if (!token) return errorResponse('AUTH_REQUIRED', 401);

  let user: FirebaseUser;
  try {
    user = await verifyFirebaseToken(token);
  } catch (e) {
    console.error('Auth error:', e);
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    return errorResponse('AUTH_INVALID', 401, { detail: msg });
  }

  const action = String(body.action || '');

  try {
    switch (action) {
      case 'sign-upload':
        return await handleSignUpload(body, user);
      case 'sign-download':
        return await handleSignDownload(body);
      case 'delete':
        return await handleDelete(body);
      default:
        return errorResponse('UNKNOWN_ACTION', 400, {
          action,
          supported: ['sign-upload', 'sign-download', 'delete'],
        });
    }
  } catch (e) {
    console.error('Handler error:', e);
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    return errorResponse('INTERNAL_ERROR', 500, { detail: msg });
  }
});