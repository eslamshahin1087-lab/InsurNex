import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [page, rules] = await Promise.all([
  readFile(new URL('../src/pages/AdminUserDetailsPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
]);

assert.doesNotMatch(
  page,
  /getCountFromServer\s*\(/,
  'Platform Admin user details must not aggregate tenant business collections directly',
);
assert.match(page, /clients:\s*number\s*\|\s*null/);
assert.match(page, /policies:\s*number\s*\|\s*null/);
assert.match(page, /claims:\s*number\s*\|\s*null/);
assert.match(page, /leads:\s*number\s*\|\s*null/);
assert.match(page, /counts\.clients\s*\?\?\s*'—'/);
assert.match(page, /counts\.policies\s*\?\?\s*'—'/);
assert.match(page, /counts\.claims\s*\?\?\s*'—'/);
assert.match(page, /counts\.leads\s*\?\?\s*'—'/);
assert.match(page, /إحصاءات النشاط التفصيلية غير متاحة من لوحة Platform Admin/);

// The Platform Admin UI must not be given a new Firestore bypass.
// The generic tenant rule excludes clients and still requires a same-org tenant role.
const genericRule = rules.match(/match \/\{collection\}\/\{docId\} \{([\s\S]*?)\n    \}/)?.[1];
assert.ok(genericRule);
assert.match(genericRule, /collection != 'clients'/);
assert.match(genericRule, /sameOrg\(resource\.data\.organizationId\)/);
assert.match(rules, /function canReadBusinessCollection\(collection, data\)/);
assert.match(
  rules,
  /collection == 'clients' && roleIs\(\['owner','admin','broker'\]\)/,
);

console.log('Platform Admin tenant business-data boundary tests passed.');
