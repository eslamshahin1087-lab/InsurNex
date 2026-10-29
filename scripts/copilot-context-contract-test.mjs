import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const selector = read('src/features/copilot/copilot-context-selector.ts');
const trustedContext = read('supabase/functions/copilot-chat/trusted-context.ts');
const indexText = read('firestore.indexes.json').replace(/^\uFEFF/, '');
const config = JSON.parse(indexText);

assert.match(selector, /"renewals"/, 'browser selector must preserve the renewal page');
assert.match(trustedContext, /renewals: \["policies"\]/, 'server context builder must map renewals to policy records');
assert.match(trustedContext, /page === "renewals" && collectionId === "policies"/, 'renewal queries must sort by expiry date');
assert.match(trustedContext, /fieldPath: "relatedType"/, 'Client 360 task query must use relatedType');
assert.match(trustedContext, /fieldPath: "relatedId"/, 'Client 360 task query must use relatedId');

const hasIndex = (collectionGroup, fields) => config.indexes.some((index) =>
  index.collectionGroup === collectionGroup &&
  fields.every((required) => index.fields.some((field) =>
    field.fieldPath === required.fieldPath && field.order === required.order)));

const requiredIndexes = [
  ['policies', [{ fieldPath: 'organizationId', order: 'ASCENDING' }, { fieldPath: 'clientId', order: 'ASCENDING' }, { fieldPath: 'createdAt', order: 'DESCENDING' }]],
  ['claims', [{ fieldPath: 'organizationId', order: 'ASCENDING' }, { fieldPath: 'clientId', order: 'ASCENDING' }, { fieldPath: 'createdAt', order: 'DESCENDING' }]],
  ['tasks', [{ fieldPath: 'organizationId', order: 'ASCENDING' }, { fieldPath: 'createdAt', order: 'DESCENDING' }]],
  ['tasks', [{ fieldPath: 'organizationId', order: 'ASCENDING' }, { fieldPath: 'relatedType', order: 'ASCENDING' }, { fieldPath: 'relatedId', order: 'ASCENDING' }, { fieldPath: 'createdAt', order: 'DESCENDING' }]],
  ['policies', [{ fieldPath: 'organizationId', order: 'ASCENDING' }, { fieldPath: 'expiryDate', order: 'ASCENDING' }]],
];

for (const [collectionGroup, fields] of requiredIndexes) {
  assert.ok(hasIndex(collectionGroup, fields), 'missing Copilot context composite index: ' + collectionGroup + ' / ' + fields.map((field) => field.fieldPath).join(', '));
}

console.log('Copilot context contract and Firestore index checks passed.');
