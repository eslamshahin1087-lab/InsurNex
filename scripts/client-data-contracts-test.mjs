import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CLIENT_DATA_CONTRACT_CATALOG,
  CLIENT_DOCUMENT_METADATA_FIELDS,
  assertClientRecordMatchesScope,
  isClientScopedRecordEnvelope,
  projectClientDocumentMetadata,
} from '../src/features/clients/client-data.contracts.js';

const expected = { organizationId: 'org_alpha', clientId: 'client_001' };
const envelope = {
  schemaVersion: 1,
  organizationId: expected.organizationId,
  clientId: expected.clientId,
  profileKind: 'medical',
  data: {
    health: {
      generalStatus: 'good',
      chronicConditions: ['synthetic-condition'],
    },
  },
  createdBy: 'synthetic-actor',
};

assert.equal(isClientScopedRecordEnvelope(envelope), true);
assert.equal(isClientScopedRecordEnvelope(null), false);
assert.equal(isClientScopedRecordEnvelope([]), false);
assert.equal(isClientScopedRecordEnvelope({ ...envelope, schemaVersion: 2 }), false);
assert.equal(isClientScopedRecordEnvelope({ ...envelope, profileKind: 'unknown' }), false);
assert.equal(isClientScopedRecordEnvelope({ ...envelope, organizationId: '' }), false);
assert.equal(isClientScopedRecordEnvelope({ ...envelope, data: [] }), false);
assert.equal(
  isClientScopedRecordEnvelope({ ...envelope, unapprovedField: 'not-allowed' }),
  false,
);

assert.equal(assertClientRecordMatchesScope(envelope, expected), envelope);
assert.throws(
  () => assertClientRecordMatchesScope(envelope, { ...expected, organizationId: 'org_other' }),
  (error) => error.message === 'CLIENT_RECORD_SCOPE_MISMATCH',
);
assert.throws(
  () => assertClientRecordMatchesScope(envelope, { ...expected, clientId: 'client_other' }),
  (error) => error.message === 'CLIENT_RECORD_SCOPE_MISMATCH',
);
assert.throws(
  () => assertClientRecordMatchesScope({ ...envelope, extra: true }, expected),
  (error) => error.message === 'CLIENT_RECORD_ENVELOPE_INVALID',
);

const document = {
  organizationId: expected.organizationId,
  name: 'ID Document',
  category: 'identity',
  originalFileName: 'synthetic-id.pdf',
  contentType: 'application/pdf',
  size: 1024,
  downloadUrl: 'https://example.invalid/signed?token=SECRET_SENTINEL',
  storagePath: 'private/org_alpha/SECRET_SENTINEL',
  storageBucket: 'private-documents',
  storageProvider: 'supabase',
  relatedType: 'client',
  relatedId: expected.clientId,
  uploadedBy: 'synthetic-uploader',
  notes: 'SECRET_FREE_TEXT_SENTINEL',
  description: 'SECRET_DESCRIPTION_SENTINEL',
  tags: ['secret-tag'],
  status: 'active',
  expiryDate: '2027-01-01',
  issuedDate: '2026-01-01',
  issuedBy: 'synthetic-authority',
  verified: true,
  verifiedAt: '2026-11-01T10:00:00.000Z',
  verifiedBy: 'synthetic-reviewer',
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-01T10:00:00.000Z',
};

const projected = projectClientDocumentMetadata('doc_001', document, expected);
assert.equal(projected.id, 'doc_001');
assert.equal(projected.organizationId, expected.organizationId);
assert.equal(projected.clientId, expected.clientId);
assert.equal(projected.category, 'identity');
assert.equal(projected.relatedType, 'client');
assert.equal(projected.relatedId, expected.clientId);
for (const forbidden of [
  'downloadUrl',
  'storagePath',
  'storageBucket',
  'notes',
  'description',
  'tags',
]) {
  assert.equal(Object.hasOwn(projected, forbidden), false, forbidden + ' must not enter the metadata projection');
}
const serializedProjection = JSON.stringify(projected);
for (const sentinel of [
  'SECRET_SENTINEL',
  'SECRET_FREE_TEXT_SENTINEL',
  'SECRET_DESCRIPTION_SENTINEL',
]) {
  assert.equal(serializedProjection.includes(sentinel), false);
}
assert.deepEqual(
  Object.keys(projected).filter(key => CLIENT_DOCUMENT_METADATA_FIELDS.includes(key)).sort(),
  Object.keys(document).filter(key => CLIENT_DOCUMENT_METADATA_FIELDS.includes(key)).sort(),
);

assert.throws(
  () => projectClientDocumentMetadata('doc_001', { ...document, organizationId: 'org_beta' }, expected),
  (error) => error.message === 'CLIENT_DOCUMENT_SCOPE_MISMATCH',
);
assert.throws(
  () => projectClientDocumentMetadata('doc_001', { ...document, relatedId: 'client_other' }, expected),
  (error) => error.message === 'CLIENT_DOCUMENT_SCOPE_MISMATCH',
);
assert.throws(
  () => projectClientDocumentMetadata('doc_001', { ...document, relatedType: 'policy' }, expected),
  (error) => error.message === 'CLIENT_DOCUMENT_SCOPE_MISMATCH',
);

for (const key of [
  'baseClient',
  'identity',
  'family',
  'financial',
  'contact_address',
  'medical',
  'claim_sensitive',
  'document_metadata',
  'ai_findings',
  'audit_events',
]) {
  assert.ok(CLIENT_DATA_CONTRACT_CATALOG[key], 'Missing contract catalog entry: ' + key);
}
for (const key of [
  'identity',
  'family',
  'financial',
  'contact_address',
  'medical',
  'claim_sensitive',
  'ai_findings',
  'audit_events',
]) {
  assert.equal(CLIENT_DATA_CONTRACT_CATALOG[key].status, 'proposed-default-deny');
}

const declarations = await readFile(
  new URL('../src/features/clients/client-data.contracts.d.ts', import.meta.url),
  'utf8',
);
for (const contract of [
  'ClientIdentityProfileData',
  'ClientFamilyProfileData',
  'ClientFinancialProfileData',
  'ClientAddressProfileData',
  'ClientMedicalProfileData',
  'ClientClaimSensitiveData',
  'ClientAiFindingsData',
  'ClientDocumentMetadataProjection',
  'ClientScopedRecordEnvelope',
]) {
  assert.ok(declarations.includes(contract), 'Missing typed contract: ' + contract);
}
assert.match(declarations, /ClientIdentityProfileData[\s\S]*?nationalId/);
assert.match(declarations, /ClientMedicalProfileData[\s\S]*?chronicConditions/);
assert.match(declarations, /ClientFinancialProfileData[\s\S]*?annualRevenue/);
assert.match(declarations, /ClientClaimSensitiveData[\s\S]*?claimAmount/);
assert.match(declarations, /ClientDocumentMetadataProjection[\s\S]*?relatedId/);
assert.doesNotMatch(declarations, /downloadUrl\s*:/);
assert.doesNotMatch(declarations, /storagePath\s*:/);

const implementation = await readFile(
  new URL('../src/features/clients/client-data.contracts.js', import.meta.url),
  'utf8',
);
assert.doesNotMatch(implementation, /from ['"]firebase\/firestore['"]/);
assert.doesNotMatch(implementation, /\b(?:addDoc|setDoc|updateDoc|deleteDoc|getDoc|getDocs)\s*\(/);

console.log('P1-E typed client data contract and safe metadata projection tests passed.');
