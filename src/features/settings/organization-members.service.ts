import { auth, db } from '../../firebase/config';
import type { UserRole } from '../../types/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

export type InvitableRole = Exclude<UserRole, 'owner'>;
export type InvitationStatus = 'pending' | 'accepted' | 'revoked';

export interface OrganizationInvitation {
  id: string;
  organizationId: string;
  invitedEmail: string;
  role: InvitableRole;
  status: InvitationStatus;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  expiresAt: Timestamp;
  acceptedBy?: string;
  acceptedAt?: unknown;
  revokedBy?: string;
  revokedAt?: unknown;
}

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

function invitationRef(organizationId: string, invitationId: string) {
  return doc(db, 'organizations', organizationId, 'invitations', invitationId);
}

function roleIsInvitable(value: unknown): value is InvitableRole {
  return ['admin', 'broker', 'sales', 'claims', 'finance', 'staff'].includes(String(value));
}

export async function listOrganizationInvitations(
  organizationId: string,
): Promise<OrganizationInvitation[]> {
  const q = query(
    collection(db, 'organizations', organizationId, 'invitations'),
    orderBy('createdAt', 'desc'),
    limit(100),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }) as OrganizationInvitation);
}

export async function getInvitationForCurrentUser(
  organizationId: string,
  invitationId: string,
): Promise<OrganizationInvitation> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('NOT_AUTHENTICATED');
  await currentUser.reload();
  await currentUser.getIdToken(true);
  if (!currentUser.emailVerified) throw new Error('EMAIL_VERIFICATION_REQUIRED');

  const snapshot = await getDoc(invitationRef(organizationId, invitationId));
  if (!snapshot.exists()) throw new Error('INVITATION_NOT_FOUND');
  const invitation = { id: snapshot.id, ...snapshot.data() } as OrganizationInvitation;
  if (invitation.invitedEmail !== currentUser.email) throw new Error('INVITATION_EMAIL_MISMATCH');
  if (invitation.status !== 'pending') throw new Error('INVITATION_NOT_PENDING');
  if (invitation.expiresAt.toMillis() <= Date.now()) throw new Error('INVITATION_EXPIRED');
  if (!roleIsInvitable(invitation.role)) throw new Error('INVITATION_ROLE_INVALID');
  return invitation;
}

export async function createOrganizationInvitation(input: {
  organizationId: string;
  invitedEmail: string;
  role: InvitableRole;
  inviterUid: string;
}): Promise<{ invitationId: string; url: string; expiresAt: Date }> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== input.inviterUid) throw new Error('NOT_AUTHENTICATED');

  const invitedEmail = input.invitedEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedEmail)) throw new Error('INVALID_EMAIL');
  if (!roleIsInvitable(input.role)) throw new Error('INVALID_ROLE');

  // A random UUID is used as an unguessable invitation ID. Access is still
  // gated by the verified invitee email and the atomic acceptance rules.
  const invitationId = crypto.randomUUID().replace(/-/g, '');
  const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);
  await import('firebase/firestore').then(({ setDoc }) =>
    setDoc(invitationRef(input.organizationId, invitationId), {
      organizationId: input.organizationId,
      invitedEmail,
      role: input.role,
      status: 'pending',
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
    }),
  );

  return {
    invitationId,
    url: `${window.location.origin}/invite/${encodeURIComponent(input.organizationId)}/${invitationId}`,
    expiresAt,
  };
}

export async function revokeOrganizationInvitation(
  organizationId: string,
  invitationId: string,
  actorUid: string,
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== actorUid) throw new Error('NOT_AUTHENTICATED');
  await updateDoc(invitationRef(organizationId, invitationId), {
    status: 'revoked',
    revokedBy: currentUser.uid,
    revokedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function acceptOrganizationInvitation(
  organizationId: string,
  invitationId: string,
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.email) throw new Error('NOT_AUTHENTICATED');
  await currentUser.reload();
  await currentUser.getIdToken(true);
  if (!currentUser.emailVerified) throw new Error('EMAIL_VERIFICATION_REQUIRED');
  const email = currentUser.email;
  const profileRef = doc(db, 'users', currentUser.uid);
  const membershipRef = doc(db, 'organizations', organizationId, 'members', currentUser.uid);
  const inviteRef = invitationRef(organizationId, invitationId);

  await runTransaction(db, async (transaction) => {
    const [inviteSnapshot, profileSnapshot] = await Promise.all([
      transaction.get(inviteRef),
      transaction.get(profileRef),
    ]);
    if (!inviteSnapshot.exists()) throw new Error('INVITATION_NOT_FOUND');
    if (profileSnapshot.exists()) throw new Error('ACCOUNT_ALREADY_LINKED');
    const invitation = inviteSnapshot.data() as OrganizationInvitation;
    if (invitation.invitedEmail !== email) throw new Error('INVITATION_EMAIL_MISMATCH');
    if (invitation.status !== 'pending') throw new Error('INVITATION_NOT_PENDING');
    if (!invitation.expiresAt || invitation.expiresAt.toMillis() <= Date.now()) {
      throw new Error('INVITATION_EXPIRED');
    }
    if (!roleIsInvitable(invitation.role)) throw new Error('INVITATION_ROLE_INVALID');

    // All three writes are atomic. Firestore Rules verify the post-transaction
    // state of invitation, user profile and organization membership together.
    transaction.update(inviteRef, {
      status: 'accepted',
      acceptedBy: currentUser.uid,
      acceptedAt: serverTimestamp(),
    });
    transaction.set(profileRef, {
      email,
      displayName: currentUser.displayName || email.split('@')[0],
      organizationId,
      role: invitation.role,
      status: 'active',
      acceptedInvitationId: invitationId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.set(membershipRef, {
      uid: currentUser.uid,
      email,
      displayName: currentUser.displayName || email.split('@')[0],
      role: invitation.role,
      status: 'active',
      invitedBy: invitation.createdBy,
      createdAt: serverTimestamp(),
    });
  });
}
