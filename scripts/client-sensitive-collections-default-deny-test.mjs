import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = async (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

const rules = await read('firestore.rules');
const emulator = await read('scripts/firestore-rules-test.mjs');
const policy = await read('src/features/clients/client-access.policy.js');
const service = await read('src/features/clients/client-data-access.service.ts');
const clientsPage = await read('src/pages/ClientsPage.tsx');
const detailsPage = await read('src/pages/ClientDetailsPage.tsx');
const adapterDocs = await read('docs/P1_E_CLIENT_DATA_ACCESS_ADAPTER_2026-11-01.md');

const proposedDefaultDenyCollections = [
  'clientSensitiveProfiles',
  'clientMedicalProfiles',
  'claimSensitiveDetails',
  'aiFindings',
  'auditLogs',
];

for (const collectionName of proposedDefaultDenyCollections) {
  const explicitMatch = new RegExp('match\\s+/' + collectionName + '/\\{');
  assert.doesNotMatch(
    rules,
    explicitMatch,
    collectionName + ' must remain default-denied until a separate reviewed Rules PR',
  );
  assert.ok(
    emulator.includes("'" + collectionName + "'"),
    'Firestore Emulator regression must exercise ' + collectionName,
  );
}

assert.match(
  emulator,
  /for \(const collectionName of defaultDenyCollections\) \{\s*for \(const roleActor of sensitiveCollectionActors\)/,
  'the Emulator must exercise every proposed sensitive collection against every role actor',
);
for (const role of ['owner', 'admin', 'broker', 'sales', 'claims', 'finance', 'staff']) {
  assert.ok(emulator.includes("label: '" + role + "'"), 'Emulator denial matrix must include ' + role);
}

assert.match(rules, /match \/clients\/\{clientId\}/);
const clientsBlock = rules.match(/match \/clients\/\{clientId\} \{([\s\S]*?)\n    \}/)?.[1];
assert.ok(clientsBlock, 'legacy client collection rule block must exist');
assert.match(
  clientsBlock,
  /allow read: if[\s\S]*?roleIs\(\['owner','admin','broker'\]\)/,
  'legacy mixed-sensitivity Client 360 reads must remain limited to Owner/Admin/Broker',
);
assert.match(
  clientsBlock,
  /allow create: if[\s\S]*?roleIs\(\['owner','admin','broker'\]\)/,
  'legacy client creation must not be widened to unsupported roles',
);
assert.match(
  policy,
  /LEGACY_CLIENT_READ_ROLES = Object\.freeze\(\['owner', 'admin', 'broker'\]\)/,
  'client-side preflight must mirror the current legacy Rules boundary',
);

assert.match(service, /export async function listClientSummaries/);
assert.match(service, /projectClientBaseSummary\(item\.id, item\.data\(\), scope\)/);
assert.match(service, /export async function getLegacyClientWorkspace/);
assert.match(service, /projectLegacyClientWorkspace\(snapshot\.id, legacyRecord, scope\)/);
assert.match(clientsPage, /listClientSummaries\(profile\)/);
assert.match(detailsPage, /getLegacyClientWorkspace\(profile, id\)/);

for (const collectionName of proposedDefaultDenyCollections) {
  assert.equal(
    new RegExp("collection\\(db,\\s*['\"]" + collectionName + "['\"]\\)").test(service),
    false,
    'the compatibility adapter must not start reading ' + collectionName,
  );
}

assert.match(adapterDocs, /not field-level authorization/i);
assert.match(adapterDocs, /does not migrate, redact, rewrite, delete or export customer data/i);
assert.match(adapterDocs, /Sales, Claims, Finance and Staff do not have direct read access/i);

console.log('Client data separation guard passed: sensitive collections remain default-denied and legacy Client 360 RBAC is unchanged.');
