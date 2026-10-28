import assert from 'node:assert/strict';
import { buildLegacyClientDocumentBackfillPlan } from './legacy-client-document-backfill-policy.mjs';

const host = 'piloiwtdbtmfiyqxfbae.supabase.co';
const bucket = 'insurnex-documents';
const objectPath = (name) => `organizations/org_a/clients/client_a/onboarding/${name}`;
const signedUrl = (name, token = 'do-not-store-this-token') =>
  `https://${host}/storage/v1/object/sign/${bucket}/${objectPath(name)}?token=${token}`;

const clients = [{
  id: 'client_a',
  data: {
    organizationId: 'org_a',
    createdBy: 'user_a',
    name: 'Do not copy this unrelated profile field',
    documents: [
      {
        id: 'embedded_candidate',
        url: signedUrl('candidate.pdf'),
        label: 'Candidate ID',
        fileName: 'candidate.pdf',
        type: 'national-id',
        mimeType: 'application/pdf',
        size: 109904,
        uploadedAt: new Date('2026-10-01T10:00:00.000Z'),
      },
      {
        id: 'embedded_already_mapped',
        url: signedUrl('already-mapped.pdf'),
        label: 'Existing',
        fileName: 'already-mapped.pdf',
        category: 'claim',
        mimeType: 'application/pdf',
        size: 300,
      },
      {
        id: 'embedded_duplicate_a',
        url: signedUrl('duplicate.pdf'),
        label: 'Duplicate A',
        fileName: 'duplicate.pdf',
        mimeType: 'application/pdf',
        size: 10,
      },
      {
        id: 'embedded_duplicate_b',
        url: signedUrl('duplicate.pdf'),
        label: 'Duplicate B',
        fileName: 'duplicate.pdf',
        mimeType: 'application/pdf',
        size: 10,
      },
      {
        id: 'embedded_wrong_host',
        url: 'https://attacker.supabase.co/storage/v1/object/sign/insurnex-documents/organizations/org_a/clients/client_a/onboarding/evil.pdf?token=secret',
        fileName: 'evil.pdf',
      },
      {
        id: 'embedded_firebase',
        storageProvider: 'firebase',
        url: 'https://firebasestorage.googleapis.com/v0/b/example/o/old.pdf?token=secret',
        fileName: 'firebase.pdf',
      },
      {
        id: 'embedded_path_url_conflict',
        storageProvider: 'supabase',
        storageBucket: bucket,
        storagePath: objectPath('path-a.pdf'),
        url: signedUrl('path-b.pdf'),
        fileName: 'conflict.pdf',
      },
    ],
  },
}];

const existingDocs = [{
  id: 'doc_existing_1',
  data: {
    organizationId: 'org_a',
    relatedType: 'client',
    relatedId: 'client_a',
    storageProvider: 'supabase',
    storageBucket: bucket,
    storagePath: objectPath('already-mapped.pdf'),
  },
}];

const input = {
  projectId: 'insurnex-8a9df',
  supabaseHost: host,
  bucket,
  clientRecords: clients,
  documentRecords: existingDocs,
  generatedAt: '2026-10-28T10:00:00.000Z',
};

const plan = buildLegacyClientDocumentBackfillPlan(input);
assert.equal(plan.mode, 'read-only-dry-run-plan');
assert.equal(plan.noCloudChangesMade, true);
assert.equal(plan.writesAttempted, false);
assert.equal(plan.storageObjectsVerified, false);
assert.equal(plan.counts.clientRecordsScanned, 1);
assert.equal(plan.counts.existingDocumentRecordsScanned, 1);
assert.equal(plan.counts.embeddedDocumentReferencesScanned, 7);
assert.equal(plan.counts.eligibleCandidates, 1);
assert.equal(plan.counts.alreadyMapped, 1);
assert.equal(plan.counts.needsReview, 5);

const candidate = plan.entries.find(item => item.sourceEmbeddedDocumentId === 'embedded_candidate');
assert.equal(candidate?.status, 'candidate');
assert.equal(candidate?.bucket, bucket);
assert.equal(candidate?.objectPath, objectPath('candidate.pdf'));
assert.match(candidate?.targetDocumentId || '', /^legacy_[a-f0-9]{40}$/);
assert.equal(candidate?.proposedRecord?.storageProvider, 'supabase');
assert.equal(candidate?.proposedRecord?.storageBucket, bucket);
assert.equal(candidate?.proposedRecord?.storagePath, objectPath('candidate.pdf'));
assert.equal(candidate?.proposedRecord?.downloadUrl, '');
assert.equal(candidate?.proposedRecord?.category, 'identity');
assert.equal(candidate?.proposedRecord?.relatedType, 'client');
assert.equal(candidate?.proposedRecord?.relatedId, 'client_a');
assert.ok(!JSON.stringify(candidate).includes('do-not-store-this-token'));
assert.ok(!JSON.stringify(candidate).includes('https://'));

const alreadyMapped = plan.entries.find(item => item.sourceEmbeddedDocumentId === 'embedded_already_mapped');
assert.equal(alreadyMapped?.status, 'already_mapped');
assert.equal(alreadyMapped?.targetDocumentId, 'doc_existing_1');
assert.equal(alreadyMapped?.proposedRecord, null);

const duplicateEntries = plan.entries.filter(item =>
  ['embedded_duplicate_a', 'embedded_duplicate_b'].includes(item.sourceEmbeddedDocumentId));
assert.equal(duplicateEntries.length, 2);
assert.ok(duplicateEntries.every(item => item.status === 'needs_review'));
assert.ok(duplicateEntries.every(item => item.reason === 'DUPLICATE_EMBEDDED_OBJECT_REFERENCE'));
assert.ok(duplicateEntries.every(item => item.proposedRecord === null));

assert.equal(
  plan.entries.find(item => item.sourceEmbeddedDocumentId === 'embedded_wrong_host')?.reason,
  'REFERENCE_UNSUPPORTED_OR_CONFLICTING',
);
assert.equal(
  plan.entries.find(item => item.sourceEmbeddedDocumentId === 'embedded_firebase')?.reason,
  'FIREBASE_REFERENCE_REQUIRES_SEPARATE_INVENTORY',
);
assert.equal(
  plan.entries.find(item => item.sourceEmbeddedDocumentId === 'embedded_path_url_conflict')?.reason,
  'REFERENCE_UNSUPPORTED_OR_CONFLICTING',
);

const rerun = buildLegacyClientDocumentBackfillPlan(input);
assert.equal(
  rerun.entries.find(item => item.sourceEmbeddedDocumentId === 'embedded_candidate')?.targetDocumentId,
  candidate?.targetDocumentId,
  'the target document ID is deterministic across reruns',
);
assert.ok(
  !JSON.stringify(plan).includes('Do not copy this unrelated profile field'),
  'unrelated client profile information is not copied to the manifest',
);
assert.ok(
  !JSON.stringify(plan).includes('secret'),
  'signed URL query tokens are excluded from the manifest',
);

console.log('All legacy client document backfill-plan regression tests passed.');
