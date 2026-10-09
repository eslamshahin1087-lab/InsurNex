import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-firebase-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const bucket = 'insurnex-documents';
const maxSize = 10 * 1024 * 1024;
const allowedTypes = new Set([
  'application/pdf', 'image/jpeg', 'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
function withinOrg(path: string, orgId: string) { return path.startsWith(`organizations/${orgId}/`); }
async function verifyFirebase(token: string) {
  const apiKey = Deno.env.get('FIREBASE_WEB_API_KEY');
  if (!apiKey) throw new Error('FIREBASE_WEB_API_KEY_MISSING');
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }),
  });
  if (!response.ok) throw new Error('INVALID_FIREBASE_TOKEN');
  const data = await response.json();
  const uid = data?.users?.[0]?.localId as string | undefined;
  if (!uid) throw new Error('INVALID_FIREBASE_USER');
  return uid;
}
async function verifyMembership(projectId: string, orgId: string, uid: string, token: string) {
  const path = `organizations/${orgId}/members/${uid}`.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('ORGANIZATION_ACCESS_DENIED');
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const token = req.headers.get('x-firebase-token') || '';
    if (!token) return json({ ok: false, error: 'AUTH_REQUIRED' }, 401);
    const body = await req.json();
    const organizationId = String(body.organizationId || '');
    const path = String(body.path || '');
    if (!organizationId || !path || !withinOrg(path, organizationId)) return json({ ok: false, error: 'INVALID_STORAGE_PATH' }, 400);
    const uid = await verifyFirebase(token);
    const projectId = Deno.env.get('FIREBASE_PROJECT_ID') || '';
    if (!projectId) throw new Error('FIREBASE_PROJECT_ID_MISSING');
    await verifyMembership(projectId, organizationId, uid, token);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    if (body.action === 'sign-upload') {
      const size = Number(body.size || 0); const contentType = String(body.contentType || '');
      if (size <= 0 || size > maxSize) return json({ ok: false, error: 'FILE_TOO_LARGE' }, 400);
      if (!allowedTypes.has(contentType)) return json({ ok: false, error: 'FILE_TYPE_NOT_ALLOWED' }, 400);
      const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path, { upsert: false });
      if (error) throw error;
      return json({ ok: true, path, token: data.token });
    }
    if (body.action === 'delete') {
      const { error } = await admin.storage.from(bucket).remove([path]); if (error) throw error;
      return json({ ok: true });
    }
    if (body.action === 'sign-download') {
      const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 300); if (error) throw error;
      return json({ ok: true, signedUrl: data.signedUrl });
    }
    return json({ ok: false, error: 'UNKNOWN_ACTION' }, 400);
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: error instanceof Error ? error.message : 'DOCUMENT_STORAGE_ERROR' }, 403);
  }
});
