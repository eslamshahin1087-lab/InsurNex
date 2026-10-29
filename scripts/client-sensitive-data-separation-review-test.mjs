import assert from 'node:assert/strict';
import { buildClientSensitiveDataSeparationPlan } from './client-sensitive-data-separation-plan.mjs';
import { reviewClientSensitiveDataSeparationPlan } from './client-sensitive-data-separation-review.mjs';

const inventory = {
  schemaVersion: 1,
  projectId: 'demo-insurnex',
  generatedAt: '2026-10-29T12:00:00.000Z',
  sourceCollection: 'clients',
  mode: 'read-only-sensitive-field-inventory',
  noCloudChangesMade: true,
  rawFieldValuesIncluded: false,
  summary: {
    clientRecordsScanned: 1,
    recordsWithSensitiveOrPrivateFields: 1,
    fieldPathsFound: 9,
    recordsByCategory: {},
    pathPresenceCounts: {},
  },
  scan: { maxRecords: 100, recordsReturned: 1, potentiallyIncomplete: false },
  records: [{
    documentId: 'synthetic-client',
    organizationId: 'synthetic-org',
    fieldPaths: [
      'name',
      'riskData',
      'riskData.life',
      'riskData.life.healthStatus',
      'riskData.life.dependents',
      'riskData.life.annualSalary',
      'documents',
      'documents[].url',
      'unknownFutureField',
    ],
    pathCategories: {
      name: ['basic_contact'],
      riskData: ['risk_profile'],
      'riskData.life': ['risk_profile'],
      'riskData.life.healthStatus': ['risk_profile'],
      'riskData.life.dependents': ['risk_profile'],
      'riskData.life.annualSalary': ['financial', 'risk_profile'],
      documents: ['document_references'],
      'documents[].url': ['document_references'],
      unknownFutureField: [],
    },
  }],
};

const validPlan = buildClientSensitiveDataSeparationPlan({
  inventoryReport: inventory,
  generatedAt: '2026-10-29T12:01:00.000Z',
});
const good = reviewClientSensitiveDataSeparationPlan({ plan: validPlan });
assert.equal(good.status, 'review_only');
assert.deepEqual(good.violations, []);
assert.equal(good.metrics.safeToMigrate, false);
assert.equal(good.metrics.recordsReviewed, 1);
assert.ok(good.metrics.manualReviewPaths >= 1);
assert.ok(good.metrics.compositeParentsToSplit >= 1);
assert.equal(good.metrics.bySensitivityClass.health, 1);
assert.equal(good.metrics.bySensitivityClass.family, 1);
assert.equal(good.metrics.bySensitivityClass.financial, 1);

const medicalWrong = structuredClone(validPlan);
const medical = medicalWrong.records[0].fieldPlans.find(f => f.sourceFieldPath === 'riskData.life.healthStatus');
medical.destinationCollection = 'clientSensitiveProfiles';
medical.sensitivityClass = 'risk_profile';
const badMedical = reviewClientSensitiveDataSeparationPlan({ plan: medicalWrong });
assert.equal(badMedical.status, 'blocked');
assert.ok(badMedical.violations.includes('health_path_not_classified_as_health'));
assert.ok(badMedical.violations.includes('destination_class_mismatch'));

const extraRawField = structuredClone(validPlan);
extraRawField.records[0].fieldPlans[0].rawValue = 'RAW_SENSITIVE_SENTINEL';
const badShape = reviewClientSensitiveDataSeparationPlan({ plan: extraRawField });
assert.equal(badShape.status, 'blocked');
assert.ok(badShape.violations.includes('invalid_field_plan_shape_or_path'));
assert.equal(JSON.stringify(badShape).includes('RAW_SENSITIVE_SENTINEL'), false);

const writesEnabled = structuredClone(validPlan);
writesEnabled.records[0].fieldPlans[0].writesPlanned = true;
const badWrite = reviewClientSensitiveDataSeparationPlan({ plan: writesEnabled });
assert.equal(badWrite.status, 'blocked');
assert.ok(badWrite.violations.includes('field_write_path_not_disabled'));

const incomplete = structuredClone(validPlan);
incomplete.sourceInventoryPotentiallyIncomplete = true;
const badIncomplete = reviewClientSensitiveDataSeparationPlan({ plan: incomplete });
assert.equal(badIncomplete.status, 'blocked');
assert.ok(badIncomplete.violations.includes('source_inventory_incomplete'));

const extraTopLevel = structuredClone(validPlan);
extraTopLevel.rawCustomerRecord = { nationalId: 'RAW_SENSITIVE_SENTINEL' };
const topShape = reviewClientSensitiveDataSeparationPlan({ plan: extraTopLevel });
assert.equal(topShape.status, 'blocked');
assert.ok(topShape.violations.includes('invalid_plan_shape_or_unexpected_fields'));
assert.equal(JSON.stringify(topShape).includes('RAW_SENSITIVE_SENTINEL'), false);

console.log('Client sensitive-data separation review tests passed.');
