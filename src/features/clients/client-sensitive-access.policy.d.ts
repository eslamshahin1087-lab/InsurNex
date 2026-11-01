export type ClientSensitiveDataClass =
  | 'identity' | 'family' | 'financial' | 'contact_address'
  | 'medical' | 'claim_sensitive' | 'ai_findings';
export type ClientSensitiveAccessAction = 'read';

export interface ClientSensitiveAccessActor {
  uid: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'broker' | 'sales' | 'claims' | 'finance' | 'staff';
  status: 'active' | 'disabled';
  membershipStatus: 'active' | 'disabled';
  isPlatformAdmin?: boolean;
  /** Derived by a trusted server policy resolver; never accept from browser input. */
  capabilities: string[];
}
export interface ClientSensitiveAccessGrant {
  schemaVersion: 1;
  grantId: string;
  status: 'approved' | 'pending' | 'revoked';
  organizationId: string;
  clientId: string;
  recordId: string;
  dataClass: ClientSensitiveDataClass;
  action: ClientSensitiveAccessAction;
  subjectUid: string;
  subjectRole: ClientSensitiveAccessActor['role'];
  purpose: string;
  approvedBy: string;
  issuedAt: unknown;
  expiresAt: unknown;
  auditEventId: string;
  auditRecorded: boolean;
}
export interface ClientSensitiveAccessResource {
  organizationId: string;
  clientId: string;
  recordId: string;
  dataClass: ClientSensitiveDataClass;
  /** Set only after trusted server-side parent/relationship validation. */
  relationshipVerified: boolean;
}
export interface ClientSensitiveReadAccessInput {
  actor: ClientSensitiveAccessActor;
  grant: ClientSensitiveAccessGrant | unknown;
  resource: ClientSensitiveAccessResource;
  action?: string;
  now?: Date | number | string | unknown;
}
export interface ClientSensitiveReadAccessDecision {
  allowed: boolean;
  reason: string;
  grantId?: string;
  auditEventId?: string;
  expiresAt?: number;
}
export const CLIENT_SENSITIVE_DATA_CLASSES: readonly ClientSensitiveDataClass[];
export const CLIENT_SENSITIVE_ACCESS_ACTIONS: readonly ClientSensitiveAccessAction[];
export const CLIENT_SENSITIVE_GRANT_MAX_TTL_MS: number;
export function evaluateClientSensitiveReadAccess(
  input: ClientSensitiveReadAccessInput | unknown,
): ClientSensitiveReadAccessDecision;
