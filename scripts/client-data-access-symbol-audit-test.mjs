import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  auditClientDataAccessSymbols,
  collectClientDataSourceFiles,
} from './client-data-access-symbol-audit.mjs';

// This records the manually reviewed literal Firestore clients collection call
// sites. It detects additions/removals that need review; it grants no access.
const REVIEWED_CLIENT_COLLECTION_CALLS = [
  ['clients', 'functions/src/copilot/context-builder.ts', 'collection', 1],
  ['clients', 'src/features/clients/client-data-access.service.ts', 'collection', 1],
  ['clients', 'src/features/clients/client-data-access.service.ts', 'doc', 1],
  ['clients', 'src/features/clients/client-edit.service.ts', 'doc', 1],
  ['clients', 'src/features/clients/client.service.ts', 'collection', 4],
  ['clients', 'src/features/clients/client.service.ts', 'doc', 3],
  ['clients', 'src/features/clients/timeline.service.ts', 'collection', 2],
  ['clients', 'src/features/dashboard/dashboard.service.ts', 'collection', 1],
  ['clients', 'src/features/documents/legacy-client-documents.service.ts', 'doc', 1],
  ['clients', 'src/features/leads/lead.service.ts', 'collection', 2],
  ['clients', 'src/features/leads/lead.service.ts', 'doc', 1],
  ['clients', 'src/features/operations/operations-v80-foundation.service.ts', 'doc', 1],
  ['clients', 'src/features/policies/policy-lifecycle.service.ts', 'collection', 1],
  ['clients', 'src/features/quotes/quote.service.ts', 'collection', 2],
  ['clients', 'src/features/quotes/quote.service.ts', 'doc', 1],
  ['clients', 'src/features/rfq/rfq.service.ts', 'collection', 2],
  ['clients', 'src/features/rfq/rfq.service.ts', 'doc', 1],
];

const root = await mkdtemp(join(tmpdir(), 'insurnex-client-symbol-audit-'));
try {
  const clientDir = join(root, 'src/features/clients');
  const consumerDir = join(root, 'src/pages');
  await mkdir(clientDir, { recursive: true });
  await mkdir(consumerDir, { recursive: true });
  const servicePath = join(clientDir, 'client.service.ts');
  const barrelPath = join(clientDir, 'index.ts');
  const consumerPath = join(consumerDir, 'ClientsPage.tsx');
  await writeFile(servicePath, `export function listClients() { return []; }\nexport function getClient() { return null; }\nexport function activateIssuedClientV978() { return false; }\n`);
  await writeFile(barrelPath, `export { listClients as listLegacyClients } from './client.service';\n`);
  await writeFile(consumerPath, `import { listLegacyClients as loadClients } from '../features/clients';\nimport * as legacy from '../features/clients/client.service';\nexport async function read() { loadClients(); legacy.getClient(); return getDocs(collection(db, 'clients')); }\nexport async function readSummary() { return getDocs(collection(db, 'clientSummaries')); }\nexport async function loadAtRuntime() { return import('../features/clients/client.service'); }\n`);

  const report = auditClientDataAccessSymbols([servicePath, barrelPath, consumerPath], root);
  assert.equal(report.mode, 'typescript-symbol-client-data-access-audit');
  assert.deepEqual(report.legacyApiCallSites.map(x => x.api).sort(), ['getClient', 'listClients']);
  assert.equal(report.legacyApiImports.length, 1);
  assert.deepEqual(report.clientCollectionCallSites, [
    { path: 'src/pages/ClientsPage.tsx', line: 3, collectionName: 'clients', operation: 'collection' },
    { path: 'src/pages/ClientsPage.tsx', line: 4, collectionName: 'clientSummaries', operation: 'collection' },
  ]);
  assert.deepEqual(report.dynamicClientServiceImports, [{ path: 'src/pages/ClientsPage.tsx', line: 5 }]);
  assert.ok(report.limitations.length >= 3);
} finally {
  await rm(root, { recursive: true, force: true });
}

const repositoryRoot = process.cwd();
const sourceFiles = await collectClientDataSourceFiles(repositoryRoot);
const repositoryReport = auditClientDataAccessSymbols(sourceFiles, repositoryRoot);
const actualClientCollectionCalls = Object.entries(
  repositoryReport.clientCollectionCallSites.reduce((counts, call) => {
    const key = `${call.collectionName}\u0000${call.path}\u0000${call.operation}`;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {}),
).map(([key, count]) => {
  const [collectionName, path, operation] = key.split('\u0000');
  return [collectionName, path, operation, count];
}).sort((left, right) => left[0].localeCompare(right[0]) || left[1].localeCompare(right[1]) || left[2].localeCompare(right[2]));
assert.deepEqual(
  actualClientCollectionCalls,
  REVIEWED_CLIENT_COLLECTION_CALLS,
  'literal Firestore clients call sites changed; manually review and update the baseline before merging',
);
console.log('Client data-access TypeScript symbol audit tests passed.');

