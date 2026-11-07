import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/client-data-access/audit.ts', import.meta.url), 'utf8');

assert.match(source, /export async function resolveTrustedClientActor/);
assert.match(source, /collection\('admin'\)\.doc\(uid\)\.get\(\)/);
assert.match(source, /collection\('users'\)\.doc\(uid\)\.get\(\)/);
assert.match(source, /collection\('organizations'\)\.doc\(organizationId\)\.collection\('members'\)\.doc\(uid\)\.get\(\)/);
assert.match(source, /membership\.status !== 'active'/);
assert.match(source, /membership\.role !== role/);
assert.match(source, /export async function recordClientAuditEvent/);
assert.match(source, /const actor = await resolveTrustedClientActor\(db, authenticatedUid\)/);
assert.match(source, /async function appendClientAuditEvent/);
assert.doesNotMatch(source, /export async function appendClientAuditEvent/);
assert.match(source, /eventRef\.create\(/);
assert.doesNotMatch(source, /eventRef\.(?:set|update|delete|get)\(/);
assert.doesNotMatch(source, /collection\('auditLogs'\)\.get\(/);
assert.match(source, /purposeCode: input\.purposeCode/);
assert.match(source, /FieldValue\.serverTimestamp\(\)/);
assert.match(source, /const PURPOSE_CODES = new Set\(/);
assert.match(source, /CLIENT_AUDIT_ACTION_DECISION_MISMATCH/);
assert.doesNotMatch(source, /downloadUrl|storagePath|nationalId|taxId|medications|dateOfBirth|signedUrl|documentBytes/);

const rules = await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8');
const auditRule = rules.match(/match \/auditLogs\/{[^}]*}/);
assert.equal(auditRule, null, 'auditLogs must remain inaccessible to client SDKs until a separate Rules review');
assert.match(
  rules,
  /request\.resource\.data\.keys\(\)\.hasOnly\(\[\s*'uid','email','displayName','role','status','createdAt','updatedAt','invitedBy'/,
  'browser-created memberships must reject unapproved capability/grant fields',
);
assert.equal(
  rules.includes('clientSensitiveCapabilities'),
  false,
  'Firestore client Rules must not define or trust browser-supplied capability fields',
);

console.log('P1-E trusted client audit foundation contract tests passed.');
