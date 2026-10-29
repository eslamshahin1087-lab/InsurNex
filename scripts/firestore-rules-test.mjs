import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  applyActionCode,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  initializeAuth,
  inMemoryPersistence,
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  query,
  writeBatch,
} from 'firebase/firestore';

const projectId = process.env.GCLOUD_PROJECT || '';
if (projectId !== 'demo-insurnex' || !projectId.startsWith('demo-')) {
  throw new Error('Safety stop: Firestore rules tests must run only against the demo-insurnex emulator project.');
}

const apps = [];
const projectConfig = {
  apiKey: 'fake-api-key',
  authDomain: 'demo-insurnex.firebaseapp.com',
  projectId,
  appId: '1:123456789:web:rules-test',
};

function check(condition, message) {
  assert.ok(condition, message);
  console.log('PASS ' + message);
}

async function makeActor(label) {
  const app = initializeApp(projectConfig, 'rules-' + label + '-' + randomUUID());
  apps.push(app);
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const credential = await createUserWithEmailAndPassword(
    auth,
    label + '-' + randomUUID() + '@example.test',
    'LocalRulesTest-Password-123!'
  );
  return { app, auth, db, user: credential.user };
}

async function expectDenied(operation, message) {
  let denied = false;
  try {
    await operation();
  } catch (error) {
    if (!String(error?.code || '').includes('permission-denied')) throw error;
    denied = true;
  }
  assert.equal(denied, true, 'Expected permission-denied: ' + message);
  console.log('PASS denied: ' + message);
}

