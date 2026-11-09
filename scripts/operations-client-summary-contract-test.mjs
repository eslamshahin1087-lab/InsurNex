import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const operations = read('src/pages/OperationsPage.tsx');
const workspace = read('src/features/operations/ClientRfqOperationsWorkspace.tsx');
const summaryTypes = read('src/features/clients/client-access.policy.d.ts');

assert.match(
  operations,
  /listClientSummaries\(profile\)/,
  'OperationsPage must load the allowlisted client summary projection with the active profile',
);
assert.match(
  operations,
  /import \{ listClientSummaries, type ClientBaseSummary \} from '\.\.\/features\/clients\/client-data-access\.service'/,
  'OperationsPage must depend on the client data-access boundary',
);
assert.doesNotMatch(
  operations,
  /from ['"]\.\.\/features\/clients\/client\.service['"]/,
  'OperationsPage must not import the legacy client service',
);
assert.doesNotMatch(
  operations,
  /\blistClients\s*\(/,
  'OperationsPage must not call the deprecated full-record list reader',
);
assert.match(
  operations,
  /useState<ClientBaseSummary\[\]>\(\[\]\)/,
  'OperationsPage state must contain only ClientBaseSummary records',
);

assert.match(
  workspace,
  /import type \{ ClientBaseSummary \} from '\.\.\/clients\/client-data-access\.service'/,
  'the RFQ operations workspace must consume the narrow client summary type',
);
assert.match(
  workspace,
  /clients: ClientBaseSummary\[\]/,
  'the RFQ operations workspace API must not accept full legacy client records',
);

const policyForm = read('src/features/policies/PolicyForm.tsx');
assert.ok(
  policyForm.includes('listClientSummaries(profile)'),
  'PolicyForm must load the allowlisted client summary projection',
);
assert.ok(
  policyForm.includes('useState<ClientBaseSummary[]>([])'),
  'PolicyForm client state must use ClientBaseSummary',
);
assert.equal(
  policyForm.includes("from '../clients/client.service'"),
  false,
  'PolicyForm must not import the deprecated client service',
);
assert.equal(
  policyForm.includes('listClients'),
  false,
  'PolicyForm must not call the deprecated full-record list reader',
);

const summaryInterface = summaryTypes.match(/export interface ClientBaseSummary \{([\s\S]*?)\n\}/)?.[1] || '';
assert.ok(summaryInterface, 'ClientBaseSummary type declaration must exist');
for (const sensitiveField of [
  'nationalId', 'taxId', 'individual', 'corporate', 'riskData',
  'riskAssessment', 'documents', 'aiAnalysis', 'notes', 'address',
  'preferences', 'lifetimeValue',
]) {
  assert.equal(
    new RegExp('^\\s*' + sensitiveField + '\\??\\s*:', 'm').test(summaryInterface),
    false,
    'ClientBaseSummary must not expose ' + sensitiveField,
  );
}

const sourceRoot = resolve(root, 'src');
function collectSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(absolutePath);
    return /\.tsx?$/.test(entry.name) ? [absolutePath] : [];
  });
}

const deprecatedClientReaders = new Set([
  'listClients',
  'getClient',
  'activateIssuedClientV978',
]);
const sourceFiles = collectSourceFiles(sourceRoot);
for (const sourceFile of sourceFiles) {
  const source = readFileSync(sourceFile, 'utf8');
  const legacyServiceImports = source.matchAll(
    /import\s*\{([^}]+)\}\s*from\s*['"][^'"]*client\.service['"]/gs,
  );
  for (const match of legacyServiceImports) {
    const importedNames = match[1]
      .split(',')
      .map((name) => name.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0])
      .filter(Boolean);
    for (const importedName of importedNames) {
      assert.equal(
        deprecatedClientReaders.has(importedName),
        false,
        sourceFile.replace(root + '/', '') + ' must not import deprecated full-record reader ' + importedName,
      );
    }
  }
}

assert.ok(sourceFiles.length > 0, 'legacy reader guard must inspect application source files');
console.log('Operations client summary data-access regression tests passed.');
