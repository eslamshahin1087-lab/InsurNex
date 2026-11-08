const CLIENT_READ_ROLES = new Set(['owner', 'admin', 'broker']);
const POLICY_READ_ROLES = new Set(['owner', 'admin', 'broker', 'claims']);
const CLAIM_READ_ROLES = new Set(['owner', 'admin', 'broker', 'claims']);

/**
 * Mirrors the Firestore read matrix for the dashboard's aggregate sources.
 * Unknown roles fail closed. This is a query-planning guard, not authorization;
 * Firestore Rules remain the authoritative boundary.
 */
export function getDashboardRoleAccess(role: unknown): DashboardRoleAccess {
  const normalized = typeof role === 'string' ? role : '';
  return Object.freeze({
    clients: CLIENT_READ_ROLES.has(normalized),
    policies: POLICY_READ_ROLES.has(normalized),
    claims: CLAIM_READ_ROLES.has(normalized),
  });
}
