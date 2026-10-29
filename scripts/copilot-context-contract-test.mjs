import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const selector = read('src/features/copilot/copilot-context-selector.ts');
const leadDetailsPage = read('src/pages/LeadDetailsPage.tsx');
const trustedContext = read('supabase/functions/copilot-chat/trusted-context.ts');
const copilotHandler = read('supabase/functions/copilot-chat/index.ts');
const supabaseApiKeyAuth = read('supabase/functions/copilot-chat/api-key-authorization.ts');
const supabaseFunctionConfig = read('supabase/config.toml');
const indexText = read('firestore.indexes.json').replace(/^\uFEFF/, '');
const config = JSON.parse(indexText);

assert.match(selector, /"renewals"/, 'browser selector must preserve the renewal page');
assert.match(trustedContext, /renewals: \["policies"\]/, 'server context builder must map renewals to policy records');
assert.match(trustedContext, /page === "renewals" && collectionId === "policies"/, 'renewal queries must sort by expiry date');
assert.match(trustedContext, /fieldPath: "relatedType"/, 'Client 360 task query must use relatedType');
assert.match(trustedContext, /fieldPath: "relatedId"/, 'Client 360 task query must use relatedId');
assert.match(supabaseFunctionConfig, /\[functions\.copilot-chat\][\s\S]*verify_jwt = false/, 'Copilot must use explicit app-level auth for modern publishable keys');
assert.match(copilotHandler, /isAllowedSupabaseApiKey\(apiKey/, 'Copilot must validate the supplied Supabase application key');
assert.match(copilotHandler, /verifyFirebaseToken\(firebaseToken\)/, 'Copilot must still verify the caller Firebase ID token');
assert.match(copilotHandler, /authorizeCopilotWorkspace\(/, 'Copilot must still enforce verified organization membership');
assert.match(supabaseApiKeyAuth, /SUPABASE_PUBLISHABLE_KEYS|publishableKeysJson/, 'Copilot must support modern publishable API key config');
assert.match(selector, /"lead-details"/, 'Lead 360 must be an allow-listed browser context page');
assert.match(selector, /return \{ page, lead: \{ id: leadId \} \}/, 'Lead 360 may forward only a validated lead ID');
assert.match(leadDetailsPage, /lead: \{ id: lead\.id \}/, 'LeadDetailsPage must provide the selected lead ID');
assert.match(trustedContext, /async function getLeadSelector\(/, 'server must fetch lead data by ID instead of trusting browser values');
assert.match(trustedContext, /page === "lead-details"/, 'server must implement a dedicated Lead 360 context path');
assert.match(trustedContext, /"estimatedValue"/, 'Lead 360 server projection must include the permitted estimate field');

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
