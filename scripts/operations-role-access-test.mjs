import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getOperationsRoleAccess } from '../src/features/operations/operations-access.policy.js';

const expected = {
  owner: { operations: true, clientRecords: true, rfqWorkspace: true, clientOnboarding: true, emails: true },
  admin: { operations: true, clientRecords: true, rfqWorkspace: true, clientOnboarding: true, emails: true },
  broker: { operations: true, clientRecords: true, rfqWorkspace: true, clientOnboarding: true, emails: true },
  claims: { operations: true, clientRecords: false, rfqWorkspace: false, clientOnboarding: false, emails: true },
  sales: { operations: false, clientRecords: false, rfqWorkspace: false, clientOnboarding: false, emails: false },
  finance: { operations: false, clientRecords: false, rfqWorkspace: false, clientOnboarding: false, emails: false },
  staff: { operations: false, clientRecords: false, rfqWorkspace: false, clientOnboarding: false, emails: false },
};
for (const [role, access] of Object.entries(expected)) {
  assert.deepEqual(getOperationsRoleAccess(role), access, role + ' operations access matches Firestore RBAC');
}
for (const role of [undefined, null, '', 'platform_admin', 'unknown']) {
  assert.deepEqual(
    getOperationsRoleAccess(role),
    { operations: false, clientRecords: false, rfqWorkspace: false, clientOnboarding: false, emails: false },
    'unknown and platform roles fail closed',
  );
}

const [page, rules, documents, operationsService] = await Promise.all([
  readFile(new URL('../src/pages/OperationsPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/documents/document.service.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/operations/operations.service.ts', import.meta.url), 'utf8'),
]);

assert.match(page, /getOperationsRoleAccess\(profile\?\.role\)/);
assert.match(page, /access\.clientRecords\s*\?\s*listClients/);
assert.match(page, /access\.rfqWorkspace\s*\?\s*listOrganizationRfqs/);
assert.match(page, /listDocuments\(profile\.organizationId\)/);
assert.match(page, /operationsAccess\.clientRecords/);
assert.match(page, /operationsAccess\.rfqWorkspace && view === 'new-business'/);
assert.match(page, /operationsAccess\.clientOnboarding && showRequest/);
assert.match(page, /غير مسموح بفتح مركز العمليات/);
assert.doesNotMatch(
  operationsService,
  /q\('claims'|collection\(db,\s*['"]claims['"]\)/,
  'Operations Center must not preload claim records that its page does not render',
);
assert.match(documents, /role === 'claims' \? \[where\('category', '==', 'claim'\)\]/);

const clientRoles = rules.match(/function canReadBusinessCollection\(collection, data\)\s*\{([\s\S]*?)\n    \}/)?.[1];
assert.ok(clientRoles);
assert.match(clientRoles, /collection == 'clients' && roleIs\(\['owner','admin','broker'\]\)/);
assert.match(clientRoles, /collection in \['operations','operationEvents','operationAttachments','operationsEmailDirectory'\] && roleIs\(\['owner','admin','broker','claims'\]\)/);
assert.match(clientRoles, /collection in \['leads','leadActivities','rfqs','quotes'\] && roleIs\(\['owner','admin','broker','sales'\]\)/);
assert.match(clientRoles, /collection == 'documents' && \(roleIs\(\['owner','admin','broker'\]\) \|\| \(roleIs\(\['claims'\]\) && data\.category == 'claim'\)\)/);

console.log('Operations role-scoped data and UI regression tests passed.');
