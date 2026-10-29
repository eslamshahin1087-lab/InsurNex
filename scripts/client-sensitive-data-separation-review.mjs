const PLAN_KEYS = new Set([
  'schemaVersion', 'mode', 'projectId', 'generatedAt', 'sourceCollection',
  'sourceInventorySchemaVersion', 'sourceRecordsScanned',
  'sourceInventoryPotentiallyIncomplete', 'noCloudChangesMade',
  'noMigrationExecuted', 'rawFieldValuesIncluded', 'humanApprovalRequired',
  'summary', 'limitations', 'records',
]);
const RECORD_KEYS = new Set(['documentId', 'organizationId', 'fieldPlans']);
const FIELD_KEYS = new Set([
  'sourceFieldPath', 'action', 'destinationCollection', 'sensitivityClass',
  'confidence', 'reason', 'humanApprovalRequired', 'writesPlanned',
]);

const HEALTH_SEGMENTS = new Set([
  'health', 'healthstatus', 'healthinformation', 'healthdetails',
  'healthconditions', 'medical', 'medicalstatus', 'medicalhistory',
  'medicalinformation', 'medicaldetails', 'medicalcondition',
  'medicalconditions', 'medicalprofile', 'medicalreports', 'medicalclaims',
  'medicalclaim', 'medicalconsumption', 'chroniccondition',
  'chronicconditions', 'medication', 'medications', 'surgery', 'surgeries',
  'diagnosis', 'diagnoses', 'treatment', 'disability', 'disease', 'diseases',
  'preexistingconditions', 'preexistingcondition', 'smoker', 'lastcheckup',
]);
const FAMILY_SEGMENTS = new Set([
  'family', 'familydetails', 'familymembers', 'dependents', 'dependent',
  'dependentdetails', 'spouse', 'children', 'numberofdependents',
]);
const DESTINATION_BY_CLASS = {
  base_contact: 'clients',
  identity: 'clientSensitiveProfiles',
  identity_profile: 'clientSensitiveProfiles',
  corporate_profile: 'clientSensitiveProfiles',
  family: 'clientSensitiveProfiles',
  financial: 'clientSensitiveProfiles',
  risk_profile: 'clientSensitiveProfiles',
  contact_address: 'clientSensitiveProfiles',
  freeform_notes: 'clientSensitiveProfiles',
  health: 'clientMedicalProfiles',
  derived_assessment: 'aiFindings',
  derived_analysis: 'aiFindings',
  document_references: 'documents',
};
const ALLOWED_ACTIONS = new Set([
  'retain_in_base_candidate',
  'proposed_destination_requires_review',
  'manual_review_before_linking',
  'manual_classification_required',
  'split_parent_before_migration',
]);

function ownKeysAreAllowed(value, allowed) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).every(key => allowed.has(key));
}

function hasRequiredKeys(value, required) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    required.every(key => Object.prototype.hasOwnProperty.call(value, key));
}

