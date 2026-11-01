export const CLIENT_DATA_CONTRACT_CATALOG = Object.freeze({
  baseClient: Object.freeze({ collection: 'clients', status: 'existing-legacy-projection' }),
  identity: Object.freeze({ collection: 'clientSensitiveProfiles', status: 'proposed-default-deny' }),
  family: Object.freeze({ collection: 'clientSensitiveProfiles', status: 'proposed-default-deny' }),
  financial: Object.freeze({ collection: 'clientSensitiveProfiles', status: 'proposed-default-deny' }),
  contact_address: Object.freeze({ collection: 'clientSensitiveProfiles', status: 'proposed-default-deny' }),
  medical: Object.freeze({ collection: 'clientMedicalProfiles', status: 'proposed-default-deny' }),
  claim_sensitive: Object.freeze({ collection: 'claimSensitiveDetails', status: 'proposed-default-deny' }),
  document_metadata: Object.freeze({ collection: 'documents', status: 'existing-manual-link-review' }),
  ai_findings: Object.freeze({ collection: 'aiFindings', status: 'proposed-default-deny' }),
  audit_events: Object.freeze({ collection: 'auditLogs', status: 'proposed-default-deny' }),
});

export const CLIENT_SENSITIVE_PROFILE_KINDS = Object.freeze([
  'identity',
  'family',
  'financial',
  'contact_address',
]);

const ENVELOPE_KEYS = new Set([
  'schemaVersion',
  'organizationId',
  'clientId',
  'profileKind',
  'data',
  'createdBy',
  'updatedBy',
  'createdAt',
  'updatedAt',
]);

const VALID_PROFILE_KINDS = new Set([
  ...CLIENT_SENSITIVE_PROFILE_KINDS,
  'medical',
  'claim_sensitive',
  'ai_findings',
]);

export const CLIENT_DOCUMENT_METADATA_FIELDS = Object.freeze([
  'name',
  'category',
  'originalFileName',
  'contentType',
  'size',
  'storageProvider',
  'relatedType',
  'relatedId',
  'uploadedBy',
  'status',
  'expiryDate',
  'issuedDate',
  'issuedBy',
  'verified',
  'verifiedAt',
  'verifiedBy',
  'createdAt',
  'updatedAt',
]);

function isPlainRecord(value) {
  return Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Shape validation only. This function does not authenticate a user,
 * authorize a role, or grant access to a Firestore collection.
 */
export function isClientScopedRecordEnvelope(value) {
  if (!isPlainRecord(value)) return false;
  if (Object.keys(value).some((key) => !ENVELOPE_KEYS.has(key))) return false;

  return value.schemaVersion === 1 &&
    nonEmptyString(value.organizationId) &&
    nonEmptyString(value.clientId) &&
    VALID_PROFILE_KINDS.has(value.profileKind) &&
    isPlainRecord(value.data) &&
    nonEmptyString(value.createdBy) &&
    (value.updatedBy === undefined || nonEmptyString(value.updatedBy));
}

/**
 * Check that a previously-authorized record is still bound to the expected
 * tenant and client relationship. This is not a substitute for Firestore Rules.
 */
export function assertClientRecordMatchesScope(value, expected) {
  if (!isClientScopedRecordEnvelope(value)) {
    throw new Error('CLIENT_RECORD_ENVELOPE_INVALID');
  }
  if (
    !isPlainRecord(expected) ||
    !nonEmptyString(expected.organizationId) ||
    !nonEmptyString(expected.clientId) ||
    value.organizationId !== expected.organizationId ||
    value.clientId !== expected.clientId
  ) {
    throw new Error('CLIENT_RECORD_SCOPE_MISMATCH');
  }
  return value;
}

/**
 * Project only non-secret document metadata after the existing document access
 * path has authorized the caller. Signed URLs, Storage paths, notes and file
 * payloads are deliberately excluded. This helper performs no Firestore read.
 */
export function projectClientDocumentMetadata(documentId, source, expected) {
  if (
    !nonEmptyString(documentId) ||
    !isPlainRecord(source) ||
    !isPlainRecord(expected) ||
    !nonEmptyString(expected.organizationId) ||
    !nonEmptyString(expected.clientId) ||
    source.organizationId !== expected.organizationId ||
    source.relatedType !== 'client' ||
    source.relatedId !== expected.clientId
  ) {
    throw new Error('CLIENT_DOCUMENT_SCOPE_MISMATCH');
  }

  const projection = {
    id: documentId,
    organizationId: expected.organizationId,
    clientId: expected.clientId,
  };

  for (const field of CLIENT_DOCUMENT_METADATA_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      projection[field] = source[field];
    }
  }

  return projection;
}
