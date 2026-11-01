import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leadTypes = readFileSync(new URL('../src/types/lead.ts', import.meta.url), 'utf8');
const leadDetails = readFileSync(new URL('../src/pages/LeadDetailsPage.tsx', import.meta.url), 'utf8');
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const integration = readFileSync(new URL('../docs/INEX_APP_INTEGRATION_V1.md', import.meta.url), 'utf8');

for (const field of [
  'sourceSystem?: string',
  'sourceExternalId?: string',
  'sourceSchemaVersion?: number',
  'consentToContact?: boolean',
  'consentCapturedAt?: unknown',
  'consentNoticeVersion?: string',
]) {
  assert.ok(leadTypes.includes(field), `Missing Lead source metadata field: ${field}`);
}

assert.ok(leadDetails.includes("lead.sourceSystem === 'iNex-App'"));
assert.ok(leadDetails.includes('iNex · وارد من التطبيق'));

for (const collection of ['leads', 'leadActivities', 'tasks', 'notifications']) {
  assert.ok(rules.includes(`'${collection}'`), `Firestore Rules do not list ${collection}`);
  assert.ok(integration.includes(`\x60${collection}\x60`), `Integration contract omits ${collection}`);
}

for (const safetyGate of [
  'crmLeadSyncConsent === true',
  'crmLeadSyncConsentAt',
  'crmLeadSyncConsentNoticeVersion',
  'national IDs',
  'uploaded files',
  'currentDocument.exists === false',
  'pending live verification',
  'No deployment or production test',
]) {
  assert.ok(integration.toLowerCase().includes(safetyGate.toLowerCase()), `Missing integration safety gate: ${safetyGate}`);
}

assert.ok(integration.includes('fDGjCCaVCGXbPoH18sMI7DRbpQI2'));
assert.ok(integration.includes('leads@insurnex.com'));
assert.ok(integration.includes('insurnex-8a9df'));

console.log('InsurNex iNex lead lifecycle contract: PASS');
