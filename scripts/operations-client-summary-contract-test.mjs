import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

console.log('Operations client summary data-access regression tests passed.');
