export const CLIENT_SENSITIVE_DATA_CLASSES = Object.freeze([
  'identity', 'family', 'financial', 'contact_address',
  'medical', 'claim_sensitive', 'ai_findings',
]);
export const CLIENT_SENSITIVE_ACCESS_ACTIONS = Object.freeze(['read']);
export const CLIENT_SENSITIVE_GRANT_MAX_TTL_MS = 15 * 60 * 1000;

const ORGANIZATION_ROLES = new Set(['owner','admin','broker','sales','claims','finance','staff']);
const GRANT_KEYS = new Set([
  'schemaVersion','grantId','status','organizationId','clientId','recordId',
  'dataClass','action','subjectUid','subjectRole','purpose','approvedBy',
  'issuedAt','expiresAt','auditEventId','auditRecorded',
]);
const DENY = Object.freeze({
  invalidRequest: 'INVALID_REQUEST',
  actorInactive: 'ACTOR_NOT_ACTIVE',
  platformAdmin: 'PLATFORM_ADMIN_FORBIDDEN',
  capabilityMissing: 'SENSITIVE_CAPABILITY_MISSING',
  grantInvalid: 'GRANT_INVALID',
  grantNotApproved: 'GRANT_NOT_APPROVED',
  grantSubjectMismatch: 'GRANT_SUBJECT_MISMATCH',
  roleMismatch: 'GRANT_ROLE_MISMATCH',
  resourceScopeMismatch: 'RESOURCE_SCOPE_MISMATCH',
  relationshipUnverified: 'RESOURCE_RELATIONSHIP_UNVERIFIED',
  actionUnsupported: 'ACTION_NOT_SUPPORTED',
  purposeMissing: 'PURPOSE_REQUIRED',
  approvalMissing: 'INDEPENDENT_APPROVAL_REQUIRED',
  auditMissing: 'AUDIT_NOT_RECORDED',
  grantNotYetValid: 'GRANT_NOT_YET_VALID',
  grantExpired: 'GRANT_EXPIRED',
  grantTtlExceeded: 'GRANT_TTL_EXCEEDED',
});

function isPlainRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function nonEmptyString(value, max = 256) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}
function timestampMillis(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Date.parse(value);
  if (isPlainRecord(value) && typeof value.toMillis === 'function') {
    try { return Number(value.toMillis()); } catch { return Number.NaN; }
  }
  if (isPlainRecord(value) && typeof value.seconds === 'number') {
    return value.seconds * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1e6);
  }
  return Number.NaN;
}
function deny(reason) { return Object.freeze({ allowed: false, reason }); }

/**
 * Pure fail-closed evaluator for future server-side sensitive-data readers.
 * actor must come from verified Firebase identity and active membership.
 * grant must be loaded from a trusted store, never from browser input.
 * relationshipVerified must be set only after trusted parent validation.
 * This helper performs no auth, Firestore access, audit write or grant issuance.
 */
export function evaluateClientSensitiveReadAccess(input) {
  if (!isPlainRecord(input)) return deny(DENY.invalidRequest);
  const { actor, grant, resource, action = 'read', now = new Date() } = input;
  if (!isPlainRecord(actor) || !isPlainRecord(resource)) return deny(DENY.invalidRequest);

  if (
    !nonEmptyString(actor.uid, 128) ||
    !nonEmptyString(actor.organizationId, 180) ||
    !ORGANIZATION_ROLES.has(actor.role) ||
    actor.status !== 'active' ||
    actor.membershipStatus !== 'active'
  ) return deny(DENY.actorInactive);

  if (actor.isPlatformAdmin === true) return deny(DENY.platformAdmin);
  if (!CLIENT_SENSITIVE_ACCESS_ACTIONS.includes(action)) return deny(DENY.actionUnsupported);

  const dataClass = resource.dataClass;
  if (!CLIENT_SENSITIVE_DATA_CLASSES.includes(dataClass)) return deny(DENY.invalidRequest);

  const requiredCapability = 'client.sensitive.read.' + dataClass;
  if (!Array.isArray(actor.capabilities) || !actor.capabilities.includes(requiredCapability)) {
    return deny(DENY.capabilityMissing);
  }

  if (
    !nonEmptyString(resource.organizationId, 180) ||
    !nonEmptyString(resource.clientId, 150) ||
    !nonEmptyString(resource.recordId, 150)
  ) return deny(DENY.invalidRequest);

  if (resource.organizationId !== actor.organizationId) return deny(DENY.resourceScopeMismatch);
  if (resource.relationshipVerified !== true) return deny(DENY.relationshipUnverified);

  if (!isPlainRecord(grant) || Object.keys(grant).some((key) => !GRANT_KEYS.has(key))) {
    return deny(DENY.grantInvalid);
  }
  if (
    grant.schemaVersion !== 1 ||
    !nonEmptyString(grant.grantId, 128) ||
    !nonEmptyString(grant.organizationId, 180) ||
    !nonEmptyString(grant.clientId, 150) ||
    !nonEmptyString(grant.recordId, 150) ||
    !CLIENT_SENSITIVE_DATA_CLASSES.includes(grant.dataClass) ||
    !nonEmptyString(grant.subjectUid, 128) ||
    !ORGANIZATION_ROLES.has(grant.subjectRole)
  ) return deny(DENY.grantInvalid);

  if (grant.status !== 'approved') return deny(DENY.grantNotApproved);
  if (grant.action !== action || grant.dataClass !== dataClass) return deny(DENY.actionUnsupported);
  if (
    grant.subjectUid !== actor.uid ||
    grant.organizationId !== actor.organizationId ||
    grant.clientId !== resource.clientId ||
    grant.recordId !== resource.recordId
  ) return deny(DENY.grantSubjectMismatch);
  if (grant.subjectRole !== actor.role) return deny(DENY.roleMismatch);
  if (!nonEmptyString(grant.purpose, 240) || grant.purpose.trim().length < 12) {
    return deny(DENY.purposeMissing);
  }
  if (!nonEmptyString(grant.approvedBy, 128) || grant.approvedBy === actor.uid) {
    return deny(DENY.approvalMissing);
  }
  if (!nonEmptyString(grant.auditEventId, 150) || grant.auditRecorded !== true) {
    return deny(DENY.auditMissing);
  }

  const currentTime = timestampMillis(now);
  const issuedAt = timestampMillis(grant.issuedAt);
  const expiresAt = timestampMillis(grant.expiresAt);
  if (![currentTime, issuedAt, expiresAt].every(Number.isFinite)) return deny(DENY.grantInvalid);
  if (issuedAt > currentTime) return deny(DENY.grantNotYetValid);
  if (expiresAt <= currentTime) return deny(DENY.grantExpired);
  if (expiresAt <= issuedAt || expiresAt - issuedAt > CLIENT_SENSITIVE_GRANT_MAX_TTL_MS) {
    return deny(DENY.grantTtlExceeded);
  }

  return Object.freeze({
    allowed: true,
    reason: 'APPROVED_TIME_LIMITED_AUDITED_GRANT',
    grantId: grant.grantId,
    auditEventId: grant.auditEventId,
    expiresAt,
  });
}
