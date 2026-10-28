import assert from 'node:assert/strict';
import {
  areaForCategory,
  metadataMatchesPath,
  parseDocumentPath,
  roleCanAccessDocument,
  parseOperationAttachmentPath,
  operationAttachmentMetadataMatchesPath,
  roleCanAccessOperationAttachment,
  parseLegacyClientDocumentReference,
  roleCanAccessLegacyClientDocument,
} from '../supabase/functions/document-storage/access-policy.mjs';

const org = 'org_A-123';
const client = 'client_A-456';
const documentId = 'doc_123';
const clientPath = `organizations/${org}/clients/${client}/claim/${documentId}-evidence.pdf`;
const generalPath = `organizations/${org}/documents/${documentId}/evidence.pdf`;

assert.deepEqual(parseDocumentPath(clientPath, org), {
  layout: 'client',
  organizationId: org,
  clientId: client,
  area: 'claim',
  path: clientPath,
  filename: `${documentId}-evidence.pdf`,
}, 'valid client-linked document path parses');
assert.deepEqual(parseDocumentPath(generalPath, org), {
  layout: 'general',
  organizationId: org,
  documentId,
  path: generalPath,
  filename: 'evidence.pdf',
}, 'valid organization-wide document path parses');
assert.equal(parseDocumentPath(clientPath, 'other-org'), null, 'cross-organization client path is rejected');
assert.equal(parseDocumentPath(generalPath, 'other-org'), null, 'cross-organization general path is rejected');
assert.equal(parseDocumentPath(`organizations/${org}/clients/${client}/unknown/${documentId}.pdf`, org), null, 'unknown storage area is rejected');
assert.equal(parseDocumentPath(`organizations/${org}/clients/${client}/claim/../secret.pdf`, org), null, 'client path traversal is rejected');
assert.equal(parseDocumentPath(`organizations/${org}/documents/${documentId}/../secret.pdf`, org), null, 'general path traversal is rejected');
assert.equal(parseDocumentPath('organizations/org_A/../claims/secret.pdf', org), null, 'unexpected path shape is rejected');

