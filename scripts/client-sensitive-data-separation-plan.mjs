const BASE_CONTACT_FIELDS = new Set([
  'name',
  'fullName',
  'companyName',
  'phone',
  'phoneAlt',
  'mobile',
  'email',
  'city',
  'country',
  'website',
]);

const MEDICAL_SEGMENTS = new Set([
  'health',
  'medical',
  'chronicconditions',
  'medications',
  'surgeries',
  'diagnosis',
  'diagnoses',
  'treatment',
  'disability',
  'preexistingconditions',
  'preexistingcondition',
  'smoker',
  'lastcheckup',
]);

const CLASS_PRIORITY = [
  'health',
  'family',
  'identity',
  'financial',
  'derived_assessment',
  'derived_analysis',
  'document_references',
  'freeform_notes',
  'contact_address',
  'risk_profile',
  'identity_profile',
  'corporate_profile',
  'basic_contact',
];

const DESTINATIONS = {
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

function normalizeSegment(segment) {
  return String(segment || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function pathSegments(path) {
  return String(path || '')
    .replace(/\[\]/g, '')
    .split('.')
    .filter(Boolean);
}

function includesMedicalSegment(path, categories) {
  if (categories.includes('health')) return true;
  return pathSegments(path).some(segment => MEDICAL_SEGMENTS.has(normalizeSegment(segment)));
}

function categoriesFor(record, fieldPath) {
  const categories = record?.pathCategories?.[fieldPath];
  return Array.isArray(categories) ? categories.filter(item => typeof item === 'string') : [];
}

function hasChildPath(fieldPath, allPaths) {
  return allPaths.some(candidate =>
    candidate !== fieldPath &&
    (candidate.startsWith(fieldPath + '.') ||
      candidate.startsWith(fieldPath + '[]') ||
      (fieldPath.endsWith('[]') && candidate.startsWith(fieldPath + '.'))),
  );
}

function classifyFieldPath(record, fieldPath) {
  const categories = categoriesFor(record, fieldPath);
  const segments = pathSegments(fieldPath);
  const topLevel = segments.length === 1 && !fieldPath.includes('[]');
  const leaf = segments.at(-1) || '';

  // Only this explicit top-level allow-list is a candidate to remain in the base
  // client record. Nested copies are not assumed safe because the root may itself
  // be a richer individual/corporate profile object.
  if (topLevel && BASE_CONTACT_FIELDS.has(leaf)) {
    return {
      action: 'retain_in_base_candidate',
      destinationCollection: 'clients',
      sensitivityClass: 'base_contact',
      confidence: 'high',
      reason: 'Exact top-level field is on the proposed minimal contact allow-list; confirm purpose and access needs before migration.',
    };
  }

  if (includesMedicalSegment(fieldPath, categories)) {
    return {
      action: 'proposed_destination_requires_review',
      destinationCollection: DESTINATIONS.health,
      sensitivityClass: 'health',
      confidence: 'high',
      reason: 'Field path indicates health or medical information; apply narrow medical access and legal/retention review.',
    };
  }

  if (fieldPath === 'documents' || fieldPath.startsWith('documents.') || fieldPath.startsWith('documents[]')) {
    return {
      action: 'manual_review_before_linking',
      destinationCollection: DESTINATIONS.document_references,
      sensitivityClass: 'document_references',
      confidence: 'high',
      reason: 'Document references need relationship, provider, private-path and legacy signed-URL validation; never copy or sign URLs from this plan.',
    };
  }

  if (fieldPath === 'notes' || categories.includes('freeform_notes') ||
      /(^|\.)(description|narrative|freeText|comment|remarks)$/i.test(fieldPath)) {
    return {
      action: 'manual_classification_required',
      destinationCollection: DESTINATIONS.freeform_notes,
      sensitivityClass: 'freeform_notes',
      confidence: 'high',
      reason: 'Free-form text can mix personal, medical, claim and other content; classify content purpose and retention before separating it.',
    };
  }

  if (fieldPath === 'aiAnalysis' || fieldPath.startsWith('aiAnalysis.')) {
    return {
      action: 'proposed_destination_requires_review',
      destinationCollection: DESTINATIONS.derived_analysis,
      sensitivityClass: 'derived_analysis',
      confidence: 'high',
      reason: 'AI-derived content requires provenance, source linkage, retention and visibility review before it becomes a separate finding.',
    };
  }

  if (fieldPath === 'riskAssessment' || fieldPath.startsWith('riskAssessment.')) {
    return {
      action: 'proposed_destination_requires_review',
      destinationCollection: DESTINATIONS.derived_assessment,
      sensitivityClass: 'derived_assessment',
      confidence: 'high',
      reason: 'Derived assessment fields require source, method, version and human-review metadata; no assessment is moved by this plan.',
    };
  }

  if (fieldPath === 'individual' || fieldPath.startsWith('individual.')) {
    const specificProfileClass = CLASS_PRIORITY.find(candidate =>
      ['health', 'family', 'identity', 'financial', 'contact_address', 'freeform_notes'].includes(candidate)
      && categories.includes(candidate)
      && DESTINATIONS[candidate],
    );
    const sensitivityClass = specificProfileClass || 'identity_profile';
    return {
      action: sensitivityClass === 'freeform_notes'
        ? 'manual_classification_required'
        : 'proposed_destination_requires_review',
      destinationCollection: DESTINATIONS[sensitivityClass],
      sensitivityClass,
      confidence: categories.length > 0 ? 'medium' : 'low',
      reason: 'Individual profile fields belong in a restricted profile; more-specific medical, family, identity, financial or narrative classifications take precedence over the parent profile.',
    };
  }

  if (fieldPath === 'corporate' || fieldPath.startsWith('corporate.')) {
    const specificProfileClass = CLASS_PRIORITY.find(candidate =>
      ['health', 'family', 'identity', 'financial', 'contact_address', 'freeform_notes'].includes(candidate)
      && categories.includes(candidate)
      && DESTINATIONS[candidate],
    );
    const sensitivityClass = specificProfileClass || 'corporate_profile';
    return {
      action: sensitivityClass === 'freeform_notes'
        ? 'manual_classification_required'
        : 'proposed_destination_requires_review',
      destinationCollection: DESTINATIONS[sensitivityClass],
      sensitivityClass,
      confidence: categories.length > 0 ? 'medium' : 'low',
      reason: 'Corporate profile fields require a restricted profile; more-specific legal, identity, financial, medical or narrative classifications take precedence over the parent profile.',
    };
  }

  const category = CLASS_PRIORITY.find(candidate => categories.includes(candidate));
  if (category && DESTINATIONS[category]) {
    const freeform = category === 'freeform_notes';
    const documents = category === 'document_references';
    return {
      action: freeform
        ? 'manual_classification_required'
        : documents
          ? 'manual_review_before_linking'
          : 'proposed_destination_requires_review',
      destinationCollection: DESTINATIONS[category],
      sensitivityClass: category,
      confidence: 'medium',
      reason: freeform
        ? 'Free-form fields need human classification before a target can be approved.'
        : documents
          ? 'Document metadata and relationships must be reconciled before linking or migration.'
          : 'A field-presence category suggests a target class, but data-owner and RBAC review is required.',
    };
  }

  return {
    action: 'manual_classification_required',
    destinationCollection: null,
    sensitivityClass: 'unclassified',
    confidence: 'low',
    reason: 'No explicit mapping exists for this field path. Do not guess a destination; classify it with the data owner.',
  };
}

/**
 * Produce a proposal-only mapping from the sanitized field inventory.
 *
 * This function deliberately has no Firestore, Storage, network or migration API.
 * It consumes only field paths/categories and stable record identifiers; it never
 * copies field values from an inventory object or executes any destination write.
 */
export function buildClientSensitiveDataSeparationPlan({
  inventoryReport,
  generatedAt = new Date().toISOString(),
}) {
  if (!inventoryReport || typeof inventoryReport !== 'object' || Array.isArray(inventoryReport)) {
    throw new Error('Provide a valid sensitive-field inventory report.');
  }
  if (inventoryReport.schemaVersion !== 1 ||
      inventoryReport.mode !== 'read-only-sensitive-field-inventory' ||
      inventoryReport.rawFieldValuesIncluded !== false ||
      inventoryReport.noCloudChangesMade !== true) {
    throw new Error('Safety stop: input is not a recognized value-free, read-only inventory report.');
  }
  if (!Array.isArray(inventoryReport.records) ||
      !inventoryReport.summary ||
      !Number.isSafeInteger(inventoryReport.summary.clientRecordsScanned) ||
      !inventoryReport.scan ||
      typeof inventoryReport.scan.potentiallyIncomplete !== 'boolean') {
    throw new Error('Inventory report is missing required summary or scan-completeness metadata.');
  }

  const records = [];
  const counts = {
    totalFieldPaths: 0,
    proposedDestinationPaths: 0,
    retainInBaseCandidates: 0,
    manualReviewPaths: 0,
    compositeParentsToSplit: 0,
    unclassifiedPaths: 0,
    byDestination: {},
    bySensitivityClass: {},
  };

  for (const record of inventoryReport.records) {
    if (!record || typeof record !== 'object' ||
        typeof record.documentId !== 'string' ||
        typeof record.organizationId !== 'string' ||
        !Array.isArray(record.fieldPaths) ||
        !record.pathCategories || typeof record.pathCategories !== 'object') {
      throw new Error('Inventory record is missing a document ID, organization ID, or field-path map.');
    }

    const safePathPattern = /^(?:[A-Za-z0-9_-]{1,64}|\[field\])(?:\[\])*(?:\.(?:[A-Za-z0-9_-]{1,64}|\[field\])(?:\[\])*)*$/;
    if (!record.fieldPaths.every(path => typeof path === 'string' && safePathPattern.test(path))) {
      throw new Error('Inventory contains an invalid field-path token; refusing to propagate it into the plan.');
    }
    const fieldPaths = [...new Set(record.fieldPaths)].sort();
    const fieldPlans = fieldPaths.map(fieldPath => {
      counts.totalFieldPaths += 1;
      let proposed;

      if (hasChildPath(fieldPath, fieldPaths)) {
        proposed = {
          action: 'split_parent_before_migration',
          destinationCollection: null,
          sensitivityClass: 'composite_parent',
          confidence: 'high',
          reason: 'This path has child paths in the inventory. Do not move the whole parent object; classify its leaves to avoid duplicate or mixed-sensitivity copies.',
        };
        counts.compositeParentsToSplit += 1;
      } else {
        proposed = classifyFieldPath(record, fieldPath);
        if (proposed.action === 'retain_in_base_candidate') counts.retainInBaseCandidates += 1;
        else if (proposed.action === 'manual_classification_required' ||
                 proposed.action === 'manual_review_before_linking') counts.manualReviewPaths += 1;
        else counts.proposedDestinationPaths += 1;
      }

      if (proposed.sensitivityClass === 'unclassified') counts.unclassifiedPaths += 1;
      if (proposed.destinationCollection) {
        counts.byDestination[proposed.destinationCollection] =
          (counts.byDestination[proposed.destinationCollection] || 0) + 1;
      }
      counts.bySensitivityClass[proposed.sensitivityClass] =
        (counts.bySensitivityClass[proposed.sensitivityClass] || 0) + 1;

      return {
        sourceFieldPath: fieldPath,
        ...proposed,
        humanApprovalRequired: true,
        writesPlanned: false,
      };
    });

    records.push({
      documentId: record.documentId,
      organizationId: record.organizationId,
      fieldPlans,
    });
  }

  return {
    schemaVersion: 1,
    mode: 'proposal-only-client-sensitive-data-separation-plan',
    projectId: typeof inventoryReport.projectId === 'string' ? inventoryReport.projectId : null,
    generatedAt,
    sourceCollection: 'clients',
    sourceInventorySchemaVersion: inventoryReport.schemaVersion,
    sourceRecordsScanned: inventoryReport.summary.clientRecordsScanned,
    sourceInventoryPotentiallyIncomplete: inventoryReport.scan.potentiallyIncomplete,
    noCloudChangesMade: true,
    noMigrationExecuted: true,
    rawFieldValuesIncluded: false,
    humanApprovalRequired: true,
    summary: counts,
    limitations: [
      'This plan maps field-path presence only; it never reads source values or writes destination records.',
      'A proposed destination is not approval to migrate. All paths require owner/RBAC, purpose, retention, export/delete and compatibility review.',
      'Composite parents must be split by leaf-field classification; do not copy both a parent object and its children.',
      'Unknown paths stay unclassified; mappings must be extended only after data-owner review.',
      'Document references require a separate relationship and private-storage reconciliation; signed URLs must never be copied into the target.',
      'If the source inventory reached its record cap, the plan is incomplete and cannot be treated as a complete schema map.',
    ],
    records,
  };
}
