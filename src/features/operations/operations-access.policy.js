const OPERATIONS_ROLES = new Set(['owner', 'admin', 'broker', 'claims']);
const CLIENT_RECORD_ROLES = new Set(['owner', 'admin', 'broker']);
const RFQ_WORKSPACE_ROLES = new Set(['owner', 'admin', 'broker']);
const EMAIL_DIRECTORY_ROLES = new Set(['owner', 'admin', 'broker', 'claims']);

/**
 * Role-scoped Operations Center capabilities mirror Firestore's collection
 * read matrix. This policy only controls which queries and UI surfaces run;
 * Firestore Rules remain the authorization boundary.
 */
export function getOperationsRoleAccess(role) {
  const normalized = typeof role === 'string' ? role : '';
  return Object.freeze({
    operations: OPERATIONS_ROLES.has(normalized),
    clientRecords: CLIENT_RECORD_ROLES.has(normalized),
    rfqWorkspace: RFQ_WORKSPACE_ROLES.has(normalized),
    clientOnboarding: CLIENT_RECORD_ROLES.has(normalized),
    emails: EMAIL_DIRECTORY_ROLES.has(normalized),
  });
}
