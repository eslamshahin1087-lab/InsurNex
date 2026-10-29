import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const selector = read('src/features/copilot/copilot-context-selector.ts');
const fullCopilotPage = read('src/pages/CopilotPage.tsx');
const fullPageScope = read('src/features/copilot/copilot-page-session.ts');
const policyDetailsPage = read('src/pages/PolicyDetailsPage.tsx');
const claimDetailsPage = read('src/pages/ClaimDetailsPage.tsx');
const leadDetailsPage = read('src/pages/LeadDetailsPage.tsx');
const trustedContext = read('supabase/functions/copilot-chat/trusted-context.ts');
const sanitizer = read('supabase/functions/copilot-chat/context-sanitizer.ts');
const copilotHandler = read('supabase/functions/copilot-chat/index.ts');
const supabaseApiKeyAuth = read('supabase/functions/copilot-chat/api-key-authorization.ts');
const supabaseFunctionConfig = read('supabase/config.toml');
const indexText = read('firestore.indexes.json').replace(/^\uFEFF/, '');
const config = JSON.parse(indexText);

assert.match(selector, /"renewals"/, 'browser selector must preserve the renewal page');
assert.match(fullCopilotPage, /getCopilotPageSessionKey\\(user\\?\\.uid, scope, incomingContext\\)/, 'full Copilot must scope its conversation by identity, workspace, and record');
assert.match(fullCopilotPage, /requestSequence !== responseSequenceRef\\.current/, 'full Copilot must reject stale async responses');
assert.match(fullCopilotPage, /setConversations\\(\\[\\]\\)[\\s\\S]*?setMessages\\(\\[\\]\\)/, 'identity or context changes must clear visible prior session data');
assert.match(fullPageScope, /buildCopilotContextSelector\\(context\\)/, 'session keys must be generated from the minimized selector');
assert.match(trustedContext, /renewals: \["policies"\]/, 'server context builder must map renewals to policy records');
assert.match(trustedContext, /const MAX_RENEWAL_POLICIES = 300/, 'renewal queries must use a bounded 300-policy sample');
assert.match(trustedContext, /page === "renewals" && collectionId === "policies"\s*\?\s*\{\}/, 'renewal query must not let oldest expiry dates crowd out actionable records');
assert.match(trustedContext, /item\.daysLeft >= -90 &&\s*item\.daysLeft <= 90/, 'renewal context must be limited to the actionable 90-day past/future window');
assert.match(trustedContext, /Math\.abs\(left\.daysLeft!\)/, 'renewal context must prioritize dates closest to action');
assert.match(copilotHandler, /Renewal watchlist: overdue within 90 days and upcoming within 90 days/, 'Copilot prompt must describe the bounded renewal window accurately');
assert.match(trustedContext, /fieldPath: "relatedType"/, 'Client 360 task query must use relatedType');
assert.match(trustedContext, /fieldPath: "relatedId"/, 'Client 360 task query must use relatedId');
assert.match(selector, /"lead-details"/, 'Lead 360 must be an allow-listed browser context page');
assert.match(selector, /return \{ page, lead: \{ id: leadId \} \}/, 'Lead 360 may forward only a validated lead ID');
assert.match(leadDetailsPage, /lead: \{ id: lead\.id \}/, 'LeadDetailsPage must provide the selected lead ID');
assert.match(trustedContext, /async function getLeadSelector\(/, 'server must fetch lead data by ID instead of trusting browser values');
assert.match(trustedContext, /page === "lead-details"/, 'server must implement a dedicated Lead 360 context path');
assert.match(trustedContext, /"estimatedValue"/, 'Lead 360 server projection must include the permitted estimate field');
assert.match(selector, /"policy-details"/, 'Policy 360 must be an allow-listed page');
assert.match(selector, /"claim-details"/, 'Claim 360 must be an allow-listed page');
assert.match(selector, /return \{ page, policyRef: \{ id: policyId \} \}/, 'Policy 360 may forward only a validated policy ID');
assert.match(selector, /return \{ page, claimRef: \{ id: claimId \} \}/, 'Claim 360 may forward only a validated claim ID');
assert.match(policyDetailsPage, /page: 'policy-details', policyRef: id \? \{ id \} : undefined/, 'PolicyDetailsPage must provide only its selected policy ID');
assert.match(claimDetailsPage, /page:'claim-details',claimRef:id\?\{id\}:undefined/, 'ClaimDetailsPage must provide only its selected claim ID');
assert.match(trustedContext, /async function getScopedDetailSelector\(/, 'Policy/Claim 360 must read records from Firestore on the server');
assert.match(trustedContext, /collectionName: isPolicy \? "policies" : "claims"/, 'Policy/Claim lookup must use fixed collection names');
assert.match(trustedContext, /if \(data\.organizationId !== input\.organizationId\) return undefined;/, 'Policy/Claim detail must verify tenant scope');
assert.match(sanitizer, /claim\?: SafeContextRecord/, 'Claim 360 output must pass through the sanitizer');
assert.match(copilotHandler, /Claim 360 context/, 'Copilot system prompt must render the safe Claim 360 summary');
assert.match(supabaseFunctionConfig, /\[functions\.copilot-chat\][\s\S]*verify_jwt = false/, 'Copilot must use explicit app-level auth for modern publishable keys');
assert.match(copilotHandler, /isAllowedSupabaseApiKey\(apiKey/, 'Copilot must validate the supplied Supabase application key');
assert.match(copilotHandler, /verifyFirebaseToken\(firebaseToken\)/, 'Copilot must still verify the caller Firebase ID token');
assert.match(copilotHandler, /authorizeCopilotWorkspace\(/, 'Copilot must still enforce verified organization membership');
assert.match(supabaseApiKeyAuth, /SUPABASE_PUBLISHABLE_KEYS|publishableKeysJson/, 'Copilot must support modern publishable API key config');


const hasIndex = (collectionGroup, fields) => config.indexes.some((index) =>
  index.collectionGroup === collectionGroup &&
  fields.every((required) => index.fields.some((field) =>
    field.fieldPath === required.fieldPath && field.order === required.order)));

const requiredIndexes = [
  ['policies', [{ fieldPath: 'organizationId', order: 'ASCENDING' }, { fieldPath: 'clientId', order: 'ASCENDING' }, { fieldPath: 'createdAt', order: 'DESCENDING' }]],
  ['claims', [{ fieldPath: 'organizationId', order: 'ASCENDING' }, { fieldPath: 'clientId', order: 'ASCENDING' }, { fieldPath: 'createdAt', order: 'DESCENDING' }]],
  ['tasks', [{ fieldPath: 'organizationId', order: 'ASCENDING' }, { fieldPath: 'createdAt', order: 'DESCENDING' }]],
  ['tasks', [{ fieldPath: 'organizationId', order: 'ASCENDING' }, { fieldPath: 'relatedType', order: 'ASCENDING' }, { fieldPath: 'relatedId', order: 'ASCENDING' }, { fieldPath: 'createdAt', order: 'DESCENDING' }]],
];

for (const [collectionGroup, fields] of requiredIndexes) {
  assert.ok(hasIndex(collectionGroup, fields), 'missing Copilot context composite index: ' + collectionGroup + ' / ' + fields.map((field) => field.fieldPath).join(', '));
}

console.log('Copilot context contract and Firestore index checks passed.');
