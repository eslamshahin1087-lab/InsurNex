import assert from 'node:assert/strict';
import {
  OPERATION_MAX_BYTES,
  DOCUMENT_MAX_BYTES,
  authorizeRecordAction,
  authorizeUpload,
  canManageStorage,
  classifyStoragePath,
  parentRecordPath,
  resolveUniqueAttachmentRecord,
  resolveActiveMembership,
  resolveDocumentRelation,
} from '../supabase/functions/document-storage/policy.js';

const org = 'org_test123';
const uid = 'uid_uploader123';
const otherUid = 'uid_other123';
const clientId = 'client_abc123';
const operationId = 'operation_xyz123';
const pdf = 'application/pdf';
const csv = 'text/csv';

function pass(message) {
  console.log('PASS ' + message);
}

function deny(condition, message) {
  assert.equal(condition, false, message);
  console.log('PASS denied: ' + message);
}

const activeMember = {
  uid,
  status: 'active',
  role: 'broker',
};
const activeProfile = {
  status: 'active',
  organizationId: org,
  role: 'broker',
  membershipEnforced: true,
};
assert.deepEqual(resolveActiveMembership({ profile: activeProfile, member: activeMember, organizationId: org, uid }), { role: 'broker' });
assert.equal(resolveActiveMembership({ profile: { ...activeProfile, status: 'suspended' }, member: activeMember, organizationId: org, uid }), null);
assert.equal(resolveActiveMembership({ profile: { ...activeProfile, organizationId: 'org_other' }, member: activeMember, organizationId: org, uid }), null);
assert.equal(resolveActiveMembership({ profile: activeProfile, member: { ...activeMember, status: 'suspended' }, organizationId: org, uid }), null);
assert.equal(resolveActiveMembership({ profile: activeProfile, member: { ...activeMember, uid: otherUid }, organizationId: org, uid }), null);
assert.equal(resolveActiveMembership({ profile: { status: 'active', organizationId: org, role: 'broker' }, member: null, organizationId: org, uid })?.role, 'broker');
assert.equal(resolveActiveMembership({ profile: { status: 'active', organizationId: org, role: 'broker' }, member: { ...activeMember, status: 'suspended' }, organizationId: org, uid }), null);
assert.equal(resolveActiveMembership({ profile: activeProfile, member: null, organizationId: org, uid }), null);
pass('storage gateway requires strict active membership for new profiles while preserving legacy users without membership records');

const documentPath = `organizations/${org}/clients/${clientId}/onboarding/${uid}/file-1.pdf`;
const documentInfo = classifyStoragePath(documentPath, org, uid);
assert.equal(documentInfo?.kind, 'document');
assert.equal(documentInfo?.legacy, false);
assert.deepEqual(parentRecordPath(documentInfo), { collectionName: 'clients', documentId: clientId });
assert.equal(authorizeUpload({ role: 'broker', pathInfo: documentInfo, uid, size: 1024, contentType: pdf }), true);
pass('active broker role can upload a valid client PDF to an organization-scoped UID path');

deny(authorizeUpload({ role: 'viewer', pathInfo: documentInfo, uid, size: 1024, contentType: pdf }),
  'read-only viewer cannot upload client documents');
deny(authorizeUpload({ role: 'broker', pathInfo: documentInfo, uid, size: DOCUMENT_MAX_BYTES + 1, contentType: pdf }),
  'client document upload exceeding 10 MiB is rejected');
deny(authorizeUpload({ role: 'broker', pathInfo: documentInfo, uid, size: 1024, contentType: 'text/html' }),
  'client document upload with unapproved MIME type is rejected');
deny(authorizeUpload({ role: 'broker', pathInfo: documentInfo, uid: otherUid, size: 1024, contentType: pdf }),
  'caller cannot claim another users UID folder');

const otherOrgPath = classifyStoragePath(documentPath, 'org_other', uid);
assert.equal(otherOrgPath, null);
pass('organization mismatch in storage path is rejected');

for (const path of [
  `/organizations/${org}/clients/${clientId}/onboarding/${uid}/file.pdf`,
  `organizations/${org}/clients/../onboarding/${uid}/file.pdf`,
  `organizations/${org}/clients/${clientId}/onboarding/${uid}/../file.pdf`,
  `organizations/${org}/clients/${clientId}/onboarding/%2fadmin/file.pdf`,
]) {
  assert.equal(classifyStoragePath(path, org, uid), null, 'unsafe or foreign path must be rejected: ' + path);
}
pass('absolute, traversal, and encoded-slash paths are rejected');

const foreignUploaderPath = `organizations/${org}/operations/${operationId}/${otherUid}/file.pdf`;
const foreignUploaderInfo = classifyStoragePath(foreignUploaderPath, org, uid);
assert.equal(foreignUploaderInfo?.kind, 'operation');
deny(authorizeUpload({ role: 'operations', pathInfo: foreignUploaderInfo, uid, size: 1024, contentType: pdf }),
  'a caller cannot upload into another user UID folder');
pass('shared files can be classified for reads but their uploader path remains immutable');

