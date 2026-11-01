import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CLIENT_SENSITIVE_ACCESS_ACTIONS,
  CLIENT_SENSITIVE_DATA_CLASSES,
  CLIENT_SENSITIVE_GRANT_MAX_TTL_MS,
  evaluateClientSensitiveReadAccess,
} from '../src/features/clients/client-sensitive-access.policy.js';

const now = new Date('2026-11-01T18:00:00.000Z');
const actor = {
  uid: 'broker_001',
  organizationId: 'org_alpha',
  role: 'broker',
  status: 'active',
  membershipStatus: 'active',
  isPlatformAdmin: false,
  capabilities: ['client.sensitive.read.medical'],
};
const resource = {
  organizationId: 'org_alpha',
  clientId: 'client_001',
  recordId: 'medical_001',
  dataClass: 'medical',
  relationshipVerified: true,
};
const grant = {
  schemaVersion: 1,
  grantId: 'grant_001',
  status: 'approved',
  organizationId: 'org_alpha',
  clientId: 'client_001',
  recordId: 'medical_001',
  dataClass: 'medical',
  action: 'read',
  subjectUid: 'broker_001',
  subjectRole: 'broker',
  purpose: 'Review a documented client medical underwriting request',
  approvedBy: 'owner_002',
  issuedAt: new Date(now.getTime() - 60_000),
  expiresAt: new Date(now.getTime() + 5 * 60_000),
  auditEventId: 'audit_001',
  auditRecorded: true,
};

assert.deepEqual(CLIENT_SENSITIVE_ACCESS_ACTIONS, ['read']);
assert.deepEqual(CLIENT_SENSITIVE_DATA_CLASSES, [
  'identity', 'family', 'financial', 'contact_address',
  'medical', 'claim_sensitive', 'ai_findings',
]);
assert.equal(CLIENT_SENSITIVE_GRANT_MAX_TTL_MS, 15 * 60 * 1000);

const approved = evaluateClientSensitiveReadAccess({ actor, grant, resource, now });
assert.equal(approved.allowed, true);
assert.equal(approved.reason, 'APPROVED_TIME_LIMITED_AUDITED_GRANT');
assert.equal(approved.grantId, grant.grantId);
assert.equal(approved.auditEventId, grant.auditEventId);
assert.equal(approved.expiresAt, grant.expiresAt.getTime());
assert.deepEqual(Object.keys(approved).sort(), [
  'allowed', 'auditEventId', 'expiresAt', 'grantId', 'reason',
]);

const firestoreTimestamp = {
  seconds: Math.floor(grant.issuedAt.getTime() / 1000),
  nanoseconds: 0,
  toMillis() { return this.seconds * 1000; },
};
assert.equal(
  evaluateClientSensitiveReadAccess({
    actor,
    resource,
    grant: { ...grant, issuedAt: firestoreTimestamp },
    now,
  }).allowed,
  true,
);

function denied(input, reason) {
  const decision = evaluateClientSensitiveReadAccess({ actor, grant, resource, now, ...input });
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, reason);
  assert.equal(Object.hasOwn(decision, 'grantId'), false);
  assert.equal(Object.hasOwn(decision, 'auditEventId'), false);
}

