import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditClientDataAccessSymbols } from './client-data-access-symbol-audit.mjs';

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
  await writeFile(consumerPath, `import { listLegacyClients as loadClients } from '../features/clients';\nimport * as legacy from '../features/clients/client.service';\nexport async function read() { loadClients(); legacy.getClient(); return getDocs(collection(db, 'clients')); }\nexport async function loadAtRuntime() { return import('../features/clients/client.service'); }\n`);

  const report = auditClientDataAccessSymbols([servicePath, barrelPath, consumerPath], root);
  assert.equal(report.mode, 'typescript-symbol-client-data-access-audit');
  assert.deepEqual(report.legacyApiCallSites.map(x => x.api).sort(), ['getClient', 'listClients']);
  assert.equal(report.legacyApiImports.length, 1);
  assert.deepEqual(report.clientCollectionCallSites, [{ path: 'src/pages/ClientsPage.tsx', line: 3, operation: 'collection' }]);
  assert.deepEqual(report.dynamicClientServiceImports, [{ path: 'src/pages/ClientsPage.tsx', line: 4 }]);
  assert.ok(report.limitations.length >= 3);
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log('Client data-access TypeScript symbol audit tests passed.');
