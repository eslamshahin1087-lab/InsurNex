import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { AppUser } from '../../types/auth';
import type { InsuranceClient } from '../../types/client';
import {
  assertCanReadLegacyClientRecord,
  projectClientBaseSummary,
  projectLegacyClientWorkspace,
  type ClientAccessScope,
  type ClientBaseSummary,
} from './client-access.policy.js';

/**
 * Compatibility-first client read adapter.
 *
 * The legacy clients collection still contains mixed-sensitivity fields.
 * Until those fields are physically separated behind collection-specific
 * Firestore Rules or a trusted projection endpoint, only Owner/Admin/Broker
 * may read the legacy document. This adapter narrows the object passed to
 * broad list UIs; it is not a replacement for Firestore authorization.
 */
function scopeFromProfile(profile: AppUser): ClientAccessScope {
  return {
    uid: profile.uid,
    organizationId: profile.organizationId,
    role: profile.role,
    status: profile.status,
  };
}

export async function listClientSummaries(
  profile: AppUser,
): Promise<ClientBaseSummary[]> {
  const scope = scopeFromProfile(profile);
  assertCanReadLegacyClientRecord(scope);

  const q = query(
    collection(db, 'clients'),
    where('organizationId', '==', scope.organizationId),
    orderBy('createdAt', 'desc'),
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) =>
    projectClientBaseSummary(item.id, item.data(), scope),
  );
}

export async function getLegacyClientWorkspace(
  profile: AppUser,
  clientId: string,
): Promise<InsuranceClient | null> {
  const scope = scopeFromProfile(profile);
  assertCanReadLegacyClientRecord(scope);

  const snapshot = await getDoc(doc(db, 'clients', clientId));
  if (!snapshot.exists()) return null;

  return projectLegacyClientWorkspace(
    snapshot.id,
    snapshot.data() as Record<string, unknown>,
    scope,
  ) as InsuranceClient;
}

export type { ClientAccessScope, ClientBaseSummary } from './client-access.policy.js';