denied({ actor: { ...actor, status: 'disabled' } }, 'ACTOR_NOT_ACTIVE');
denied({ actor: { ...actor, membershipStatus: 'disabled' } }, 'ACTOR_NOT_ACTIVE');
denied({ actor: { ...actor, uid: '' } }, 'ACTOR_NOT_ACTIVE');
denied({ actor: { ...actor, isPlatformAdmin: true } }, 'PLATFORM_ADMIN_FORBIDDEN');
denied({ actor: { ...actor, capabilities: [] } }, 'SENSITIVE_CAPABILITY_MISSING');
denied({ resource: { ...resource, relationshipVerified: false } }, 'RESOURCE_RELATIONSHIP_UNVERIFIED');
denied({ resource: { ...resource, organizationId: 'org_other' } }, 'RESOURCE_SCOPE_MISMATCH');
denied({ resource: { ...resource, clientId: '' } }, 'INVALID_REQUEST');
denied({ resource: { ...resource, dataClass: 'unknown' } }, 'INVALID_REQUEST');
denied({ grant: null }, 'GRANT_INVALID');
denied({ grant: { ...grant, unapprovedField: true } }, 'GRANT_INVALID');
denied({ grant: { ...grant, schemaVersion: 2 } }, 'GRANT_INVALID');
denied({ grant: { ...grant, status: 'pending' } }, 'GRANT_NOT_APPROVED');
denied({ grant: { ...grant, status: 'revoked' } }, 'GRANT_NOT_APPROVED');
denied({ grant: { ...grant, subjectUid: 'broker_002' } }, 'GRANT_SUBJECT_MISMATCH');
denied({ grant: { ...grant, organizationId: 'org_other' } }, 'GRANT_SUBJECT_MISMATCH');
denied({ grant: { ...grant, clientId: 'client_other' } }, 'GRANT_SUBJECT_MISMATCH');
denied({ grant: { ...grant, recordId: 'medical_other' } }, 'GRANT_SUBJECT_MISMATCH');
denied({ grant: { ...grant, subjectRole: 'admin' } }, 'GRANT_ROLE_MISMATCH');
denied({ grant: { ...grant, dataClass: 'identity' } }, 'ACTION_NOT_SUPPORTED');
denied({ grant: { ...grant, action: 'write' } }, 'ACTION_NOT_SUPPORTED');
denied({ action: 'export' }, 'ACTION_NOT_SUPPORTED');
denied({ action: 'download' }, 'ACTION_NOT_SUPPORTED');
denied({ grant: { ...grant, purpose: 'test' } }, 'PURPOSE_REQUIRED');
denied({ grant: { ...grant, approvedBy: '' } }, 'INDEPENDENT_APPROVAL_REQUIRED');
denied({ grant: { ...grant, approvedBy: actor.uid } }, 'INDEPENDENT_APPROVAL_REQUIRED');
denied({ grant: { ...grant, auditEventId: '' } }, 'AUDIT_NOT_RECORDED');
denied({ grant: { ...grant, auditRecorded: false } }, 'AUDIT_NOT_RECORDED');
denied({
  grant: { ...grant, issuedAt: new Date(now.getTime() + 1000) },
}, 'GRANT_NOT_YET_VALID');
denied({
  grant: { ...grant, expiresAt: new Date(now.getTime()) },
}, 'GRANT_EXPIRED');
denied({
  grant: {
    ...grant,
    issuedAt: new Date(now.getTime() - 20 * 60_000),
    expiresAt: new Date(now.getTime() + 1),
  },
}, 'GRANT_TTL_EXCEEDED');
denied({
  grant: { ...grant, issuedAt: 'not-a-date' },
}, 'GRANT_INVALID');

assert.equal(
  evaluateClientSensitiveReadAccess(null).reason,
  'INVALID_REQUEST',
);
assert.equal(
  evaluateClientSensitiveReadAccess({ actor, grant, resource, action: 'write', now }).reason,
  'ACTION_NOT_SUPPORTED',
);


const implementation = await readFile(
  new URL('../src/features/clients/client-sensitive-access.policy.js', import.meta.url),
  'utf8',
);
assert.equal(implementation.includes("firebase/firestore"), false);
for (const databaseOperation of ['addDoc(', 'setDoc(', 'updateDoc(', 'deleteDoc(', 'getDoc(', 'getDocs(', 'fetch(']) {
  assert.equal(implementation.includes(databaseOperation), false, databaseOperation + ' must not be present in the pure evaluator');
}
assert.ok(implementation.includes('CLIENT_SENSITIVE_GRANT_MAX_TTL_MS = 15 * 60 * 1000'));

console.log('P1-E sensitive access fail-closed grant policy tests passed.');
