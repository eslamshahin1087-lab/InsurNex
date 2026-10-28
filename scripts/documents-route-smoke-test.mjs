import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const appPath = resolve(root, 'src/App.tsx');
const pagePath = resolve(root, 'src/pages/DocumentsPage.tsx');
const app = readFileSync(appPath, 'utf8');

assert.equal(existsSync(pagePath), true, 'DocumentsPage implementation must exist');
assert.match(
  app,
  /const DocumentsPage = lazy\(\(\) => import\('\.\/pages\/DocumentsPage'\)\);/,
  'DocumentsPage must be lazy-loaded by the application router',
);
assert.match(
  app,
  /<Route element=\{<PlatformFeatureGate feature="documents" \/>\}>\s*<Route path="documents" element=\{<DocumentsPage \/>\} \/>\s*<\/Route>/,
  '/documents must resolve to DocumentsPage inside the existing documents feature gate',
);
assert.doesNotMatch(
  app,
  /<Route path="documents" element=\{<ComingSoonPage \/>\} \/>/,
  '/documents must not regress to the ComingSoonPage placeholder',
);

console.log('Documents route smoke checks passed.');
