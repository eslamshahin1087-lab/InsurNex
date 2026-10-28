import assert from 'node:assert/strict';
import {
  buildLegacyStorageInventory,
  normalizeLegacyStorageReference,
} from './legacy-storage-inventory-policy.mjs';

const bucket = 'insurnex-8a9df.appspot.com';
const urlFor = path =>
  `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=not-in-report`;

assert.deepEqual(
  normalizeLegacyStorageReference('organizations/org_a/documents/report.pdf', bucket),
  { status: 'resolved', bucket, path: 'organizations/org_a/documents/report.pdf' },
  'plain storagePath resolves without network access',
);
assert.deepEqual(
  normalizeLegacyStorageReference(`gs://${bucket}/organizations/org_a/report.pdf`, bucket),
  { status: 'resolved', bucket, path: 'organizations/org_a/report.pdf' },
  'gs:// reference resolves to object key',
);
assert.deepEqual(
  normalizeLegacyStorageReference(urlFor('organizations/org_a/report 1.pdf'), bucket),
  { status: 'resolved', bucket, path: 'organizations/org_a/report 1.pdf' },
  'Firebase download URL decodes its object path',
);
assert.equal(
  normalizeLegacyStorageReference(`gs://other-bucket/organizations/org_a/report.pdf`, bucket).status,
  'bucket_mismatch',
  'cross-bucket reference is explicitly flagged',
);
assert.equal(normalizeLegacyStorageReference('https://storage.supabase.co/object/sign/bucket/file.pdf', bucket).status,
  'unsupported_url', 'non-Firebase download links are never treated as Firebase object keys');
assert.equal(normalizeLegacyStorageReference('organizations/org_a/../secret.pdf', bucket).status,
  'invalid_path', 'path traversal-like metadata is rejected');

const records = [
  { collection: 'documents', id: 'doc_ok', data: {
    organizationId: 'org_a', storageProvider: 'firebase',
    storagePath: 'organizations/org_a/documents/report.pdf',
    downloadUrl: urlFor('organizations/org_a/documents/report.pdf'),
    originalFileName: 'report.pdf', size: 100, contentType: 'application/pdf',
    md5Hash: 'md5-good', createdAt: new Date('2026-10-01T10:00:00.000Z'),
  } },
  { collection: 'operationAttachments', id: 'att_url_only', data: {
    organizationId: 'org_a', downloadUrl: urlFor('organizations/org_a/operations/op_a/invoice.xlsx'),
    name: 'invoice.xlsx', size: 200, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  } },
  { collection: 'documents', id: 'doc_missing', data: {
    organizationId: 'org_a', storagePath: 'organizations/org_a/missing.pdf', size: 88,
  } },
  { collection: 'documents', id: 'doc_size_mismatch', data: {
    organizationId: 'org_a', storagePath: 'organizations/org_a/size-mismatch.pdf',
    size: 10, md5Hash: 'md5-expected',
  } },
  { collection: 'documents', id: 'doc_path_url_mismatch', data: {
    organizationId: 'org_a', storagePath: 'organizations/org_a/path-a.pdf',
    downloadUrl: urlFor('organizations/org_a/path-b.pdf'),
  } },
  { collection: 'documents', id: 'doc_duplicate_ref', data: {
    organizationId: 'org_a', storagePath: 'organizations/org_a/shared.pdf', size: 100,
  } },
  { collection: 'documents', id: 'doc_duplicate_ref_2', data: {
    organizationId: 'org_a', storagePath: 'organizations/org_a/shared.pdf', size: 100,
  } },
  { collection: 'documents', id: 'doc_tenant_mismatch', data: {
    organizationId: 'org_b', storagePath: 'organizations/org_a/tenant-mismatch.pdf', size: 40,
  } },
  { collection: 'documents', id: 'doc_supabase', data: {
    organizationId: 'org_a', storageProvider: 'supabase',
    storagePath: 'organizations/org_a/documents/supabase-new.pdf',
  } },
  { collection: 'documents', id: 'doc_without_ref', data: { organizationId: 'org_a', name: 'record without attachment' } },
  { collection: 'documents', id: 'doc_unsupported', data: {
    organizationId: 'org_a', downloadUrl: 'https://storage.supabase.co/object/sign/bucket/file.pdf',
  } },
];

