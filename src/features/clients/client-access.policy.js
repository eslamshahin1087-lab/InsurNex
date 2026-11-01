export const LEGACY_CLIENT_READ_ROLES = Object.freeze(['owner', 'admin', 'broker']);

export const CLIENT_BASE_SUMMARY_FIELDS = Object.freeze([
  'code',
  'type',
  'status',
  'name',
  'phone',
  'email',
  'industry',
  'city',
  'assignedTo',
  'leadSource',
  'createdAt',
  'updatedAt',
]);

const FORBIDDEN_BASE_FIELDS = Object.freeze([
  'nationalId',
  'taxId',
  'individual',
  'corporate',
  'riskData',
  'riskAssessment',
  'documents',
  'aiAnalysis',
  'notes',
  'address',
  'preferences',
  'lifetimeValue',
]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Mirrors the current Firestore Rules for the legacy mixed-sensitivity
 * clients/{clientId} document. This is a client-side preflight check only;
 * Firestore Rules remain the actual authorization boundary.
 */
export function canReadLegacyClientRecord(scope) {
  return Boolean(
    scope &&
    isNonEmptyString(scope.uid) &&
    isNonEmptyString(scope.organizationId) &&
    scope.status === 'active' &&
    LEGACY_CLIENT_READ_ROLES.includes(scope.role),
  );
}

export function assertCanReadLegacyClientRecord(scope) {
  if (!canReadLegacyClientRecord(scope)) {
    const error = new Error('CLIENT_ACCESS_DENIED');
    error.code = 'CLIENT_ACCESS_DENIED';
    throw error;
  }
}

/**
 * Returns a deliberately narrow list/detail projection for the client index.
 * It does not create field-level security: the backing Firestore document is
 * still readable only by roles allowed by the existing Firestore Rules.
 */
export function projectClientBaseSummary(documentId, data, scope) {
  assertCanReadLegacyClientRecord(scope);

  if (!data || data.organizationId !== scope.organizationId) {
    const error = new Error('CLIENT_ORG_MISMATCH');
    error.code = 'CLIENT_ORG_MISMATCH';
    throw error;
  }

  const summary = {
    id: documentId,
    organizationId: scope.organizationId,
  };

  for (const field of CLIENT_BASE_SUMMARY_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      summary[field] = data[field];
    }
  }

  // Keep this deny-list as an explicit regression contract when fields evolve.
  for (const field of FORBIDDEN_BASE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(summary, field)) {
      delete summary[field];
    }
  }

  return summary;
}

/**
 * Compatibility projection for the existing Client 360 workspace.
 * The full legacy document is returned only after the same active-user,
 * role and organization checks as the current Firestore Rules.
 */
export function projectLegacyClientWorkspace(documentId, data, scope) {
  assertCanReadLegacyClientRecord(scope);

  if (!data || data.organizationId !== scope.organizationId) {
    const error = new Error('CLIENT_ORG_MISMATCH');
    error.code = 'CLIENT_ORG_MISMATCH';
    throw error;
  }

  return { id: documentId, ...data };
}
