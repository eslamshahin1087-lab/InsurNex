import assert from 'node:assert/strict';
import {
  hasTrustedClientSensitiveReadCapability,
  resolveTrustedClientCapabilities,
} from '../lib/client-data-access/capabilities.js';

const uid = 'actor_001';
const orgId = 'org_alpha';

function fakeDb({
  role = 'broker',
  status = 'active',
  membershipStatus = 'active',
  membershipRole = role,
  platformAdmin = false,
  organizationExists = true,
} = {}) {
  const reads = [];
  const docs = {
    admin: platformAdmin ? { role: 'platform-admin' } : null,
    users: { uid, organizationId: orgId, role, status },
    organization: organizationExists ? { name: 'Synthetic Organization' } : null,
    membership: { uid, role: membershipRole, status: membershipStatus },
  };
  const snapshot = (data) => ({ exists: data !== null, data: () => data ?? {} });

  const documentRef = (kind, id) => ({
    get: async () => {
      reads.push(kind + '/' + id);
      return snapshot(docs[kind]);
    },
    collection: (subcollection) => ({
      doc: (memberUid) => documentRef(subcollection === 'members' ? 'membership' : subcollection, memberUid),
    }),
  });

  return {
    reads,
    collection: (name) => ({
      doc: (id) => documentRef(name === 'organizations' ? 'organization' : name, id),
    }),
  };
}

const allGrantEligibleClasses = [
  'identity',
  'family',
  'financial',
  'contact_address',
  'medical',
  'claim_sensitive',
];
const claimsEligibleClasses = ['identity', 'family', 'medical', 'claim_sensitive'];

for (const role of ['owner', 'admin', 'broker']) {
  const db = fakeDb({ role });
  const actor = await resolveTrustedClientCapabilities(db, uid);
  assert.equal(actor.uid, uid);
  assert.equal(actor.organizationId, orgId);
  assert.equal(actor.role, role);
  assert.deepEqual(
    actor.capabilities,
    allGrantEligibleClasses.map((item) => 'client.sensitive.read.' + item),
    role + ' receives only the approved grant-eligibility classes',
  );
  assert.equal(Object.isFrozen(actor), true);
  assert.equal(Object.isFrozen(actor.capabilities), true);
  for (const dataClass of allGrantEligibleClasses) {
    assert.equal(hasTrustedClientSensitiveReadCapability(actor, dataClass), true);
  }
  assert.equal(hasTrustedClientSensitiveReadCapability(actor, 'ai_findings'), false);
}

{
  const actor = await resolveTrustedClientCapabilities(fakeDb({ role: 'claims' }), uid);
  assert.deepEqual(
    actor.capabilities,
    claimsEligibleClasses.map((item) => 'client.sensitive.read.' + item),
  );
  assert.equal(hasTrustedClientSensitiveReadCapability(actor, 'financial'), false);
  assert.equal(hasTrustedClientSensitiveReadCapability(actor, 'contact_address'), false);
  assert.equal(hasTrustedClientSensitiveReadCapability(actor, 'claim_sensitive'), true);
}

for (const role of ['sales', 'finance', 'staff']) {
  const actor = await resolveTrustedClientCapabilities(fakeDb({ role }), uid);
  assert.deepEqual(actor.capabilities, [], role + ' has no default sensitive-read grant eligibility');
}

async function reject(options, expected) {
  await assert.rejects(
    resolveTrustedClientCapabilities(fakeDb(options), uid),
    new RegExp(expected),
  );
}

await reject({ role: 'broker', status: 'disabled' }, 'CLIENT_AUDIT_PROFILE_INACTIVE');
await reject({ role: 'broker', membershipStatus: 'disabled' }, 'CLIENT_AUDIT_MEMBERSHIP_MISMATCH');
await reject({ role: 'broker', membershipRole: 'admin' }, 'CLIENT_AUDIT_MEMBERSHIP_MISMATCH');
await reject({ role: 'broker', organizationExists: false }, 'CLIENT_AUDIT_MEMBERSHIP_NOT_FOUND');
await reject({ role: 'broker', platformAdmin: true }, 'CLIENT_AUDIT_PLATFORM_ADMIN_FORBIDDEN');

console.log('P1-E trusted role capability resolver tests passed; capabilities remain grant-eligibility only.');
