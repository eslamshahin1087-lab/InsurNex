import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const endpoints = [
  { path: 'supabase/functions/cron-policy-check/index.ts', kind: 'policy', expiry: 'endDate', inactive: "current.status !== 'active'" },
  { path: 'supabase/functions/cron-document-check/index.ts', kind: 'document', expiry: 'expiryDate', inactive: "current.status === 'deleted' || current.status === 'archived'" },
];

for (const endpoint of endpoints) {
  const source = await readFile(new URL('../' + endpoint.path, import.meta.url), 'utf8');
  assert.match(source, /request\.method\s*!==\s*'POST'/, endpoint.path + ': must reject non-POST methods');
  assert.match(source, /Deno\.env\.get\('CRON_SECRET'\)/, endpoint.path + ': must read dedicated CRON_SECRET');
  assert.match(source, /isCronRequestAuthorized\(request,\s*CRON_SECRET\)/, endpoint.path + ': must use shared cron authorization');
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY/, endpoint.path + ': service-role key must not be a cron credential');
  assert.doesNotMatch(source, /authorization\s*:\s*['"`]Bearer/i, endpoint.path + ': must not construct a bearer fallback');
  assert.ok(source.includes("stableNotificationId('" + endpoint.kind + "'"), endpoint.path + ': must use deterministic notification IDs');
  assert.match(source, /db\.runTransaction\(/, endpoint.path + ': notification writes must be transactional');
  assert.match(source, /transaction\.get\(notificationRef\)/, endpoint.path + ': must check for an existing notification');
  assert.match(source, /transaction\.create\(notificationRef/, endpoint.path + ': must create notifications without overwrite');
  assert.match(source, /current\.organizationId\s*!==\s*organizationId/, endpoint.path + ': must revalidate tenant ownership inside transaction');
  assert.ok(source.includes('normalizeDateOnly(current.' + endpoint.expiry + ') !== expiryDate'), endpoint.path + ': must revalidate expiry inside transaction');
  assert.ok(source.includes(endpoint.inactive), endpoint.path + ': must revalidate current resource status');
  assert.match(source, /error:\s*'CRON_JOB_FAILED'/, endpoint.path + ': public failures must use a stable generic error');
  assert.doesNotMatch(source, /console\.(?:error|warn)\([^\n]*(?:error|exception|stack)/i, endpoint.path + ': must not log raw exception objects');
}
console.log('Cron endpoint security source guards passed for both scheduled functions.');
