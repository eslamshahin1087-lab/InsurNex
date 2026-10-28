import assert from 'node:assert/strict';
import {
  areaForCategory,
  metadataMatchesPath,
  parseDocumentPath,
  roleCanAccessDocument,
} from '../supabase/functions/document-storage/access-policy.mjs';

const org = 'org_A-123';
const client = 'client_A-456';
const documentId = 'doc_123';
const path = `organizations/${org}/clients/${client}/claim/${documentId}-evidence.pdf`;

assert.deepEqual(parseDocumentPath(path, org), {
  organizationId: org,
  clientId: client,
  area: 'claim',
  path,
}, 'valid organization/client document paths parse');

assert.equal(parseDocumentPath(path, 'other-org'), null, 'cross-organization path is rejected');
assert.equal(parseDocumentPath(`organizations/${org}/clients/${client}/unknown/${documentId}.pdf`, org), null, 'unknown storage area is rejected');
assert.equal(parseDocumentPath(`organizations/${org}/clients/${client}/claim/../secret.pdf`, org), null, 'path traversal is rejected');
assert.equal(parseDocumentPath('organizations/org_A/../claims/secret.pdf', org), null, 'unexpected path shape is rejected');

assert.equal(areaForCategory('claim'), 'claim');
assert.equal(areaForCategory('policy'), 'policy');
assert.equal(areaForCategory('proposal'), 'quotation');
assert.equal(areaForCategory('identity'), 'onboarding');

const request = { organizationId: org, clientId: client, area: 'claim', path, contentType: 'application/pdf', size: 123, bucket: 'insurnex-documents', actorUid: 'uploader_1' };
const metadata = {
  organizationId: org,
  storagePath: path,
  storageProvider: 'supabase',
  relatedType: 'client',
  relatedId: client,
  category: 'claim',
  storageBucket: 'insurnex-documents',
  uploadedBy: 'uploader_1',
  contentType: 'application/pdf',
  size: 123,
};
assert.equal(metadataMatchesPath(metadata, request), true, 'matching metadata binds exact path, tenant, relation and file type');
assert.equal(metadataMatchesPath({ ...metadata, storagePath: path + '.other' }, request), false, 'path must match the Firestore metadata exactly');
assert.equal(metadataMatchesPath({ ...metadata, organizationId: 'different-org' }, request), false, 'metadata from another organization is rejected');
assert.equal(metadataMatchesPath({ ...metadata, relatedId: 'another-client' }, request), false, 'metadata for another client is rejected');
assert.equal(metadataMatchesPath({ ...metadata, storageProvider: 'firebase' }, request), false, 'legacy Firebase objects cannot be accessed through this Supabase gateway');
assert.equal(metadataMatchesPath({ ...metadata, storageBucket: 'public-bucket' }, request), false, 'metadata bucket must match the configured private bucket');
assert.equal(metadataMatchesPath({ ...metadata, uploadedBy: 'another-user' }, request), false, 'only the original uploader can request a signed upload for a pending path');
assert.equal(metadataMatchesPath({ ...metadata, category: 'identity' }, request), false, 'category and storage area must agree');
assert.equal(metadataMatchesPath(metadata, { ...request, contentType: 'image/png' }), false, 'upload content type must match the authorized metadata');
assert.equal(metadataMatchesPath(metadata, { ...request, size: 124 }), false, 'upload size must match the authorized metadata');

for (const role of ['owner', 'admin', 'broker']) {
  assert.equal(roleCanAccessDocument(role, 'identity', 'onboarding', 'read'), true, role + ' can access authorized client files');
  assert.equal(roleCanAccessDocument(role, 'claim', 'claim', 'delete'), true, role + ' can delete per existing owner/admin/broker policy');
}
assert.equal(roleCanAccessDocument('claims', 'claim', 'claim', 'read'), true, 'claims can read claim files');
assert.equal(roleCanAccessDocument('claims', 'claim', 'claim', 'write'), true, 'claims can upload claim files');
assert.equal(roleCanAccessDocument('claims', 'claim', 'claim', 'delete'), false, 'claims cannot delete files');
assert.equal(roleCanAccessDocument('claims', 'identity', 'onboarding', 'read'), false, 'claims cannot access identity files');
for (const role of ['sales', 'finance', 'staff', 'platform_admin', '']) {
  assert.equal(roleCanAccessDocument(role, 'claim', 'claim', 'read'), false, role + ' has no document gateway access');
}

console.log('All document-storage policy regression tests passed.');