const objects = [
  { name: 'organizations/org_a/documents/report.pdf', size: 100, contentType: 'application/pdf', md5Hash: 'md5-good', crc32c: 'crc-1' },
  { name: 'organizations/org_a/operations/op_a/invoice.xlsx', size: 200, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { name: 'organizations/org_a/size-mismatch.pdf', size: 11, md5Hash: 'md5-actual' },
  { name: 'organizations/org_a/shared.pdf', size: 100 },
  { name: 'organizations/org_a/tenant-mismatch.pdf', size: 40 },
  { name: 'organizations/org_a/unreferenced.pdf', size: 99, md5Hash: 'md5-unused' },
];

const report = buildLegacyStorageInventory({
  projectId: 'insurnex-8a9df',
  bucket,
  collections: ['documents', 'operationAttachments'],
  metadataRecords: records,
  objects,
  generatedAt: '2026-10-28T10:00:00.000Z',
  retryLog: [{ operation: 'storage.list.page.2', attempt: 1, outcome: 'retrying', delayMs: 500 }],
});

assert.equal(report.mode, 'read-only-dry-run');
assert.equal(report.noCloudChangesMade, true);
assert.equal(report.summary.metadataRecordsScanned, records.length);
assert.equal(report.summary.ignoredSupabaseRecords, 1);
assert.equal(report.summary.ignoredWithoutStorageReference, 1);
assert.equal(report.summary.bucketObjectsScanned, objects.length);
assert.equal(report.summary.unreferencedBucketObjects, 1);
assert.equal(report.summary.missingObjects, 2);
assert.equal(report.summary.sizeMismatches, 1);
assert.equal(report.summary.md5Mismatches, 1);
assert.equal(report.summary.duplicateMetadataPaths, 2);
assert.equal(report.summary.unresolvedMetadataReferences, 1);
assert.ok(report.metadataRecords.find(item => item.documentId === 'doc_ok')?.status === 'matched',
  'a matching object and metadata size/checksum reconcile cleanly');
assert.ok(report.metadataRecords.find(item => item.documentId === 'att_url_only')?.status === 'matched',
  'legacy Firebase download URL can recover a missing storagePath');
assert.ok(report.metadataRecords.find(item => item.documentId === 'doc_path_url_mismatch')?.issues.includes('STORAGE_PATH_URL_MISMATCH'),
  'path and URL disagreements are reported');
assert.ok(report.metadataRecords.find(item => item.documentId === 'doc_size_mismatch')?.issues.includes('SIZE_MISMATCH'),
  'size mismatch is reported');
assert.ok(report.metadataRecords.find(item => item.documentId === 'doc_size_mismatch')?.issues.includes('MD5_MISMATCH'),
  'MD5 mismatch is reported when a stored expected MD5 exists');
assert.ok(report.metadataRecords.find(item => item.documentId === 'doc_missing')?.issues.includes('OBJECT_NOT_FOUND'),
  'metadata pointing to a missing bucket object is reported');
assert.ok(report.metadataRecords.find(item => item.documentId === 'doc_duplicate_ref')?.issues.includes('DUPLICATE_METADATA_REFERENCE'),
  'multiple metadata records pointing to one object are reported');
assert.ok(report.metadataRecords.find(item => item.documentId === 'doc_tenant_mismatch')?.issues.includes('PATH_ORGANIZATION_MISMATCH'),
  'metadata organization must match the organization embedded in the path');
assert.ok(!JSON.stringify(report).includes('not-in-report'),
  'download URL tokens never enter the inventory report');
assert.ok(!JSON.stringify(report).includes('https://firebasestorage.googleapis.com'),
  'source download URLs never enter the inventory report');

console.log('All legacy storage inventory regression tests passed.');
