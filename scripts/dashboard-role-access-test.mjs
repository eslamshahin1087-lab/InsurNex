import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getDashboardRoleAccess } from '../src/features/dashboard/dashboard-access.policy.js';

const expected = {
  owner: { clients: true, policies: true, claims: true },
  admin: { clients: true, policies: true, claims: true },
  broker: { clients: true, policies: true, claims: true },
  claims: { clients: false, policies: true, claims: true },
  sales: { clients: false, policies: false, claims: false },
  finance: { clients: false, policies: false, claims: false },
  staff: { clients: false, policies: false, claims: false },
};
for (const [role, permissions] of Object.entries(expected)) {
  assert.deepEqual(getDashboardRoleAccess(role), permissions, role + ' dashboard collection access matches Firestore RBAC');
}
for (const role of [undefined, null, '', 'platform_admin', 'unknown']) {
  assert.deepEqual(
    getDashboardRoleAccess(role),
    { clients: false, policies: false, claims: false },
    'unrecognized roles fail closed',
  );
}

const [dashboard, notifications, page, rules] = await Promise.all([
  readFile(new URL('../src/features/dashboard/dashboard.service.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/features/notifications/notification.service.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/pages/DashboardPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
]);

assert.match(dashboard, /getDashboardRoleAccess\(role\)/);
assert.match(dashboard, /access\.clients\s*\?\s*getCountFromServer/);
assert.match(dashboard, /access\.policies\s*\?\s*getCountFromServer/);
assert.match(dashboard, /access\.claims\s*\?\s*getDocs/);
assert.match(dashboard, /access\.policies\s*\?\s*listRenewals/);
assert.match(dashboard, /buildNotifications\(organizationId, role\)/);

assert.match(notifications, /access\.claims\s*\?\s*getDocs/);
assert.match(notifications, /access\.policies\s*\?\s*listRenewals/);
assert.match(notifications, /getDashboardRoleAccess\(role\)/);

assert.match(page, /loadDashboard\(profile\.organizationId, profile\.role\)/);
assert.match(page, /getDashboardRoleAccess\(profile\?\.role\)/);
assert.match(page, /item\.feature === 'clients'/);
assert.match(page, /item\.feature === 'policies' \|\| item\.feature === 'renewals'/);
assert.match(page, /data\.clients !== null && data\.activePolicies !== null/);
assert.match(page, /data\.clients !== null/);
assert.match(page, /data\.activePolicies !== null/);
assert.match(page, /data\.openClaims !== null/);
assert.match(page, /غير متاح حسب صلاحية الدور/);

// The application role map must not be implemented by widening Firestore Rules.
const clientBlock = rules.match(/match \/clients\/\{clientId\} \{([\s\S]*?)\n    \}/)?.[1];
assert.ok(clientBlock);
assert.match(clientBlock, /roleIs\(\['owner','admin','broker'\]\)/);
assert.doesNotMatch(clientBlock, /'sales'|'claims'|'finance'|'staff'/);

console.log('Dashboard RBAC policy and role-scoped query contract tests passed.');
