import assert from 'node:assert/strict';
import {
  buildClientSensitiveDataSeparationPlan,
} from './client-sensitive-data-separation-plan.mjs';

const report = {
  schemaVersion: 1,
  projectId: 'demo-insurnex',
  generatedAt: '2026-10-29T10:00:00.000Z',
  sourceCollection: 'clients',
  mode: 'read-only-sensitive-field-inventory',
  noCloudChangesMade: true,
  rawFieldValuesIncluded: false,
  summary: {
    clientRecordsScanned: 2,
    recordsWithSensitiveOrPrivateFields: 2,
    fieldPathsFound: 20,
    recordsByCategory: {},
    pathPresenceCounts: {},
  },
  scan: { maxRecords: 100, recordsReturned: 2, potentiallyIncomplete: false },
  // This unknown property deliberately contains a sentinel. The planner must
  // consume only the documented fields and must not propagate arbitrary values.
  hiddenFixtureValue: 'SENSITIVE_SENTINEL_MUST_NOT_ESCAPE',
  records: [
    {
      documentId: 'synthetic-client-1',
      organizationId: 'synthetic-org-1',
      fieldPaths: [
        'name',
        'phone',
        'nationalId',
        'individual',
        'individual.fullName',
        'individual.monthlyIncome',
        'riskData',
        'riskData.health',
        'riskData.health.medications',
        'riskAssessment',
        'riskAssessment.score',
        'aiAnalysis',
        'aiAnalysis.summary',
        'documents',
        'documents[].url',
        'notes',
        'futureUnknownField',
      ],
      pathCategories: {
        name: ['basic_contact'],
        phone: ['basic_contact'],
        nationalId: ['identity'],
        individual: ['identity_profile'],
        'individual.fullName': ['basic_contact', 'identity_profile'],
        'individual.monthlyIncome': ['financial', 'identity_profile'],
        riskData: ['risk_profile'],
        'riskData.health': ['health', 'risk_profile'],
        'riskData.health.medications': ['health', 'risk_profile'],
        riskAssessment: ['derived_assessment'],
        'riskAssessment.score': ['derived_assessment'],
        aiAnalysis: ['derived_analysis'],
        'aiAnalysis.summary': ['derived_analysis'],
        documents: ['document_references'],
        'documents[].url': ['document_references'],
        notes: ['freeform_notes'],
        futureUnknownField: [],
      },
    },
    {
      documentId: 'synthetic-client-2',
      organizationId: 'synthetic-org-1',
      fieldPaths: ['companyName', 'corporate', 'corporate.taxId'],
      pathCategories: {
        companyName: ['basic_contact'],
        corporate: ['corporate_profile'],
        'corporate.taxId': ['identity', 'corporate_profile'],
      },
    },
  ],
};

const plan = buildClientSensitiveDataSeparationPlan({
  inventoryReport: report,
  generatedAt: '2026-10-29T10:01:00.000Z',
});
assert.equal(plan.mode, 'proposal-only-client-sensitive-data-separation-plan');
assert.equal(plan.noCloudChangesMade, true);
assert.equal(plan.noMigrationExecuted, true);
assert.equal(plan.rawFieldValuesIncluded, false);
assert.equal(plan.humanApprovalRequired, true);
assert.equal(plan.sourceInventoryPotentiallyIncomplete, false);
assert.equal(plan.sourceRecordsScanned, 2);

const record1 = plan.records.find(record => record.documentId === 'synthetic-client-1');
assert.ok(record1);
const byPath = Object.fromEntries(record1.fieldPlans.map(field => [field.sourceFieldPath, field]));

assert.equal(byPath.name.action, 'retain_in_base_candidate');
assert.equal(byPath.name.destinationCollection, 'clients');
assert.equal(byPath.nationalId.destinationCollection, 'clientSensitiveProfiles');
assert.equal(byPath['individual'].action, 'split_parent_before_migration');
assert.equal(byPath['individual.fullName'].destinationCollection, 'clientSensitiveProfiles');
assert.equal(byPath['individual.monthlyIncome'].sensitivityClass, 'financial');
assert.equal(byPath['riskData'].action, 'split_parent_before_migration');
assert.equal(byPath['riskData.health'].action, 'split_parent_before_migration');
assert.equal(byPath['riskData.health.medications'].destinationCollection, 'clientMedicalProfiles');
assert.equal(byPath['riskData.health.medications'].sensitivityClass, 'health');
assert.equal(byPath['riskAssessment'].action, 'split_parent_before_migration');
assert.equal(byPath['riskAssessment.score'].destinationCollection, 'aiFindings');
assert.equal(byPath['aiAnalysis.summary'].destinationCollection, 'aiFindings');
assert.equal(byPath['documents'].action, 'split_parent_before_migration');
assert.equal(byPath['documents[].url'].action, 'manual_review_before_linking');
assert.equal(byPath.notes.action, 'manual_classification_required');
assert.equal(byPath.futureUnknownField.action, 'manual_classification_required');
assert.ok(record1.fieldPlans.every(field => field.writesPlanned === false && field.humanApprovalRequired === true));

const serialized = JSON.stringify(plan);
assert.equal(serialized.includes('SENSITIVE_SENTINEL_MUST_NOT_ESCAPE'), false);
for (const rawKey of ['hiddenFixtureValue', 'individual.fullName']) {
  // Field paths are permitted; raw content is not. The test checks only the known
  // sentinel value above and the planner's output shape rather than banning paths.
  assert.ok(serialized.includes(rawKey) || rawKey === 'hiddenFixtureValue');
}

assert.throws(() => buildClientSensitiveDataSeparationPlan({
  inventoryReport: { ...report, rawFieldValuesIncluded: true },
}), /Safety stop/);
assert.throws(() => buildClientSensitiveDataSeparationPlan({
  inventoryReport: { ...report, mode: 'untrusted-report' },
}), /Safety stop/);
assert.throws(() => buildClientSensitiveDataSeparationPlan({
  inventoryReport: { ...report, scan: undefined },
}), /summary or scan-completeness/);
assert.throws(() => buildClientSensitiveDataSeparationPlan({
  inventoryReport: {
    ...report,
    records: [{ documentId: 'missing-fields', organizationId: 'synthetic-org-1', fieldPaths: ['name'] }],
  },
}), /field-path map/);
assert.throws(() => buildClientSensitiveDataSeparationPlan({
  inventoryReport: {
    ...report,
    records: [{ documentId: 'bad-token', organizationId: 'synthetic-org-1', fieldPaths: ['SENSITIVE SENTINEL RAW VALUE'], pathCategories: {} }],
  },
}), /invalid field-path token/);

console.log('Client sensitive-data separation planner tests passed.');
