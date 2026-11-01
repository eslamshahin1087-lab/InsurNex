import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (file) => readFileSync(resolve(root, file), 'utf8');

const edge = read('supabase/functions/document-storage/index.ts');
const policy = read('supabase/functions/document-storage/access-policy.mjs');
const sharedApiKey = read('supabase/functions/_shared/api-key-authorization.ts');
const config = read('supabase/config.toml');
const provider = read('src/features/storage/supabase-storage.provider.ts');

assert.match(config, /\[functions\.document-storage\][\s\S]*?verify_jwt = false/,
  'document-storage gateway JWT bypass must be explicit because the function authenticates the publishable key and Firebase token itself');
assert.match(edge, /isAllowedSupabaseApiKey\(apiKey/,
  'the Edge Function must validate its Supabase application key explicitly');
assert.match(edge, /publishableKeysJson: Deno\.env\.get\('SUPABASE_PUBLISHABLE_KEYS'\)/,
  'the server must resolve the trusted runtime publishable-key map');
assert.match(edge, /legacyAnonKey: Deno\.env\.get\('SUPABASE_ANON_KEY'\)/,
  'the legacy anon key remains supported only while explicitly configured');
assert.equal(sharedApiKey.includes('return getConfiguredSupabaseApiKeys(config).has(providedKey.trim());'), true,
  'only explicitly configured Supabase keys may pass the gate');

assert.match(edge, /user\.disabled === true/,
  'disabled Firebase accounts must be rejected');
assert.match(edge, /AbortSignal\.timeout\(FIREBASE_TOKEN_TIMEOUT_MS\)/,
  'Firebase Identity Toolkit verification must be bounded');
assert.match(edge, /AbortSignal\.timeout\(FIRESTORE_READ_TIMEOUT_MS\)/,
  'caller-authorized Firestore reads must be bounded');
assert.match(edge, /Authorization: `Bearer \$\{token\}`/,
  'Firestore authorization reads must continue using the caller Firebase token');
assert.match(edge, /FIREBASE_VERIFICATION_UNAVAILABLE/,
  'Firebase provider outages must be distinguishable from invalid credentials');
assert.match(edge, /FIRESTORE_LOOKUP_UNAVAILABLE/,
  'Firestore availability failures must be distinguishable from access denial');

assert.match(edge, /MAX_REQUEST_BODY_BYTES = 64 \* 1024/,
  'metadata/control requests must have a bounded body size');
assert.match(edge, /readLimitedRequestBody\(req\)/,
  'request bodies must be streamed through the size guard');
assert.match(edge, /REQUEST_TOO_LARGE', 413/,
  'oversized control requests must be rejected with HTTP 413');
assert.match(edge, /MAX_FIREBASE_TOKEN_LENGTH = 16_384/,
  'Firebase tokens must have a finite maximum length');

assert.match(edge, /DOWNLOAD_URL_TTL_SECONDS = 15 \* 60/,
  'new signed download URLs must use the 15-minute TTL');
assert.equal(edge.includes('createSignedUrl(access.document.path, 60 * 60)'), false,
  'document downloads must not issue one-hour signed URLs');
assert.equal(edge.includes('createSignedUrl(access.attachment.path, 60 * 60)'), false,
  'operation attachment downloads must not issue one-hour signed URLs');
assert.match(edge, /expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS/,
  'signed URL responses must disclose their bounded TTL');
assert.match(edge, /createSignedUrl\(parsed\.path, 15 \* 60\)/,
  'legacy document URLs must retain their 15-minute TTL');

assert.match(edge, /MAX_FILE_SIZE = 10 \* 1024 \* 1024/,
  'the current 10 MB file-size limit must remain');
assert.match(edge, /ALLOWED_MIME/,
  'document upload MIME allow-list must remain active');
assert.match(edge, /operationAttachmentMetadataMatchesPath/,
  'operation attachments must remain bound to their metadata record');
assert.match(policy, /metadata\.storagePath !== request\.path/,
  'canonical metadata must bind the exact Storage object path');
assert.match(policy, /metadata\.organizationId !== request\.organizationId/,
  'metadata must remain tenant-bound');
assert.match(edge, /readCallerVisibleDocument\(`documents\/\$\{documentId\}`, token\)/,
  'document metadata must be read with the caller token');
assert.match(edge, /readCallerVisibleDocument\(`operationAttachments\/\$\{attachmentId\}`, token\)/,
  'operation attachment metadata must be read with the caller token');

assert.match(edge, /function adminClient\(\)/,
  'a narrowly-scoped Storage admin client remains available for signed Storage operations');
assert.match(edge, /adminClient\(\)\.storage\.from\(DEFAULT_BUCKET\)\.remove/,
  'deletion must occur only after the caller-authorized access path');
assert.doesNotMatch(edge, /console\.(?:error|warn)\([^\n]*\.message/,
  'upstream Storage/Firestore error messages must not be copied to logs');
assert.match(provider, /headers: \{ 'x-firebase-token': token \}/,
  'the existing Firebase-authenticated browser integration must remain compatible');
assert.match(provider, /uploadToSignedUrl/,
  'uploads must continue to use scoped signed upload tokens');
assert.match(provider, /legacy-client-sign-download/,
  'the legacy client-document compatibility route must remain available');
assert.match(provider, /operation-sign-upload/,
  'operation attachment uploads must remain available');

console.log('Document gateway runtime authorization, timeout, body-limit and signed-URL contract checks passed.');
