import assert from 'node:assert/strict';
import {
  buildClientSensitiveDataInventory,
  inspectClientSensitiveFieldPresence,
} from './client-sensitive-data-inventory-policy.mjs';

const fixtures = [
  {
    id: 'client_a',
    data: {
      organizationId: 'org_a',
      name: 'SENSITIVE_SENTINEL_CLIENT_NAME',
      phone: 'SENSITIVE_SENTINEL_PHONE',
      email: 'SENSITIVE_SENTINEL_EMAIL@example.test',
      nationalId: 'SENSITIVE_SENTINEL_NATIONAL_ID',
      individual: {
        fullName: 'SENSITIVE_SENTINEL_INDIVIDUAL',
        nationalId: 'SENSITIVE_SENTINEL_INDIVIDUAL_NID',
        dateOfBirth: '1980-01-01',
        maritalStatus: 'married',
        occupation: 'SENSITIVE_SENTINEL_OCCUPATION',
        monthlyIncome: 123456,
      },
      riskData: {
        health: {
          chronicConditions: ['SENSITIVE_SENTINEL_CONDITION'],
          medications: 'SENSITIVE_SENTINEL_MEDICATION',
          surgeries: 'SENSITIVE_SENTINEL_SURGERY',
          smoker: false,
        },
        motor: { vehicleMake: 'Test', estimatedValue: 450000 },
      },
      riskAssessment: {
        score: 77,
        factors: [{ name: 'SENSITIVE_SENTINEL_FACTOR', severity: 'high' }],
      },
      aiAnalysis: { summary: 'SENSITIVE_SENTINEL_AI_SUMMARY' },
      documents: [{
        id: 'doc_a',
        url: 'https://project.supabase.co/storage/v1/object/sign/private/id.pdf?token=SENSITIVE_SENTINEL_TOKEN',
        fileName: 'SENSITIVE_SENTINEL_FILENAME.pdf',
        storagePath: 'SENSITIVE_SENTINEL_STORAGE_PATH',
      }],
      notes: 'SENSITIVE_SENTINEL_FREEFORM_NOTE',
      lifetimeValue: 1234,
    },
  },
  {
    id: 'client_b',
    data: {
      organizationId: 'org_b',
      name: 'Basic profile only',
      phone: '01000000000',
      email: 'basic@example.test',
      city: 'Cairo',
    },
  },
  {
    id: 'client_empty',
    data: { organizationId: 'org_c', name: '', documents: [], notes: null },
  },
];

const inspected = inspectClientSensitiveFieldPresence(fixtures[0].data);
assert.ok(inspected.paths.includes('individual'));
assert.ok(inspected.paths.includes('individual.nationalId'));
assert.ok(inspected.paths.includes('nationalId'));
assert.ok(inspected.paths.includes('riskData'));
assert.ok(inspected.paths.includes('riskData.health'));
assert.ok(inspected.paths.includes('riskData.health.medications'));
assert.ok(inspected.paths.includes('riskAssessment.score'));
assert.ok(inspected.paths.includes('aiAnalysis.summary'));
assert.ok(inspected.paths.includes('documents'));
assert.ok(inspected.paths.includes('documents[].url'));
assert.ok(inspected.paths.includes('notes'));
assert.ok(inspected.paths.includes('lifetimeValue'));
assert.ok(inspected.categories.includes('health'));
assert.ok(inspected.categories.includes('identity'));
assert.ok(inspected.categories.includes('document_references'));
assert.ok(inspected.categories.includes('financial'));

const report = buildClientSensitiveDataInventory({
  projectId: 'insurnex-8a9df',
  records: fixtures,
  generatedAt: '2026-10-28T10:00:00.000Z',
});
assert.equal(report.mode, 'read-only-sensitive-field-inventory');
assert.equal(report.noCloudChangesMade, true);
assert.equal(report.rawFieldValuesIncluded, false);
assert.equal(report.summary.clientRecordsScanned, 3);
assert.equal(report.summary.recordsWithSensitiveOrPrivateFields, 2);
assert.ok(report.records.some(item => item.documentId === 'client_a' && item.organizationId === 'org_a'));
assert.ok(report.records.some(item => item.documentId === 'client_b' && item.fieldPaths.includes('phone')));
assert.ok(!report.records.some(item => item.documentId === 'client_empty'));

const serialized = JSON.stringify(report);
for (const sentinel of [
  'SENSITIVE_SENTINEL_CLIENT_NAME',
  'SENSITIVE_SENTINEL_PHONE',
  'SENSITIVE_SENTINEL_EMAIL',
  'SENSITIVE_SENTINEL_NATIONAL_ID',
  'SENSITIVE_SENTINEL_INDIVIDUAL',
  'SENSITIVE_SENTINEL_CONDITION',
  'SENSITIVE_SENTINEL_MEDICATION',
  'SENSITIVE_SENTINEL_SURGERY',
  'SENSITIVE_SENTINEL_FACTOR',
  'SENSITIVE_SENTINEL_AI_SUMMARY',
  'SENSITIVE_SENTINEL_TOKEN',
  'SENSITIVE_SENTINEL_FILENAME',
  'SENSITIVE_SENTINEL_STORAGE_PATH',
  'SENSITIVE_SENTINEL_FREEFORM_NOTE',
]) {
  assert.ok(!serialized.includes(sentinel), 'report must not contain raw value: ' + sentinel);
}

const counts = report.summary.pathPresenceCounts;
assert.equal(counts['individual.nationalId'], 1);
assert.equal(counts['riskData.health.medications'], 1);
assert.equal(counts['phone'], 2);
assert.equal(counts['notes'], 1);

console.log('All client sensitive-field inventory regression tests passed.');
