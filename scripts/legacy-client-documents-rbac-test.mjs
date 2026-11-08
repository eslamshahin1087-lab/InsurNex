import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  LEGACY_CLIENT_DOCUMENT_READ_ROLES,
  canReadLegacyClientDocumentReferences,
} from '../src/features/documents/legacy-client-documents.policy.js';
import {
  roleCanAccessDocument,
  roleCanAccessLegacyClientDocument,
} from '../supabase/functions/document-storage/access-policy.mjs';

const expectedRoles = ['owner', 'admin', 'broker'];
assert.deepEqual(LEGACY_CLIENT_DOCUMENT_READ_ROLES, expectedRoles);
for (const role of expectedRoles) {
  assert.equal(canReadLegacyClientDocumentReferences(role), true);
  assert.equal(roleCanAccessLegacyClientDocument(role, 'read', 'identity'), true);
  assert.equal(roleCanAccessLegacyClientDocument(role, 'delete', 'claim'), false);
}
for (const role of ['sales', 'claims', 'finance', 'staff', 'platform_admin', '', null]) {
  assert.equal(canReadLegacyClientDocumentReferences(role), false, String(role));
  assert.equal(roleCanAccessLegacyClientDocument(role, 'read', 'claim'), false, String(role));
}
assert.equal(roleCanAccessLegacyClientDocument('broker', 'write', 'claim'), false);

// Claims retains its distinct, relationship-bound access to claim documents;
// the restriction applies only to embedded references requiring clients/{id}.
assert.equal(
  roleCanAccessDocument('claims', 'claim', 'read', { layout: 'general', relatedType: 'claim' }),
  true,
  'Claims can continue reading claim-related metadata through the normal documents collection',
);

const service = await readFile(
  new URL('../src/features/documents/legacy-client-documents.service.ts', import.meta.url),
  'utf8',
);
const policySource = await readFile(
  new URL('../src/features/documents/legacy-client-documents.policy.js', import.meta.url),
  'utf8',
);
const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
const clientBlock = rules.match(/match \/clients\/\{clientId\} \{([\s\S]*?)\n    \}/)?.[1];

assert.ok(service.includes('canReadLegacyClientDocumentReferences(role)'));
assert.ok(policySource.includes("'owner'") && policySource.includes("'admin'") && policySource.includes("'broker'"));
assert.doesNotMatch(service, /role\s*===\s*['"]claims['"]/);
assert.ok(clientBlock, 'legacy client Rules block exists');
assert.match(
  clientBlock,
  /allow read: if[\s\S]*?roleIs\(\['owner','admin','broker'\]\)/,
  'embedded-client reader role guard must match Firestore Rules',
);

console.log('Legacy embedded client-document RBAC parity tests passed; Claims access to canonical claim documents remains intact.');