const documentCenterPath = `organizations/${org}/documents/${uid}/doc-center-id/file-2.pdf`;
const documentCenterInfo = classifyStoragePath(documentCenterPath, org, uid);
assert.equal(documentCenterInfo?.kind, 'documentCenter');
assert.equal(documentCenterInfo?.resourceId, 'doc-center-id');
assert.equal(parentRecordPath(documentCenterInfo), null);
assert.equal(authorizeUpload({ role: 'broker', pathInfo: documentCenterInfo, uid, size: 1024, contentType: pdf }), true);
assert.deepEqual(resolveDocumentRelation(documentCenterInfo, 'general', ''), {
  collectionName: null,
  documentId: null,
});
assert.deepEqual(resolveDocumentRelation(documentCenterInfo, 'client', clientId), {
  collectionName: 'clients',
  documentId: clientId,
});
assert.deepEqual(resolveDocumentRelation(documentCenterInfo, 'policy', 'policy-1'), {
  collectionName: 'policies',
  documentId: 'policy-1',
});
assert.deepEqual(resolveDocumentRelation(documentCenterInfo, 'claim', 'claim-1'), {
  collectionName: 'claims',
  documentId: 'claim-1',
});
assert.equal(resolveDocumentRelation(documentCenterInfo, 'client', ''), null);
assert.equal(resolveDocumentRelation(documentCenterInfo, 'client', '../other-org'), null);
deny(authorizeUpload({ role: 'broker', pathInfo: documentCenterInfo, uid: otherUid, size: 1024, contentType: pdf }),
  'Document Center upload path must bind the authenticated UID');
pass('Document Center uploads support general/client/policy/claim relations with UID-bound paths');

const legacyDocumentPath = `organizations/${org}/clients/${clientId}/onboarding/old-file.pdf`;
const legacyDocumentInfo = classifyStoragePath(legacyDocumentPath, org, uid);
assert.equal(legacyDocumentInfo?.legacy, true);
deny(authorizeUpload({ role: 'broker', pathInfo: legacyDocumentInfo, uid, size: 1024, contentType: pdf }),
  'legacy path shapes cannot receive new upload grants');

const operationPath = `organizations/${org}/operations/${operationId}/${uid}/attachment-1.csv`;
const operationInfo = classifyStoragePath(operationPath, org, uid);
assert.equal(operationInfo?.kind, 'operation');
assert.equal(parentRecordPath(operationInfo)?.collectionName, 'operations');
assert.equal(authorizeUpload({ role: 'operations', pathInfo: operationInfo, uid, size: OPERATION_MAX_BYTES, contentType: csv }), true);
pass('operations role can upload CSV attachments up to 20 MiB');

deny(authorizeUpload({ role: 'operations', pathInfo: operationInfo, uid, size: OPERATION_MAX_BYTES + 1, contentType: csv }),
  'operations attachment exceeding 20 MiB is rejected');
deny(authorizeUpload({ role: 'operations', pathInfo: operationInfo, uid, size: 1024, contentType: 'image/png' }),
  'unsupported operations attachment MIME type is rejected');

const ownRecord = {
  organizationId: org,
  storagePath: documentPath,
  storageProvider: 'supabase',
  uploadedBy: uid,
};
assert.deepEqual(resolveUniqueAttachmentRecord([ownRecord], org, documentPath, uid), ownRecord);
assert.equal(resolveUniqueAttachmentRecord([
  ownRecord,
  { ...ownRecord, uploadedBy: otherUid },
], org, documentPath, uid), null);
assert.equal(resolveUniqueAttachmentRecord([
  ownRecord,
  ownRecord,
], org, documentPath, uid), null);
pass('file metadata lookup fails closed for forged owner or duplicate matching records');
assert.equal(authorizeRecordAction({
  action: 'sign-download', organizationId: org, path: documentPath,
  pathInfo: documentInfo, role: 'viewer', uid: otherUid, record: ownRecord,
}), true);
pass('active read-only viewer can download a recorded organization document');

deny(authorizeRecordAction({
  action: 'sign-download', organizationId: 'org_other', path: documentPath,
  pathInfo: documentInfo, role: 'owner', uid, record: ownRecord,
}), 'signed download cannot cross organization boundaries');
deny(authorizeRecordAction({
  action: 'sign-download', organizationId: org, path: documentPath,
  pathInfo: documentInfo, role: 'owner', uid, record: { ...ownRecord, storagePath: 'other/path' },
}), 'signed download requires exact file metadata path match');

assert.equal(authorizeRecordAction({
  action: 'delete', organizationId: org, path: documentPath,
  pathInfo: documentInfo, role: 'broker', uid, record: ownRecord,
}), true);
deny(authorizeRecordAction({
  action: 'delete', organizationId: org, path: documentPath,
  pathInfo: documentInfo, role: 'broker', uid: otherUid, record: ownRecord,
}), 'a peer broker cannot delete another uploader file');
assert.equal(authorizeRecordAction({
  action: 'delete', organizationId: org, path: documentPath,
  pathInfo: documentInfo, role: 'manager', uid: otherUid, record: ownRecord,
}), true);
assert.equal(canManageStorage('organizationAdmin'), true);
assert.equal(canManageStorage('finance'), false);
pass('file deletion is uploader-only unless the user is an authorized file manager');

assert.equal(authorizeRecordAction({
  action: 'delete', organizationId: org, path: documentPath,
  pathInfo: documentInfo, role: 'broker', uid, record: null,
}), true);
deny(authorizeRecordAction({
  action: 'delete', organizationId: org, path: legacyDocumentPath,
  pathInfo: legacyDocumentInfo, role: 'broker', uid, record: null,
}), 'metadata-free cleanup cannot delete legacy paths');

console.log('All Supabase document-storage policy tests passed.');