const legacyHost = 'piloiwtdbtmfiyqxfbae.supabase.co';
const legacyUrl = `https://${legacyHost}/storage/v1/object/sign/insurnex-documents/organizations/${org}/clients/${client}/onboarding/legacy-id.pdf?token=do-not-retain`;
const legacyRequest = {
  organizationId: org,
  clientId: client,
  expectedBucket: 'insurnex-documents',
  expectedHost: legacyHost,
};
assert.deepEqual(
  parseLegacyClientDocumentReference({ id: 'legacy_doc', url: legacyUrl }, legacyRequest),
  {
    bucket: 'insurnex-documents',
    path: `organizations/${org}/clients/${client}/onboarding/legacy-id.pdf`,
    area: 'onboarding',
    filename: 'legacy-id.pdf',
    source: 'url',
  },
  'valid embedded Supabase signed URL resolves to its stable object key without its token',
);
assert.deepEqual(
  parseLegacyClientDocumentReference({
    id: 'legacy_doc',
    storageProvider: 'supabase',
    storageBucket: 'insurnex-documents',
    storagePath: `organizations/${org}/clients/${client}/claim/legacy-claim.pdf`,
  }, legacyRequest),
  {
    bucket: 'insurnex-documents',
    path: `organizations/${org}/clients/${client}/claim/legacy-claim.pdf`,
    area: 'claim',
    filename: 'legacy-claim.pdf',
    source: 'storagePath',
  },
  'provider-tagged stable paths are supported for backward-compatible embedded records',
);
assert.equal(
  parseLegacyClientDocumentReference({ id: 'legacy_doc', url: legacyUrl }, { ...legacyRequest, organizationId: 'other_org' }),
  null,
  'foreign organization is rejected',
);
assert.equal(
  parseLegacyClientDocumentReference({ id: 'legacy_doc', url: legacyUrl }, { ...legacyRequest, clientId: 'other_client' }),
  null,
  'foreign client is rejected',
);
assert.equal(
  parseLegacyClientDocumentReference({ id: 'legacy_doc', url: legacyUrl.replace(legacyHost, 'attacker.supabase.co') }, legacyRequest),
  null,
  'URLs from a different Supabase project are rejected',
);
assert.equal(
  parseLegacyClientDocumentReference({ id: 'legacy_doc', url: legacyUrl.replace('insurnex-documents', 'public-bucket') }, legacyRequest),
  null,
  'a different bucket is rejected',
);
assert.equal(
  parseLegacyClientDocumentReference({ id: 'legacy_doc', storageProvider: 'firebase', url: legacyUrl }, legacyRequest),
  null,
  'explicit Firebase metadata cannot be coerced into a Supabase reference',
);
assert.equal(
  parseLegacyClientDocumentReference({
    id: 'legacy_doc', storageProvider: 'supabase',
    storagePath: `organizations/${org}/clients/${client}/onboarding/path-a.pdf`,
    url: legacyUrl,
  }, legacyRequest),
  null,
  'conflicting stable path and URL are rejected',
);
assert.equal(
  parseLegacyClientDocumentReference({
    id: 'legacy_doc',
    url: legacyUrl,
    downloadUrl: legacyUrl.replace('legacy-id.pdf', 'different-file.pdf'),
  }, legacyRequest),
  null,
  'conflicting stored URL fields are rejected',
);
assert.equal(
  parseLegacyClientDocumentReference({
    id: 'legacy_doc',
    url: `https://${legacyHost}/storage/v1/object/sign/insurnex-documents/organizations/${org}/clients/${client}/onboarding/%2e%2e%2fsecrets.pdf?token=x`,
  }, legacyRequest),
  null,
  'encoded path traversal is rejected',
);
for (const role of ['owner', 'admin', 'broker']) {
  assert.equal(roleCanAccessLegacyClientDocument(role, 'read', 'identity'), true, role + ' can read active-tenant legacy client documents');
  assert.equal(roleCanAccessLegacyClientDocument(role, 'delete', 'identity'), false, role + ' cannot delete legacy documents through the compatibility route');
}
assert.equal(roleCanAccessLegacyClientDocument('claims', 'read', 'claim'), true, 'claims role can only read claim-category legacy documents');
assert.equal(roleCanAccessLegacyClientDocument('claims', 'read', 'identity'), false, 'claims role cannot read identity legacy documents');
assert.equal(roleCanAccessLegacyClientDocument('platform_admin', 'read', 'claim'), false, 'platform admin has no implicit document gateway access');
assert.equal(roleCanAccessLegacyClientDocument('broker', 'write', 'identity'), false, 'legacy compatibility route is read-only');


assert.equal(areaForCategory('claim'), 'claim');
assert.equal(areaForCategory('policy'), 'policy');
assert.equal(areaForCategory('proposal'), 'quotation');
assert.equal(areaForCategory('identity'), 'onboarding');

const clientRequest = {
  layout: 'client', organizationId: org, clientId: client, documentId,
  area: 'claim', path: clientPath, filename: `${documentId}-evidence.pdf`,
  contentType: 'application/pdf', size: 123, bucket: 'insurnex-documents', actorUid: 'uploader_1',
};
const clientMetadata = {
  organizationId: org, storagePath: clientPath, storageProvider: 'supabase',
  relatedType: 'client', relatedId: client, category: 'claim',
  storageBucket: 'insurnex-documents', uploadedBy: 'uploader_1', storageKeyVersion: 2,
  contentType: 'application/pdf', size: 123,
};
assert.equal(metadataMatchesPath(clientMetadata, clientRequest), true, 'client metadata binds exact file identity');
assert.equal(metadataMatchesPath({ ...clientMetadata, storagePath: clientPath + '.other' }, clientRequest), false, 'path must exactly match metadata');
assert.equal(metadataMatchesPath({ ...clientMetadata, organizationId: 'different-org' }, clientRequest), false, 'foreign tenant metadata is rejected');
assert.equal(metadataMatchesPath({ ...clientMetadata, relatedId: 'another-client' }, clientRequest), false, 'foreign client relation is rejected');
assert.equal(metadataMatchesPath({ ...clientMetadata, storageProvider: 'firebase' }, clientRequest), false, 'legacy Firebase object cannot use this gateway');
assert.equal(metadataMatchesPath({ ...clientMetadata, storageBucket: 'public-bucket' }, clientRequest), false, 'bucket must match configured private bucket');
assert.equal(metadataMatchesPath({ ...clientMetadata, uploadedBy: 'another-user' }, clientRequest), false, 'only uploader may obtain a signed URL for a pending upload');
assert.equal(metadataMatchesPath({ ...clientMetadata, category: 'identity' }, clientRequest), false, 'category and area must agree');
assert.equal(metadataMatchesPath(clientMetadata, { ...clientRequest, contentType: 'image/png' }), false, 'content type mismatch is rejected');
assert.equal(metadataMatchesPath(clientMetadata, { ...clientRequest, size: 124 }), false, 'size mismatch is rejected');
assert.equal(metadataMatchesPath(clientMetadata, { ...clientRequest, documentId: 'another-doc' }), false, 'client path must be bound to metadata ID');