async function createOwnerWorkspace(actor, organizationName) {
  const uid = actor.user.uid;
  const organizationId = 'org_' + uid;
  const batch = writeBatch(actor.db);
  batch.set(doc(actor.db, 'organizations', organizationId), {
    name: organizationName,
    type: 'office',
    ownerId: uid,
    country: 'EG',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(actor.db, 'users', uid), {
    email: actor.user.email,
    displayName: organizationName + ' Owner',
    organizationId,
    role: 'owner',
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(actor.db, 'organizations', organizationId, 'members', uid), {
    uid,
    email: actor.user.email,
    displayName: organizationName + ' Owner',
    role: 'owner',
    status: 'active',
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return organizationId;
}


async function acceptMemberViaInvitation(owner, organizationId, label, role) {
  const invitee = await makeActor(label);
  const email = String(invitee.user.email || '').toLowerCase();
  const invitationId = 'invite-' + randomUUID().replace(/-/g, '');
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const invitationRef = doc(owner.db, 'organizations', organizationId, 'invitations', invitationId);

  await setDoc(invitationRef, {
    organizationId,
    invitedEmail: email,
    role,
    status: 'pending',
    createdBy: owner.user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    expiresAt,
  });
  await expectDenied(
    () => getDoc(doc(invitee.db, 'organizations', organizationId, 'invitations', invitationId)),
    label + ' cannot read an invitation until email verification',
  );

  await sendEmailVerification(invitee.user);
  const oobResponse = await fetch('http://127.0.0.1:9099/emulator/v1/projects/demo-insurnex/oobCodes');
  assert.equal(oobResponse.ok, true, 'Auth emulator exposes the verification-code endpoint');
  const oobPayload = await oobResponse.json();
  const verification = (oobPayload.oobCodes || []).find((item) =>
    String(item.email || '').toLowerCase() === email
    && String(item.requestType || '').toUpperCase().includes('VERIFY_EMAIL')
  );
  assert.ok(verification?.oobCode, 'Auth emulator generated a verification code for ' + label);
  await applyActionCode(invitee.auth, verification.oobCode);
  await invitee.user.reload();
  await invitee.user.getIdToken(true);
  assert.equal(invitee.user.emailVerified, true, label + ' email is verified in the Auth emulator');

  const batch = writeBatch(invitee.db);
  batch.update(doc(invitee.db, 'organizations', organizationId, 'invitations', invitationId), {
    status: 'accepted',
    acceptedBy: invitee.user.uid,
    acceptedAt: serverTimestamp(),
  });
  batch.set(doc(invitee.db, 'users', invitee.user.uid), {
    email: invitee.user.email,
    displayName: label + ' Member',
    organizationId,
    role,
    status: 'active',
    acceptedInvitationId: invitationId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(invitee.db, 'organizations', organizationId, 'members', invitee.user.uid), {
    uid: invitee.user.uid,
    email: invitee.user.email,
    displayName: label + ' Member',
    role,
    status: 'active',
    invitedBy: owner.user.uid,
    createdAt: serverTimestamp(),
  });
  await batch.commit();

  const profile = await getDoc(doc(invitee.db, 'users', invitee.user.uid));
  check(profile.exists() && profile.data().role === role && profile.data().organizationId === organizationId,
    label + ' accepts the invitation with the assigned role and organization');
  return { actor: invitee, invitationId, organizationId };
}

try {
  const ownerA = await makeActor('owner-a');
  const orgA = await createOwnerWorkspace(ownerA, 'InsurNex Rules Test A');
  check((await getDoc(doc(ownerA.db, 'users', ownerA.user.uid))).exists(), 'owner onboarding batch creates its own profile');
  check((await getDoc(doc(ownerA.db, 'organizations', orgA))).exists(), 'owner can read the organization created in onboarding');

  const clientA = 'rules-test-' + randomUUID();
  await setDoc(doc(ownerA.db, 'clients', clientA), {
    organizationId: orgA,
    name: 'Isolated test client',
    createdBy: ownerA.user.uid,
    createdAt: serverTimestamp(),
  });
  check((await getDoc(doc(ownerA.db, 'clients', clientA))).exists(), 'owner can create and read a business record in own organization');

  const tenantTask = 'rules-task-' + randomUUID();
  await setDoc(doc(ownerA.db, 'tasks', tenantTask), {
    organizationId: orgA,
    title: 'Allowlisted tenant task',
    status: 'open',
    createdBy: ownerA.user.uid,
  });
  check((await getDoc(doc(ownerA.db, 'tasks', tenantTask))).exists(),
    'known tenant-scoped business collections remain accessible within the same organization');

  const ownerB = await makeActor('owner-b');
  const orgB = await createOwnerWorkspace(ownerB, 'InsurNex Rules Test B');
  check((await getDoc(doc(ownerB.db, 'organizations', orgB))).exists(), 'a second owner can complete normal onboarding');

  // Finance collections must remain tenant-isolated by the generic rules.
  for (const collectionName of ['revenue', 'expenses', 'commissions']) {
    const recordId = 'rules-' + collectionName + '-' + randomUUID();
    await setDoc(doc(ownerA.db, collectionName, recordId), {
      organizationId: orgA,
      amount: 1250,
      status: 'pending',
      createdBy: ownerA.user.uid,
      createdAt: serverTimestamp(),
    });
    check((await getDoc(doc(ownerA.db, collectionName, recordId))).exists(),
      'same-organization users can read ' + collectionName + ' records');
    await expectDenied(
      () => getDoc(doc(ownerB.db, collectionName, recordId)),
      'a different organization cannot read ' + collectionName + ' records by ID'
    );
    await expectDenied(
      () => getDocs(query(
        collection(ownerB.db, collectionName),
        where('organizationId', '==', orgA),
      )),
      'a different organization cannot query ' + collectionName + ' records'
    );
    await expectDenied(
      () => setDoc(doc(ownerB.db, collectionName, 'forged-' + randomUUID()), {
        organizationId: orgA,
        amount: 999999,
        status: 'pending',
        createdBy: ownerB.user.uid,
      }),
      'a user cannot create ' + collectionName + ' records for another organization'
    );
    await expectDenied(
      () => updateDoc(doc(ownerA.db, collectionName, recordId), {
        organizationId: orgB,
      }),
      'a user cannot move an existing ' + collectionName + ' record to another organization'
    );
  }


  // Verified invite acceptance is an atomic three-document operation: invitation,
  // user profile and organization membership. Test several roles against the real Rules engine.
  const brokerMember = await acceptMemberViaInvitation(ownerA, orgA, 'invited-broker', 'broker');
  const salesMember = await acceptMemberViaInvitation(ownerA, orgA, 'invited-sales', 'sales');
  const claimsMember = await acceptMemberViaInvitation(ownerA, orgA, 'invited-claims', 'claims');
  const financeMember = await acceptMemberViaInvitation(ownerA, orgA, 'invited-finance', 'finance');
  const staffMember = await acceptMemberViaInvitation(ownerA, orgA, 'invited-staff', 'staff');

  const protectedClientId = 'rbac-client-' + randomUUID();
  const protectedPolicyId = 'rbac-policy-' + randomUUID();
  const protectedClaimId = 'rbac-claim-' + randomUUID();
  const protectedLeadId = 'rbac-lead-' + randomUUID();
  const protectedTaskId = 'rbac-task-' + randomUUID();
  const protectedRevenueId = 'rbac-revenue-' + randomUUID();
  const protectedClaimDocumentId = 'rbac-claim-document-' + randomUUID();
  const protectedIdentityDocumentId = 'rbac-identity-document-' + randomUUID();

  await setDoc(doc(ownerA.db, 'clients', protectedClientId), {
    organizationId: orgA, name: 'RBAC fixture client', phone: '01000000000',
    nationalId: 'TEST-NATIONAL-ID', createdBy: ownerA.user.uid, createdAt: serverTimestamp(),
  });
  await setDoc(doc(ownerA.db, 'policies', protectedPolicyId), {
    organizationId: orgA, clientId: protectedClientId, policyNumber: 'RBAC-POLICY',
    status: 'active', createdBy: ownerA.user.uid, createdAt: serverTimestamp(),
  });
  await setDoc(doc(ownerA.db, 'claims', protectedClaimId), {
    organizationId: orgA, clientId: protectedClientId, policyId: protectedPolicyId,
    claimNumber: 'RBAC-CLAIM', status: 'review', createdBy: ownerA.user.uid, createdAt: serverTimestamp(),
  });
  await setDoc(doc(ownerA.db, 'leads', protectedLeadId), {
    organizationId: orgA, name: 'RBAC lead', stage: 'new',
    createdBy: ownerA.user.uid, createdAt: serverTimestamp(),
  });
  await setDoc(doc(ownerA.db, 'tasks', protectedTaskId), {
    organizationId: orgA, title: 'RBAC task', status: 'open',
    createdBy: ownerA.user.uid, createdAt: serverTimestamp(),
  });
  await setDoc(doc(ownerA.db, 'revenue', protectedRevenueId), {
    organizationId: orgA, amount: 1000, type: 'commission', status: 'confirmed',
    createdBy: ownerA.user.uid, createdAt: serverTimestamp(),
  });
  await setDoc(doc(ownerA.db, 'documents', protectedClaimDocumentId), {
    organizationId: orgA, category: 'claim', relatedType: 'claim', relatedId: protectedClaimId,
    name: 'Claim evidence', uploadedBy: ownerA.user.uid, createdBy: ownerA.user.uid,
  });
  await setDoc(doc(ownerA.db, 'documents', protectedIdentityDocumentId), {
    organizationId: orgA, category: 'identity', relatedType: 'client', relatedId: protectedClientId,
    name: 'Identity evidence', uploadedBy: ownerA.user.uid, createdBy: ownerA.user.uid,
  });

  check((await getDoc(doc(brokerMember.actor.db, 'clients', protectedClientId))).exists(),
    'broker can read the organization client record');
  await expectDenied(
    () => getDoc(doc(salesMember.actor.db, 'clients', protectedClientId)),
    'sales cannot read full Client 360 records containing sensitive identity fields',
  );
  check((await getDoc(doc(salesMember.actor.db, 'leads', protectedLeadId))).exists(),
    'sales can read leads in its own organization');
  await expectDenied(
    () => getDoc(doc(salesMember.actor.db, 'claims', protectedClaimId)),
    'sales cannot read claims',
  );
  check((await getDoc(doc(claimsMember.actor.db, 'claims', protectedClaimId))).exists(),
    'claims role can read claim records in its own organization');
  check((await getDoc(doc(claimsMember.actor.db, 'policies', protectedPolicyId))).exists(),
    'claims role can read linked policy metadata within its organization');
  // New Supabase metadata must declare the bound-path key version and may not persist URLs.
  const unversionedSupabaseId = 'rbac-unversioned-storage-' + randomUUID();
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'documents', unversionedSupabaseId), {
      organizationId: orgA, category: 'other', relatedType: 'general', relatedId: '',
      name: 'Unversioned Supabase metadata', uploadedBy: ownerA.user.uid,
      createdBy: ownerA.user.uid, storageProvider: 'supabase',
      storageBucket: 'insurnex-documents', storagePath: `organizations/${orgA}/documents/${unversionedSupabaseId}/file.pdf`,
      downloadUrl: '',
    }),
    'new Supabase metadata requires storageKeyVersion 2',
  );
  const versionedSupabaseId = 'rbac-versioned-storage-' + randomUUID();
  const versionedSupabaseRef = doc(ownerA.db, 'documents', versionedSupabaseId);
  await setDoc(versionedSupabaseRef, {
    organizationId: orgA, category: 'other', relatedType: 'general', relatedId: '',
    name: 'Versioned Supabase metadata', uploadedBy: ownerA.user.uid,
    createdBy: ownerA.user.uid, storageProvider: 'supabase', storageKeyVersion: 2,
    storageBucket: 'insurnex-documents',
    storagePath: `organizations/${orgA}/documents/${versionedSupabaseId}/file.pdf`,
    downloadUrl: '', size: 120, contentType: 'application/pdf',
  });
  await expectDenied(
    () => updateDoc(versionedSupabaseRef, {
      storagePath: `organizations/${orgA}/documents/another-document/file.pdf`,
    }),
    'document metadata storage paths cannot be redirected after creation',
  );
  await expectDenied(
    () => updateDoc(versionedSupabaseRef, { downloadUrl: 'https://example.invalid/persistent-link' }),
    'new Supabase documents cannot be changed to persist a download URL',
  );


  // Operation attachment metadata must use versioned private keys and a controlled pending -> ready transition.
  const protectedOperationId = 'rbac-operation-' + randomUUID();
  await setDoc(doc(ownerA.db, 'operations', protectedOperationId), {
    organizationId: orgA, kind: 'policy_issuance', title: 'Attachment fixture',
    status: 'request', createdBy: ownerA.user.uid, createdAt: serverTimestamp(),
  });
  const unversionedAttachmentId = 'rbac-unversioned-attachment-' + randomUUID();
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'operationAttachments', unversionedAttachmentId), {
      organizationId: orgA, operationId: protectedOperationId, name: 'invoice.pdf',
      uploadedBy: ownerA.user.uid, createdBy: ownerA.user.uid,
      storageProvider: 'supabase', storageBucket: 'insurnex-documents',
      storagePath: `organizations/${orgA}/operations/${protectedOperationId}/${unversionedAttachmentId}-invoice.pdf`,
      downloadUrl: '', uploadState: 'pending',
    }),
    'new Supabase operation attachment metadata requires storageKeyVersion 2',
  );
  const operationAttachmentId = 'rbac-attachment-' + randomUUID();
  const operationAttachmentRef = doc(ownerA.db, 'operationAttachments', operationAttachmentId);
  await setDoc(operationAttachmentRef, {
    organizationId: orgA, operationId: protectedOperationId, name: 'invoice.pdf',
    contentType: 'application/pdf', size: 120,
    uploadedBy: ownerA.user.uid, createdBy: ownerA.user.uid,
    storageProvider: 'supabase', storageKeyVersion: 2, storageBucket: 'insurnex-documents',
    storagePath: `organizations/${orgA}/operations/${protectedOperationId}/${operationAttachmentId}-invoice.pdf`,
    downloadUrl: '', uploadState: 'pending',
  });
  await expectDenied(
    () => updateDoc(operationAttachmentRef, {
      storagePath: `organizations/${orgA}/operations/${protectedOperationId}/forged-invoice.pdf`,
    }),
    'operation attachment storage paths cannot be redirected after creation',
  );
  await expectDenied(
    () => updateDoc(operationAttachmentRef, { downloadUrl: 'https://example.invalid/persistent-link' }),
    'operation attachments cannot persist download URLs',
  );
  await updateDoc(operationAttachmentRef, { uploadState: 'ready' });
  check((await getDoc(operationAttachmentRef)).data().uploadState === 'ready',
    'the uploader may mark an operation attachment ready after upload');
  await expectDenied(
    () => updateDoc(operationAttachmentRef, { uploadState: 'pending' }),
    'operation attachment upload state cannot be reset after becoming ready',
  );
  await expectDenied(
    () => updateDoc(operationAttachmentRef, {
      storagePath: `organizations/${orgA}/operations/${protectedOperationId}/forged-again.pdf`,
      uploadState: 'pending',
    }),
    'operation attachment metadata rejects combined path and upload-state tampering',
  );

  check((await getDoc(doc(claimsMember.actor.db, 'documents', protectedClaimDocumentId))).exists(),
    'claims role can read claim-category document metadata');
  await expectDenied(
    () => getDoc(doc(claimsMember.actor.db, 'documents', protectedIdentityDocumentId)),
    'claims role cannot read identity-category document metadata',
  );
  await expectDenied(
    () => getDoc(doc(claimsMember.actor.db, 'revenue', protectedRevenueId)),
    'claims role cannot read brokerage revenue',
  );
  await expectDenied(
    () => setDoc(doc(salesMember.actor.db, 'leads', 'sales-forged-' + randomUUID()), {
      organizationId: orgB, name: 'cross-org lead', createdBy: salesMember.actor.user.uid,
    }),
    'sales cannot create a lead in another organization',
  );
  await expectDenied(
    () => setDoc(doc(claimsMember.actor.db, 'leads', 'claims-forged-' + randomUUID()), {
      organizationId: orgA, name: 'unauthorized lead', createdBy: claimsMember.actor.user.uid,
    }),
    'claims role cannot create leads',
  );
  check((await getDoc(doc(financeMember.actor.db, 'revenue', protectedRevenueId))).exists(),
    'finance role can read revenue for its own organization');
  await expectDenied(
    () => getDoc(doc(financeMember.actor.db, 'clients', protectedClientId)),
    'finance role cannot read full client profiles',
  );
  await expectDenied(
    () => getDoc(doc(financeMember.actor.db, 'claims', protectedClaimId)),
    'finance role cannot read claim narratives',
  );
  check((await getDoc(doc(staffMember.actor.db, 'tasks', protectedTaskId))).exists(),
    'staff can read task records within its organization');
  await expectDenied(
    () => getDoc(doc(staffMember.actor.db, 'revenue', protectedRevenueId)),
    'staff cannot read financial records',
  );

  const privateConversationId = 'rbac-conversation-' + randomUUID();
  await setDoc(doc(claimsMember.actor.db, 'copilotConversations', privateConversationId), {
    organizationId: orgA, userId: claimsMember.actor.user.uid,
    title: 'Private claims conversation', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await expectDenied(
    () => getDoc(doc(ownerA.db, 'copilotConversations', privateConversationId)),
    'organization owner cannot directly read another member private Copilot conversation',
  );

  const memberOwnMessageId = 'rbac-copilot-message-' + randomUUID();
  await setDoc(doc(claimsMember.actor.db, 'copilotMessages', memberOwnMessageId), {
    organizationId: orgA,
    userId: claimsMember.actor.user.uid,
    conversationId: privateConversationId,
    role: 'user',
    content: 'Own conversation message',
    createdAt: serverTimestamp(),
  });
  check(
    (await getDoc(doc(claimsMember.actor.db, 'copilotMessages', memberOwnMessageId))).exists(),
    'a member can create a message in their own Copilot conversation',
  );

  const ownerConversationId = 'rbac-owner-conversation-' + randomUUID();
  await setDoc(doc(ownerA.db, 'copilotConversations', ownerConversationId), {
    organizationId: orgA,
    userId: ownerA.user.uid,
    title: 'Owner conversation',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const ownerOwnMessageId = 'rbac-owner-message-' + randomUUID();
  await setDoc(doc(ownerA.db, 'copilotMessages', ownerOwnMessageId), {
    organizationId: orgA,
    userId: ownerA.user.uid,
    conversationId: ownerConversationId,
    role: 'user',
    content: 'Owner own conversation message',
    createdAt: serverTimestamp(),
  });
  check(
    (await getDoc(doc(ownerA.db, 'copilotMessages', ownerOwnMessageId))).exists(),
    'an owner can create a message in their own Copilot conversation',
  );

  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'copilotMessages', ownerOwnMessageId), {
      conversationId: privateConversationId,
    }),
    'a Copilot message cannot be moved to another conversation after creation',
  );

  await expectDenied(
    () => setDoc(doc(claimsMember.actor.db, 'copilotMessages', 'rbac-forged-message-' + randomUUID()), {
      organizationId: orgA,
      userId: claimsMember.actor.user.uid,
      conversationId: ownerConversationId,
      role: 'user',
      content: 'Attempt to attach a message to another member conversation',
      createdAt: serverTimestamp(),
    }),
    'a member cannot attach a message to another member Copilot conversation',
  );

  await expectDenied(
    () => setDoc(doc(ownerA.db, 'copilotMessages', 'rbac-missing-parent-message-' + randomUUID()), {
      organizationId: orgA,
      userId: ownerA.user.uid,
      conversationId: 'missing-conversation-' + randomUUID(),
      role: 'user',
      content: 'Attempt to attach a message to a missing conversation',
      createdAt: serverTimestamp(),
    }),
    'a message cannot reference a missing Copilot conversation',
  );

  const foreignConversationId = 'rbac-foreign-conversation-' + randomUUID();
  await setDoc(doc(ownerB.db, 'copilotConversations', foreignConversationId), {
    organizationId: orgB,
    userId: ownerB.user.uid,
    title: 'Foreign organization conversation',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'copilotMessages', 'rbac-foreign-message-' + randomUUID()), {
      organizationId: orgA,
      userId: ownerA.user.uid,
      conversationId: foreignConversationId,
      role: 'user',
      content: 'Attempt to attach a message to another organization',
      createdAt: serverTimestamp(),
    }),
    'a tenant cannot attach a message to a Copilot conversation from another organization',
  );

  const notificationA = 'rules-notification-' + randomUUID();
  await setDoc(doc(ownerA.db, 'notifications', notificationA), {
    organizationId: orgA,
    title: 'Tenant A notification',
    message: 'Visible only within tenant A',
    createdAt: serverTimestamp(),
  });
  const ownNotifications = await getDocs(query(
    collection(ownerA.db, 'notifications'),
    where('organizationId', '==', orgA),
  ));
  check(ownNotifications.docs.some((item) => item.id === notificationA),
    'tenant users can query notifications scoped to their own organization');
  await expectDenied(
    () => getDoc(doc(ownerB.db, 'notifications', notificationA)),
    'tenant users cannot read another organization\'s notification by document ID'
  );
  await expectDenied(
    () => getDocs(query(
      collection(ownerB.db, 'notifications'),
      where('organizationId', '==', orgA),
    )),
    'tenant users cannot query notifications belonging to another organization'
  );

  await expectDenied(
    () => setDoc(doc(ownerA.db, 'unregisteredPrivateCollection', 'forged-' + randomUUID()), {
      organizationId: orgA,
      secret: 'must not be writable through the generic rule',
    }),
    'unknown top-level collections are denied even when organizationId matches the user profile'
  );
  await expectDenied(
    () => getDoc(doc(ownerA.db, 'unregisteredPrivateCollection', 'existing-secret-record')),
    'unknown top-level collections are not readable through the generic rule'
  );


  const settingsBeforeSave = await getDoc(doc(ownerA.db, 'platformSettings', 'global'));
  check(!settingsBeforeSave.exists(), 'signed-in users can read the shared platform settings document before it is initialized');
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'platformSettings', 'global'), {
      organizationId: orgA,
      branding: { primaryColor: '#1E4272', accentColor: '#1473E6' },
      features: {
        clients: true, policies: true, claims: true, renewals: true, operations: true,
        tasks: true, insurers: true, leads: true, finance: true, analytics: true,
        copilot: true, documents: true, notifications: true,
      },
      advertising: { enabled: true, dashboard: true, operations: false },
      updatedBy: ownerA.user.uid,
      updatedAt: serverTimestamp(),
    }),
    'a regular organization owner cannot write global platform settings or bypass the explicit rule by adding organizationId'
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'admin', ownerA.user.uid), { role: 'super_admin' }),
    'a regular user cannot create an admin membership document'
  );

  // Regression for Firestore's OR semantics across overlapping match blocks.
  // This record can be created under the explicit organization-create rule,
  // but its organizationId must not let the generic business rule bypass
  // access checks for the different organization document path.
  const shadowOrg = 'shadow-org-' + randomUUID();
  await setDoc(doc(ownerA.db, 'organizations', shadowOrg), {
    name: 'Wildcard regression fixture',
    type: 'office',
    ownerId: ownerA.user.uid,
    organizationId: orgA,
    createdAt: serverTimestamp(),
  });
  await expectDenied(
    () => getDoc(doc(ownerA.db, 'organizations', shadowOrg)),
    'generic organization rule cannot expose a document outside the path organization'
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'organizations', shadowOrg), { ownerId: 'forged-owner' }),
    'generic organization rule cannot bypass the path-based organization update check'
  );
  await expectDenied(
    () => deleteDoc(doc(ownerA.db, 'organizations', shadowOrg)),
    'generic organization rule cannot bypass the organization delete prohibition'
  );

  await expectDenied(
    () => getDoc(doc(ownerB.db, 'clients', clientA)),
    'a user from another organization cannot read a client record'
  );
  await expectDenied(
    () => setDoc(doc(ownerB.db, 'clients', 'cross-org-' + randomUUID()), {
      organizationId: orgA,
      name: 'Cross organization write',
      createdBy: ownerB.user.uid,
    }),
    'a user cannot create a business record in another organization'
  );

  const attacker = await makeActor('attacker');
  await expectDenied(
    () => setDoc(doc(attacker.db, 'users', attacker.user.uid), {
      email: attacker.user.email,
      displayName: 'Invalid owner',
      organizationId: orgA,
      role: 'owner',
      status: 'active',
    }),
    'a new user cannot claim an existing organization in a forged owner profile'
  );

  const notYetMember = await makeActor('not-yet-member');
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'users', notYetMember.user.uid), {
      email: notYetMember.user.email,
      displayName: 'Forged member profile',
      organizationId: orgA,
      role: 'broker',
      status: 'active',
    }),
    'a user cannot create another users profile through the generic business rule'
  );

  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'users', ownerA.user.uid), { role: 'admin' }),
    'self-service update cannot modify the users role'
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'users', ownerA.user.uid), { status: 'disabled' }),
    'self-service update cannot change account status'
  );
  await expectDenied(
    () => deleteDoc(doc(ownerA.db, 'users', ownerA.user.uid)),
    'generic deletion cannot bypass the users delete prohibition'
  );

  await updateDoc(doc(ownerA.db, 'users', ownerA.user.uid), { displayName: 'Updated Display Name' });
  check((await getDoc(doc(ownerA.db, 'users', ownerA.user.uid))).data().displayName === 'Updated Display Name',
    'profile owner can still update a non-privileged display field');

  console.log('All Firestore emulator security regression tests passed.');
} finally {
  await Promise.allSettled(apps.map((app) => deleteApp(app)));
}
