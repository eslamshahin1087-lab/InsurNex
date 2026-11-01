import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLIENT_BASE_SUMMARY_FIELDS,
  LEGACY_CLIENT_READ_ROLES,
  assertCanReadLegacyClientRecord,
  canReadLegacyClientRecord,
  projectClientBaseSummary,
  projectLegacyClientWorkspace,
} from '../src/features/clients/client-access.policy.js';

const scope = {
  uid: 'broker-1',
  organizationId: 'org_alpha',
  role: 'broker',
  status: 'active',
};

const legacyClient = {
  organizationId: 'org_alpha',
  code: 'CLI-2026-0001',
  type: 'individual',
  status: 'active',
  name: 'Synthetic Client',
  phone: '+201000000001',
  email: 'client@example.invalid',
  industry: 'services',
  city: 'Cairo',
  assignedTo: 'broker-1',
  leadSource: 'referral',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
  nationalId: 'SENSITIVE_NATIONAL_ID_SENTINEL',
  taxId: 'SENSITIVE_TAX_ID_SENTINEL',
  address: 'SENSITIVE_ADDRESS_SENTINEL',
  notes: 'SENSITIVE_FREE_TEXT_SENTINEL',
  individual: {
    dateOfBirth: 'SENSITIVE_DOB_SENTINEL',
    gender: 'SENSITIVE_GENDER_SENTINEL',
    maritalStatus: 'SENSITIVE_FAMILY_SENTINEL',
    monthlyIncome: 90000,
  },
  corporate: { taxCard: 'SENSITIVE_CORPORATE_TAX_SENTINEL' },
  riskData: { health: { medications: 'SENSITIVE_MEDICAL_SENTINEL' } },
  riskAssessment: { score: 99 },
  documents: [{ url: 'SENSITIVE_DOCUMENT_URL_SENTINEL' }],
  aiAnalysis: { summary: 'SENSITIVE_AI_SENTINEL' },
  preferences: { whatsappOptIn: true },
  lifetimeValue: 123456,
  futureUnknownField: 'MUST_NOT_LEAK',
};

test('only active Owner, Admin and Broker can read the legacy client record', () => {
  for (const role of ['owner', 'admin', 'broker']) {
    assert.equal(canReadLegacyClientRecord({ ...scope, role }), true);
  }
  for (const role of ['sales', 'claims', 'finance', 'staff']) {
    assert.equal(canReadLegacyClientRecord({ ...scope, role }), false);
  }
  assert.deepEqual(LEGACY_CLIENT_READ_ROLES, ['owner', 'admin', 'broker']);
});

test('inactive, invited, profile-less and malformed scopes fail closed', () => {
  assert.equal(canReadLegacyClientRecord({ ...scope, status: 'disabled' }), false);
  assert.equal(canReadLegacyClientRecord({ ...scope, status: 'invited' }), false);
  assert.equal(canReadLegacyClientRecord({ ...scope, uid: '' }), false);
  assert.equal(canReadLegacyClientRecord({ ...scope, organizationId: '' }), false);
  assert.equal(canReadLegacyClientRecord(null), false);
  assert.throws(
    () => assertCanReadLegacyClientRecord({ ...scope, role: 'sales' }),
    (error) => error.code === 'CLIENT_ACCESS_DENIED',
  );
});

test('base client summary is an explicit allowlist and excludes sensitive fields', () => {
  const summary = projectClientBaseSummary('client-1', legacyClient, scope);
  assert.deepEqual(Object.keys(summary).sort(), [
    'assignedTo',
    'city',
    'code',
    'createdAt',
    'email',
    'id',
    'industry',
    'leadSource',
    'name',
    'organizationId',
    'phone',
    'status',
    'type',
    'updatedAt',
  ]);
  assert.equal(summary.id, 'client-1');
  assert.equal(summary.organizationId, 'org_alpha');
  assert.equal(summary.name, 'Synthetic Client');
  assert.equal(summary.phone, '+201000000001');
  assert.equal(summary.email, 'client@example.invalid');

  const serialized = JSON.stringify(summary);
  for (const sentinel of [
    'SENSITIVE_NATIONAL_ID_SENTINEL',
    'SENSITIVE_TAX_ID_SENTINEL',
    'SENSITIVE_ADDRESS_SENTINEL',
    'SENSITIVE_FREE_TEXT_SENTINEL',
    'SENSITIVE_DOB_SENTINEL',
    'SENSITIVE_GENDER_SENTINEL',
    'SENSITIVE_FAMILY_SENTINEL',
    'SENSITIVE_CORPORATE_TAX_SENTINEL',
    'SENSITIVE_MEDICAL_SENTINEL',
    'SENSITIVE_DOCUMENT_URL_SENTINEL',
    'SENSITIVE_AI_SENTINEL',
    'MUST_NOT_LEAK',
  ]) {
    assert.equal(serialized.includes(sentinel), false, `Base summary leaked ${sentinel}`);
  }
  for (const forbidden of [
    'nationalId',
    'taxId',
    'individual',
    'corporate',
    'riskData',
    'riskAssessment',
    'documents',
    'aiAnalysis',
    'notes',
    'address',
    'preferences',
    'lifetimeValue',
  ]) {
    assert.equal(Object.hasOwn(summary, forbidden), false, `Base summary contains ${forbidden}`);
  }
  assert.ok(CLIENT_BASE_SUMMARY_FIELDS.includes('name'));
});

test('base and legacy projections reject cross-organization records', () => {
  assert.throws(
    () => projectClientBaseSummary('client-foreign', {
      ...legacyClient,
      organizationId: 'org_beta',
    }, scope),
    (error) => error.code === 'CLIENT_ORG_MISMATCH',
  );
  assert.throws(
    () => projectLegacyClientWorkspace('client-foreign', {
      ...legacyClient,
      organizationId: 'org_beta',
    }, scope),
    (error) => error.code === 'CLIENT_ORG_MISMATCH',
  );
});

test('Client 360 legacy workspace remains available to authorized roles without mutating source data', () => {
  const before = JSON.stringify(legacyClient);
  const workspace = projectLegacyClientWorkspace('client-1', legacyClient, scope);
  assert.equal(workspace.id, 'client-1');
  assert.equal(workspace.nationalId, 'SENSITIVE_NATIONAL_ID_SENTINEL');
  assert.equal(workspace.riskData.health.medications, 'SENSITIVE_MEDICAL_SENTINEL');
  assert.equal(JSON.stringify(legacyClient), before);
  assert.throws(
    () => projectLegacyClientWorkspace('client-1', legacyClient, { ...scope, role: 'claims' }),
    (error) => error.code === 'CLIENT_ACCESS_DENIED',
  );
});