const generalRequest = {
  layout: 'general', organizationId: org, documentId, pathDocumentId: documentId,
  path: generalPath, filename: 'evidence.pdf', bucket: 'insurnex-documents',
  contentType: 'application/pdf', size: 123, actorUid: 'uploader_1',
};
const generalMetadata = {
  ...clientMetadata,
  storagePath: generalPath,
  relatedType: 'general',
  relatedId: '',
  category: 'other',
};
assert.equal(metadataMatchesPath(generalMetadata, generalRequest), true, 'general metadata binds folder document ID');
assert.equal(metadataMatchesPath(generalMetadata, { ...generalRequest, pathDocumentId: 'another-doc' }), false, 'general path document ID must equal metadata ID');
assert.equal(metadataMatchesPath({ ...generalMetadata, relatedId: 'unrelated-id' }, generalRequest), false, 'general metadata cannot contain a stray relation ID');
assert.equal(metadataMatchesPath({ ...generalMetadata, relatedType: 'unsupported' }, generalRequest), false, 'unsupported relation types are rejected');

for (const role of ['owner', 'admin', 'broker']) {
  assert.equal(roleCanAccessDocument(role, 'identity', 'read', { layout: 'client', relatedType: 'client' }), true, role + ' may read authorized files');
  assert.equal(roleCanAccessDocument(role, 'claim', 'delete', { layout: 'client', relatedType: 'client' }), true, role + ' may delete authorized files');
  assert.equal(roleCanAccessDocument(role, 'other', 'read', { layout: 'general', relatedType: 'general' }), true, role + ' may access general records');
}
assert.equal(roleCanAccessDocument('claims', 'claim', 'read', { layout: 'client', relatedType: 'client', documentIdMatchesPath: true }), true, 'claims can read properly bound claim-category client documents');
assert.equal(roleCanAccessDocument('claims', 'claim', 'read', { layout: 'client', relatedType: 'client', documentIdMatchesPath: false }), false, 'claims cannot access legacy paths without a metadata-ID prefix');
assert.equal(roleCanAccessDocument('claims', 'claim', 'write', { layout: 'general', relatedType: 'claim' }), true, 'claims can access explicitly related claim records');
assert.equal(roleCanAccessDocument('claims', 'claim', 'delete', { layout: 'client', relatedType: 'client', documentIdMatchesPath: true }), false, 'claims cannot delete documents');
assert.equal(roleCanAccessDocument('claims', 'identity', 'read', { layout: 'client', relatedType: 'client', documentIdMatchesPath: true }), false, 'claims cannot access identity documents');
assert.equal(roleCanAccessDocument('claims', 'claim', 'read', { layout: 'general', relatedType: 'general' }), false, 'claims cannot read unattached organization-wide claim files');
for (const role of ['sales', 'finance', 'staff', 'platform_admin', '']) {
  assert.equal(roleCanAccessDocument(role, 'claim', 'read', { layout: 'client', relatedType: 'client' }), false, role + ' has no storage gateway access');
}