function normalize(segment) {
  return String(segment || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function segments(path) {
  return String(path || '').replace(/\[\]/g, '').split('.').filter(Boolean).map(normalize);
}

function hasChildPath(path, allPaths) {
  return allPaths.some(candidate =>
    candidate !== path &&
    (candidate.startsWith(path + '.') ||
      candidate.startsWith(path + '[]') ||
      (path.endsWith('[]') && candidate.startsWith(path + '.'))),
  );
}

function add(violations, code) {
  violations.add(code);
}

/**
 * Reviews only the plan structure and mapping invariants. It emits aggregate
 * counts and stable violation codes, never record IDs, organization IDs,
 * source paths, free-form reasons or field values.
 *
 * "review_only" does not mean approved. This tool has no migration capability.
 */
export function reviewClientSensitiveDataSeparationPlan({ plan }) {
  const violations = new Set();
  const metrics = {
    sourceRecordsScanned: 0,
    recordsReviewed: 0,
    fieldPlansReviewed: 0,
    manualReviewPaths: 0,
    unclassifiedPaths: 0,
    compositeParentsToSplit: 0,
    bySensitivityClass: {},
    byAction: {},
    sourceInventoryPotentiallyIncomplete: null,
    noCloudChangesMade: false,
    noMigrationExecuted: false,
    rawFieldValuesIncluded: null,
    humanApprovalRequired: false,
    safeToMigrate: false,
  };

  const requiredPlanKeys = [
    'schemaVersion', 'mode', 'projectId', 'generatedAt', 'sourceCollection',
    'sourceInventorySchemaVersion', 'sourceRecordsScanned',
    'sourceInventoryPotentiallyIncomplete', 'noCloudChangesMade',
    'noMigrationExecuted', 'rawFieldValuesIncluded', 'humanApprovalRequired',
    'summary', 'limitations', 'records',
  ];
  if (!ownKeysAreAllowed(plan, PLAN_KEYS) || !hasRequiredKeys(plan, requiredPlanKeys)) {
    add(violations, 'invalid_plan_shape_or_unexpected_fields');
    return { status: 'blocked', violations: [...violations], metrics };
  }
  if (plan.schemaVersion !== 1 ||
      plan.mode !== 'proposal-only-client-sensitive-data-separation-plan' ||
      plan.sourceCollection !== 'clients' ||
      !Array.isArray(plan.records) ||
      !Number.isSafeInteger(plan.sourceRecordsScanned) ||
      typeof plan.sourceInventoryPotentiallyIncomplete !== 'boolean' ||
      !plan.summary || typeof plan.summary !== 'object' ||
      !Number.isSafeInteger(plan.summary.unclassifiedPaths) ||
      !Array.isArray(plan.limitations) ||
      typeof plan.generatedAt !== 'string' ||
      !Number.isSafeInteger(plan.sourceInventorySchemaVersion) ||
      !(plan.projectId === null || typeof plan.projectId === 'string')) {
    add(violations, 'invalid_plan_contract');
  }
  if (plan.noCloudChangesMade !== true) add(violations, 'cloud_change_safety_flag_missing');
  if (plan.noMigrationExecuted !== true) add(violations, 'migration_safety_flag_missing');
  if (plan.rawFieldValuesIncluded !== false) add(violations, 'raw_value_exclusion_flag_missing');
  if (plan.humanApprovalRequired !== true) add(violations, 'human_approval_gate_missing');

  metrics.sourceRecordsScanned = Number.isSafeInteger(plan.sourceRecordsScanned)
    ? plan.sourceRecordsScanned : 0;
  metrics.sourceInventoryPotentiallyIncomplete = plan.sourceInventoryPotentiallyIncomplete === true;
  metrics.noCloudChangesMade = plan.noCloudChangesMade === true;
  metrics.noMigrationExecuted = plan.noMigrationExecuted === true;
  metrics.rawFieldValuesIncluded = plan.rawFieldValuesIncluded;
  metrics.humanApprovalRequired = plan.humanApprovalRequired === true;

  if (metrics.sourceInventoryPotentiallyIncomplete) add(violations, 'source_inventory_incomplete');
  if (Array.isArray(plan.records) && metrics.sourceRecordsScanned !== plan.records.length) {
    add(violations, 'source_record_count_mismatch');
  }

  if (!Array.isArray(plan.records)) {
    return {
      status: 'blocked',
      violations: [...violations],
      metrics,
    };
  }

  const seenIds = new Set();
  for (const record of plan.records) {
    if (!ownKeysAreAllowed(record, RECORD_KEYS) ||
        !hasRequiredKeys(record, ['documentId', 'organizationId', 'fieldPlans']) ||
        typeof record.documentId !== 'string' || !record.documentId ||
        typeof record.organizationId !== 'string' || !record.organizationId ||
        !Array.isArray(record.fieldPlans)) {
      add(violations, 'invalid_record_shape_or_unexpected_fields');
      continue;
    }
    const recordKey = record.organizationId + '\u0000' + record.documentId;
    if (seenIds.has(recordKey)) add(violations, 'duplicate_source_record');
    seenIds.add(recordKey);
    metrics.recordsReviewed += 1;

    const paths = record.fieldPlans.map(field => field?.sourceFieldPath).filter(path => typeof path === 'string');
    for (const field of record.fieldPlans) {
      metrics.fieldPlansReviewed += 1;
      if (!ownKeysAreAllowed(field, FIELD_KEYS) ||
          !hasRequiredKeys(field, ['sourceFieldPath', 'action', 'destinationCollection', 'sensitivityClass', 'confidence', 'reason', 'humanApprovalRequired', 'writesPlanned']) ||
          typeof field.sourceFieldPath !== 'string' ||
          !/^(?:[A-Za-z0-9_-]{1,64}|\[field\])(?:\[\])*(?:\.(?:[A-Za-z0-9_-]{1,64}|\[field\])(?:\[\])*)*$/.test(field.sourceFieldPath) ||
          typeof field.sensitivityClass !== 'string' ||
          typeof field.action !== 'string') {
        add(violations, 'invalid_field_plan_shape_or_path');
        continue;
      }
      if (field.humanApprovalRequired !== true) add(violations, 'field_missing_human_approval');
      if (field.writesPlanned !== false) add(violations, 'field_write_path_not_disabled');
      if (!ALLOWED_ACTIONS.has(field.action)) add(violations, 'unsupported_action');
      metrics.bySensitivityClass[field.sensitivityClass] = (metrics.bySensitivityClass[field.sensitivityClass] || 0) + 1;
      metrics.byAction[field.action] = (metrics.byAction[field.action] || 0) + 1;

      if (field.action === 'split_parent_before_migration') {
        metrics.compositeParentsToSplit += 1;
        if (field.destinationCollection !== null ||
            !hasChildPath(field.sourceFieldPath, paths)) {
          add(violations, 'invalid_composite_parent_split');
        }
        continue;
      }

      if (field.action === 'manual_classification_required' ||
          field.action === 'manual_review_before_linking') {
        metrics.manualReviewPaths += 1;
      }
      if (field.sensitivityClass === 'unclassified') {
        metrics.unclassifiedPaths += 1;
        if (field.action !== 'manual_classification_required' || field.destinationCollection !== null) {
          add(violations, 'unclassified_field_has_unsafe_destination');
        }
        continue;
      }

      const expectedDestination = DESTINATION_BY_CLASS[field.sensitivityClass];
      if (!expectedDestination) {
        add(violations, 'unknown_sensitivity_class');
        continue;
      }
      if (field.destinationCollection !== expectedDestination) {
        add(violations, 'destination_class_mismatch');
      }

      if (field.sensitivityClass === 'base_contact' &&
          field.action !== 'retain_in_base_candidate') {
        add(violations, 'base_contact_action_mismatch');
      }
      if (field.sensitivityClass === 'document_references' &&
          field.action !== 'manual_review_before_linking') {
        add(violations, 'document_reference_requires_manual_link_review');
      }
      if (field.sensitivityClass === 'freeform_notes' &&
          field.action !== 'manual_classification_required') {
        add(violations, 'freeform_notes_require_manual_classification');
      }

      const fieldSegments = segments(field.sourceFieldPath);
      const containsHealth = fieldSegments.some(segment => HEALTH_SEGMENTS.has(segment));
      const containsFamily = fieldSegments.some(segment => FAMILY_SEGMENTS.has(segment));
      if (containsHealth &&
          (field.sensitivityClass !== 'health' ||
            field.destinationCollection !== 'clientMedicalProfiles')) {
        add(violations, 'health_path_not_classified_as_health');
      }
      if (containsFamily &&
          (field.sensitivityClass !== 'family' ||
            field.destinationCollection !== 'clientSensitiveProfiles')) {
        add(violations, 'family_path_not_classified_as_family');
      }
    }
  }

  if (Number.isSafeInteger(plan.summary.unclassifiedPaths) &&
      plan.summary.unclassifiedPaths !== metrics.unclassifiedPaths) {
    add(violations, 'unclassified_count_mismatch');
  }

  return {
    status: violations.size === 0 ? 'review_only' : 'blocked',
    violations: [...violations].sort(),
    metrics,
  };
}
