import type { Firestore } from 'firebase-admin/firestore';
import {
  resolveTrustedClientActor,
  type ClientDataClass,
  type TrustedClientActor,
} from './audit.js';

/**
 * This resolver maps a server-verified tenant actor to eligibility for a
 * purpose-bound, independently approved sensitive-read grant.
 *
 * It does NOT grant a read by role alone. The caller must still load the
 * trusted grant, verify the client/parent relationship, append the audit
 * event, and pass evaluateClientSensitiveReadAccess before loading fields.
 */
export type ClientSensitiveReadCapability = `client.sensitive.read.${ClientDataClass}`;

export interface TrustedClientCapabilityActor extends TrustedClientActor {
  readonly capabilities: readonly ClientSensitiveReadCapability[];
}

const ROLE_DATA_CLASS_ELIGIBILITY: Readonly<
  Record<TrustedClientActor['role'], readonly ClientDataClass[]>
> = Object.freeze({
  owner: Object.freeze([
    'identity',
    'family',
    'financial',
    'contact_address',
    'medical',
    'claim_sensitive',
  ]),
  admin: Object.freeze([
    'identity',
    'family',
    'financial',
    'contact_address',
    'medical',
    'claim_sensitive',
  ]),
  broker: Object.freeze([
    'identity',
    'family',
    'financial',
    'contact_address',
    'medical',
    'claim_sensitive',
  ]),
  claims: Object.freeze([
    'identity',
    'family',
    'medical',
    'claim_sensitive',
  ]),
  sales: Object.freeze([]),
  finance: Object.freeze([]),
  staff: Object.freeze([]),
});

/**
 * Resolve capability eligibility using the profile and active membership
 * loaded by the Admin-SDK actor resolver. The UID is the only caller input.
 *
 * Every returned capability is only eligibility to be considered for an
 * independently approved, record-specific grant. It is not a direct read
 * permission and must never be used as the only authorization check.
 */
export async function resolveTrustedClientCapabilities(
  db: Firestore,
  authenticatedUid: string,
): Promise<TrustedClientCapabilityActor> {
  const actor = await resolveTrustedClientActor(db, authenticatedUid);
  const capabilities = ROLE_DATA_CLASS_ELIGIBILITY[actor.role]
    .map((dataClass) => `client.sensitive.read.${dataClass}` as const);

  return Object.freeze({
    ...actor,
    capabilities: Object.freeze(capabilities),
  });
}

/** Pure helper for trusted server code; never pass a browser-built actor. */
export function hasTrustedClientSensitiveReadCapability(
  actor: TrustedClientCapabilityActor,
  dataClass: ClientDataClass,
): boolean {
  return actor.capabilities.includes(`client.sensitive.read.${dataClass}`);
}