// Operation attachments use an independent resource and stricter delete policy.
const operationId = 'op_456';
const attachmentId = 'att_789';
const operationPath = `organizations/${org}/operations/${operationId}/${attachmentId}-invoice.pdf`;
assert.deepEqual(parseOperationAttachmentPath(operationPath, org), {
  layout: 'operation',
  organizationId: org,
  operationId,
  path: operationPath,
  filename: `${attachmentId}-invoice.pdf`,
}, 'valid operation attachment path parses');
assert.equal(parseOperationAttachmentPath(operationPath, 'other-org'), null, 'cross-tenant operation path is rejected');
assert.equal(parseOperationAttachmentPath(`organizations/${org}/operations/${operationId}/../invoice.pdf`, org), null, 'operation path traversal is rejected');

const operationRequest = {
  organizationId: org, operationId, attachmentId, path: operationPath,
  filename: `${attachmentId}-invoice.pdf`, bucket: 'insurnex-documents',
  contentType: 'application/pdf', size: 321, actorUid: 'uploader_1',
};
const operationMetadata = {
  organizationId: org, operationId, storagePath: operationPath,
  storageProvider: 'supabase', storageBucket: 'insurnex-documents',
  storageKeyVersion: 2, downloadUrl: '', uploadedBy: 'uploader_1',
  contentType: 'application/pdf', size: 321,
};
assert.equal(operationAttachmentMetadataMatchesPath(operationMetadata, operationRequest), true, 'operation attachment binds to exact metadata');
assert.equal(operationAttachmentMetadataMatchesPath({ ...operationMetadata, operationId: 'foreign-op' }, operationRequest), false, 'foreign operation metadata is rejected');
assert.equal(operationAttachmentMetadataMatchesPath({ ...operationMetadata, storagePath: operationPath + '.other' }, operationRequest), false, 'path mismatch is rejected');
assert.equal(operationAttachmentMetadataMatchesPath({ ...operationMetadata, storageProvider: 'firebase' }, operationRequest), false, 'Firebase legacy metadata cannot use the Supabase gateway');
assert.equal(operationAttachmentMetadataMatchesPath({ ...operationMetadata, storageKeyVersion: 1 }, operationRequest), false, 'unversioned operation attachments are rejected');
assert.equal(operationAttachmentMetadataMatchesPath({ ...operationMetadata, downloadUrl: 'https://example.invalid/file' }, operationRequest), false, 'persistent download URLs are rejected');
assert.equal(operationAttachmentMetadataMatchesPath(operationMetadata, { ...operationRequest, attachmentId: 'another-id' }), false, 'object filename must bind to attachment ID');
assert.equal(operationAttachmentMetadataMatchesPath({ ...operationMetadata, uploadedBy: 'other-user' }, operationRequest), false, 'only uploader may request a signed upload');
assert.equal(operationAttachmentMetadataMatchesPath(operationMetadata, { ...operationRequest, size: 322 }), false, 'file size mismatch is rejected');

for (const role of ['owner', 'admin']) {
  assert.equal(roleCanAccessOperationAttachment(role, 'read'), true, role + ' can read operation attachments');
  assert.equal(roleCanAccessOperationAttachment(role, 'write'), true, role + ' can upload operation attachments');
  assert.equal(roleCanAccessOperationAttachment(role, 'delete'), true, role + ' can delete operation attachments');
}
for (const role of ['broker', 'claims']) {
  assert.equal(roleCanAccessOperationAttachment(role, 'read'), true, role + ' can read operation attachments');
  assert.equal(roleCanAccessOperationAttachment(role, 'write'), true, role + ' can upload operation attachments');
  assert.equal(roleCanAccessOperationAttachment(role, 'delete'), false, role + ' cannot delete operation attachments');
}
for (const role of ['sales', 'finance', 'staff', 'platform_admin', '']) {
  assert.equal(roleCanAccessOperationAttachment(role, 'read'), false, role + ' cannot access operation attachment storage');
}

console.log('All document-storage and operation-attachment policy regression tests passed.');
