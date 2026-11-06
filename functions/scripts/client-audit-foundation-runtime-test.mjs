import assert from 'node:assert/strict';
import { recordClientAuditEvent } from '../lib/client-data-access/audit.js';

const uid = 'broker_001';
const orgId = 'org_alpha';
const baseInput = {
  action: 'sensitive_read_requested',
  decision: 'requested',
  dataClass: 'medical',
  clientId: 'client_001',
  recordId: 'medical_001',
  purposeCode: 'underwriting_review',
  requestId: 'request_001',
};

function fakeDb({ admin = false, profile = {}, organization = true, membership = {} } = {}) {
  const writes = [];
  const reads = [];
  const docs = {
    admin: admin ? { role: 'platform-admin' } : null,
    users: {
      uid,
      organizationId: orgId,
      role: 'broker',
      status: 'active',
      ...profile,
    },
    organization: organization ? { name: 'Synthetic Org' } : null,
    membership: {
      uid,
      role: 'broker',
      status: 'active',
      ...membership,
    },
  };
  const snapshot = (data) => ({ exists: data !== null, data: () => data ?? {} });
  const doc = (kind, id) => ({
    get: async () => {
      reads.push(kind + '/' + id);
      if (kind === 'organizations') return snapshot(docs.organization);
      if (kind === 'members') return snapshot(docs.membership);
      return snapshot(docs[kind]);
    },
    collection: (name) => ({
      doc: (memberUid) => doc('members', memberUid),
    }),
    create: async (value) => {
      writes.push({ id, value });
    },
  });
  return {
    writes,
    reads,
    collection: (name) => ({
      doc: (id) => name === 'auditLogs'
        ? {
            id: 'audit_event_001',
            create: async (value) => writes.push({ id: 'audit_event_001', value }),
          }
        : doc(name === 'organizations' ? 'organizations' : name, id),
    }),
  };
}

const db = fakeDb();
const result = await recordClientAuditEvent(db, uid, baseInput);
assert.deepEqual(result, { eventId: 'audit_event_001' });
assert.equal(db.writes.length, 1);
const event = db.writes[0].value;
assert.equal(event.actorUid, uid);
assert.equal(event.organizationId, orgId);
assert.equal(event.actorRole, 'broker');
assert.equal(event.dataClass, 'medical');
assert.equal(event.purposeCode, 'underwriting_review');
assert.equal(event.createdAt !== undefined, true);
for (const forbidden of [
  'medicalValue', 'diagnosis', 'nationalId', 'downloadUrl',
  'signedUrl', 'storagePath', 'documentBytes', 'freeText',
]) assert.equal(Object.hasOwn(event, forbidden), false);

async function rejectsWithoutWrite(options, input, expectedCode) {
  const testDb = fakeDb(options);
  await assert.rejects(
    recordClientAuditEvent(testDb, uid, input ?? baseInput),
    new RegExp(expectedCode),
  );
  assert.equal(testDb.writes.length, 0, expectedCode + ' must not append an event');
}

await rejectsWithoutWrite({ admin: true }, baseInput, 'CLIENT_AUDIT_PLATFORM_ADMIN_FORBIDDEN');
await rejectsWithoutWrite({ profile: { status: 'disabled' } }, baseInput, 'CLIENT_AUDIT_PROFILE_INACTIVE');
await rejectsWithoutWrite({ membership: { status: 'disabled' } }, baseInput, 'CLIENT_AUDIT_MEMBERSHIP_MISMATCH');
await rejectsWithoutWrite({ membership: { role: 'admin' } }, baseInput, 'CLIENT_AUDIT_MEMBERSHIP_MISMATCH');
await rejectsWithoutWrite({ organization: false }, baseInput, 'CLIENT_AUDIT_MEMBERSHIP_NOT_FOUND');
await rejectsWithoutWrite({}, { ...baseInput, purposeCode: 'free text is not allowed' }, 'CLIENT_AUDIT_EVENT_INVALID');
await rejectsWithoutWrite({}, { ...baseInput, action: 'sensitive_read_completed', decision: 'requested' }, 'CLIENT_AUDIT_ACTION_DECISION_MISMATCH');
await rejectsWithoutWrite({}, baseInput, 'CLIENT_AUDIT_EVENT_INVALID'.replace('CLIENT_AUDIT_EVENT_INVALID','CLIENT_AUDIT_EVENT_INVALID'));

console.log('P1-E trusted audit runtime tests passed.');
