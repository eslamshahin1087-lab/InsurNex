import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export type ClientAuditAction =
  | 'sensitive_read_requested'
  | 'sensitive_read_denied'
  | 'sensitive_read_completed';

export type ClientDataClass =
  | 'identity'
  | 'family'
  | 'financial'
  | 'contact_address'
  | 'medical'
  | 'claim_sensitive'
  | 'ai_findings';

export type ClientAuditDecision = 'requested' | 'denied' | 'allowed';
export type ClientSensitiveCapability = `client.sensitive.read.${ClientDataClass}`;

export interface TrustedClientActor {
  uid: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'broker' | 'sales' | 'claims' | 'finance' | 'staff';
  status: 'active';
  membershipStatus: 'active';
  isPlatformAdmin: false;
  capabilities: ClientSensitiveCapability[];
}

export interface ClientAuditEventInput {
  action: ClientAuditAction;
  decision: ClientAuditDecision;
  dataClass: ClientDataClass;
  clientId: string;
  recordId?: string;
  purposeCode: string;
  requestId: string;
}

/**
 * Resolve the actor from server-side Firebase records only.
 * Platform administrators are deliberately excluded from tenant client data.
 * The profile and organization membership must agree exactly.
 */
export async function resolveTrustedClientActor(
  db: Firestore,
  uid: string,
): Promise<TrustedClientActor> {
  if (!isId(uid, 128)) throw new Error('CLIENT_AUDIT_ACTOR_INVALID');

  const adminSnapshot = await db.collection('admin').doc(uid).get();
  if (adminSnapshot.exists) throw new Error('CLIENT_AUDIT_PLATFORM_ADMIN_FORBIDDEN');

  const profileSnapshot = await db.collection('users').doc(uid).get();
  if (!profileSnapshot.exists) throw new Error('CLIENT_AUDIT_PROFILE_NOT_FOUND');

  const profile = profileSnapshot.data() ?? {};
  const organizationId = typeof profile.organizationId === 'string' ? profile.organizationId : '';
  const role = profile.role;

  if (
    profile.status !== 'active' ||
    !isId(organizationId, 180) ||
    !isRole(role)
  ) throw new Error('CLIENT_AUDIT_PROFILE_INACTIVE');

  const [organizationSnapshot, membershipSnapshot] = await Promise.all([
    db.collection('organizations').doc(organizationId).get(),
    db.collection('organizations').doc(organizationId).collection('members').doc(uid).get(),
  ]);

  if (!organizationSnapshot.exists || !membershipSnapshot.exists) {
    throw new Error('CLIENT_AUDIT_MEMBERSHIP_NOT_FOUND');
  }

  const membership = membershipSnapshot.data() ?? {};
  if (
    membership.uid !== uid ||
    membership.status !== 'active' ||
    membership.role !== role
  ) throw new Error('CLIENT_AUDIT_MEMBERSHIP_MISMATCH');

  return {
    uid,
    organizationId,
    role,
    status: 'active',
    membershipStatus: 'active',
    isPlatformAdmin: false,
    capabilities: parseTrustedClientCapabilities(membership.clientSensitiveCapabilities),
  };
}

/**
 * Resolve one exact sensitive-read capability from the active membership.
 * Capabilities are provisioned only by a trusted server-side process after
 * data-owner approval. Missing, malformed and unknown values fail closed.
 * Organization-member Firestore Rules reject browser create/update attempts.
 */
export async function resolveTrustedClientCapability(
  db: Firestore,
  authenticatedUid: string,
  dataClass: ClientDataClass,
): Promise<boolean> {
  if (!DATA_CLASSES.has(dataClass)) throw new Error('CLIENT_AUDIT_DATA_CLASS_INVALID');
  const actor = await resolveTrustedClientActor(db, authenticatedUid);
  return actor.capabilities.includes(`client.sensitive.read.${dataClass}`);
}

function parseTrustedClientCapabilities(value: unknown): ClientSensitiveCapability[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(
    [...DATA_CLASSES].map((dataClass) => `client.sensitive.read.${dataClass}`),
  );
  return [...new Set(value.filter(
    (candidate): candidate is ClientSensitiveCapability =>
      typeof candidate === 'string' && allowed.has(candidate),
  ))].sort();
}

/**
 * Single trusted entry point for future server handlers. The caller supplies
 * only the authenticated Firebase UID; actor identity and tenant scope are
 * reloaded from Admin-SDK records before any event is appended.
 */
export async function recordClientAuditEvent(
  db: Firestore,
  authenticatedUid: string,
  input: ClientAuditEventInput,
): Promise<{ eventId: string }> {
  const actor = await resolveTrustedClientActor(db, authenticatedUid);
  return appendClientAuditEvent(db, actor, input);
}

/**
 * Append a privacy-minimized audit event using the Admin SDK.
 * This function intentionally has no update/delete/read path and is not
 * exposed as a callable endpoint. Call only after trusted authorization code.
 * Firestore client rules must keep auditLogs inaccessible to browser clients.
 */
async function appendClientAuditEvent(
  db: Firestore,
  actor: TrustedClientActor,
  input: ClientAuditEventInput,
): Promise<{ eventId: string }> {
  if (
    !actor || !isId(actor.uid, 128) || !isId(actor.organizationId, 180) ||
    !isRole(actor.role)
  ) throw new Error('CLIENT_AUDIT_ACTOR_INVALID');

  if (!input || !ACTIONS.has(input.action) || !DECISIONS.has(input.decision) ||
      !DATA_CLASSES.has(input.dataClass) || !isId(input.clientId, 150) ||
      (input.recordId !== undefined && !isId(input.recordId, 150)) ||
      !PURPOSE_CODES.has(input.purposeCode) || !isId(input.requestId, 128)) {
    throw new Error('CLIENT_AUDIT_EVENT_INVALID');
  }

  if (
    (input.action === 'sensitive_read_requested' && input.decision !== 'requested') ||
    (input.action === 'sensitive_read_denied' && input.decision !== 'denied') ||
    (input.action === 'sensitive_read_completed' && input.decision !== 'allowed')
  ) throw new Error('CLIENT_AUDIT_ACTION_DECISION_MISMATCH');

  const eventRef = db.collection('auditLogs').doc();
  await eventRef.create({
    schemaVersion: 1,
    eventId: eventRef.id,
    organizationId: actor.organizationId,
    actorUid: actor.uid,
    actorRole: actor.role,
    action: input.action,
    decision: input.decision,
    dataClass: input.dataClass,
    clientId: input.clientId,
    ...(input.recordId ? { recordId: input.recordId } : {}),
    purposeCode: input.purposeCode,
    requestId: input.requestId,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { eventId: eventRef.id };
}

function isId(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 &&
    value.trim().length <= max && value === value.trim();
}

function isRole(value: unknown): value is TrustedClientActor['role'] {
  return typeof value === 'string' &&
    ['owner', 'admin', 'broker', 'sales', 'claims', 'finance', 'staff'].includes(value);
}

const ACTIONS = new Set<ClientAuditAction>([
  'sensitive_read_requested', 'sensitive_read_denied', 'sensitive_read_completed',
]);
const DECISIONS = new Set<ClientAuditDecision>(['requested', 'denied', 'allowed']);
const DATA_CLASSES = new Set<ClientDataClass>([
  'identity', 'family', 'financial', 'contact_address',
  'medical', 'claim_sensitive', 'ai_findings',
]);
const PURPOSE_CODES = new Set([
  'underwriting_review',
  'claim_assessment',
  'policy_servicing',
  'client_support',
  'compliance_review',
  'data_correction',
]);
