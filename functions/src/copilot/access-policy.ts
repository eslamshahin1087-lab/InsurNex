import type { Firestore } from 'firebase-admin/firestore';

export type CopilotRole = 'owner' | 'admin' | 'broker' | 'sales' | 'claims' | 'finance' | 'staff';

export class CopilotAuthorizationError extends Error {
  constructor(
    public readonly code: 'permission-denied' | 'invalid-argument',
    message: string,
  ) {
    super(message);
    this.name = 'CopilotAuthorizationError';
  }
}

export type CopilotAccess =
  | { scopeType: 'platform-admin'; organizationId: null; role: null }
  | { scopeType: 'organization'; organizationId: string; role: CopilotRole };

const ALLOWED_ORGANIZATION_ROLES = new Set<CopilotRole>([
  'owner', 'admin', 'broker', 'sales', 'claims', 'finance', 'staff',
]);

/**
 * Derive scope from server-side membership, never from a browser-supplied
 * organization ID. Platform Admin membership takes precedence over tenant
 * profiles and never grants access to tenant context through this endpoint.
 */
export async function resolveCopilotAccess(input: {
  db: Firestore;
  uid: string;
  requestedOrganizationId?: unknown;
}): Promise<CopilotAccess> {
  const { db, uid, requestedOrganizationId } = input;
  if (
    requestedOrganizationId !== undefined &&
    (typeof requestedOrganizationId !== 'string' || requestedOrganizationId.length > 160)
  ) {
    throw new CopilotAuthorizationError('invalid-argument', 'Invalid organization scope.');
  }

  const adminMembership = await db.collection('admin').doc(uid).get();
  if (adminMembership.exists) {
    if (requestedOrganizationId && requestedOrganizationId !== uid) {
      throw new CopilotAuthorizationError('permission-denied', 'Workspace access denied.');
    }
    return { scopeType: 'platform-admin', organizationId: null, role: null };
  }

  const profileSnapshot = await db.collection('users').doc(uid).get();
  if (!profileSnapshot.exists) {
    throw new CopilotAuthorizationError('permission-denied', 'Workspace access denied.');
  }

  const profile = profileSnapshot.data() ?? {};
  const organizationId = typeof profile.organizationId === 'string'
    ? profile.organizationId
    : '';
  const role = profile.role;

  if (
    profile.status !== 'active' ||
    !organizationId ||
    typeof role !== 'string' ||
    !ALLOWED_ORGANIZATION_ROLES.has(role as CopilotRole)
  ) {
    throw new CopilotAuthorizationError('permission-denied', 'Workspace access denied.');
  }

  if (requestedOrganizationId && requestedOrganizationId !== organizationId) {
    throw new CopilotAuthorizationError('permission-denied', 'Workspace access denied.');
  }

  return { scopeType: 'organization', organizationId, role: role as CopilotRole };
}
