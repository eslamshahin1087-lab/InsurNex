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
  limit,
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

async function createOwnerWorkspace(actor, organizationName, membershipExtras = {}) {
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
    ...membershipExtras,
  });
  await batch.commit();
  return organizationId;
}


async function acceptMemberViaInvitation(owner, organizationId, label, role, options = {}) {
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
    ...(options.membershipExtras || {}),
  });
  if (options.expectCommitDenied) {
    await expectDenied(
      () => batch.commit(),
      label + ' cannot inject trusted capability fields during invitation acceptance',
    );
    return { actor: invitee, invitationId, organizationId };
  }
  await batch.commit();

  const profile = await getDoc(doc(invitee.db, 'users', invitee.user.uid));
  check(profile.exists() && profile.data().role === role && profile.data().organizationId === organizationId,
    label + ' accepts the invitation with the assigned role and organization');
  return { actor: invitee, invitationId, organizationId };
}

try {
  const forgedOwner = await makeActor('owner-capability-forgery');
  await expectDenied(
    () => createOwnerWorkspace(forgedOwner, 'Forged Owner Workspace', {
      clientSensitiveCapabilities: ['client.sensitive.read.medical'],
    }),
    'new owner cannot self-grant sensitive capabilities during workspace creation',
  );

  const ownerA = await makeActor('owner-a');
  const orgA = await createOwnerWorkspace(ownerA, 'InsurNex Rules Test A');
  check((await getDoc(doc(ownerA.db, 'users', ownerA.user.uid))).exists(), 'owner onboarding batch creates its own profile');
  check((await getDoc(doc(ownerA.db, 'organizations', orgA))).exists(), 'owner can read the organization created in onboarding');

  const clientA = 'rules-test-' + randomUUID();
  await setDoc(doc(ownerA.db, 'clients', clientA), {
    organizationId: orgA,
    name: 'Isolated test client',
    assignedTo: ownerA.user.uid,
    createdBy: ownerA.user.uid,
    createdAt: serverTimestamp(),
  });
  check((await getDoc(doc(ownerA.db, 'clients', clientA))).exists(), 'owner can create and read a business record in own organization');
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'clients', 'rules-client-cross-assignee-' + randomUUID()), {
      organizationId: orgA,
      name: 'Nonexistent client assignee',
      assignedTo: 'foreign-user-placeholder',
      createdBy: ownerA.user.uid,
    }),
    'a client cannot be assigned to a nonexistent user',
  );

  const tenantTask = 'rules-task-' + randomUUID();
  await setDoc(doc(ownerA.db, 'tasks', tenantTask), {
    organizationId: orgA,
    title: 'Allowlisted tenant task',
    status: 'open',
    assignedTo: '',
    createdBy: ownerA.user.uid,
  });
  check((await getDoc(doc(ownerA.db, 'tasks', tenantTask))).exists(),
    'known tenant-scoped business collections remain accessible within the same organization');

  const ownerB = await makeActor('owner-b');
  const orgB = await createOwnerWorkspace(ownerB, 'InsurNex Rules Test B');
  check((await getDoc(doc(ownerB.db, 'organizations', orgB))).exists(), 'a second owner can complete normal onboarding');
  const clientB = 'rules-test-' + randomUUID();
  await setDoc(doc(ownerB.db, 'clients', clientB), {
    organizationId: orgB,
    name: 'Isolated test client B',
    assignedTo: ownerB.user.uid,
    createdBy: ownerB.user.uid,
    createdAt: serverTimestamp(),
  });
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'clients', 'rules-client-foreign-assignee-' + randomUUID()), {
      organizationId: orgA,
      name: 'Foreign organization assignee',
      assignedTo: ownerB.user.uid,
      createdBy: ownerA.user.uid,
    }),
    'a client cannot be assigned to a user from another organization',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'clients', clientA), {
      assignedTo: ownerB.user.uid,
      updatedAt: serverTimestamp(),
    }),
    'a client cannot be updated to an assignee from another organization',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'clients', clientA), {
      assignedTo: 'missing-client-assignee-' + randomUUID(),
      updatedAt: serverTimestamp(),
    }),
    'a client cannot be updated to a nonexistent assignee',
  );
  await updateDoc(doc(ownerA.db, 'clients', clientA), {
    name: 'Updated synthetic client',
    updatedAt: serverTimestamp(),
  });
  check((await getDoc(doc(ownerA.db, 'clients', clientA))).data().assignedTo === ownerA.user.uid,
    'a client can update other fields while preserving its valid assignee');
  const foreignRelations = {
    claim: 'rules-claim-' + randomUUID(),
    policy: 'rules-policy-' + randomUUID(),
    lead: 'rules-lead-' + randomUUID(),
    rfq: 'rules-rfq-' + randomUUID(),
  };
  const ownRelations = {
    claim: 'rules-claim-' + randomUUID(),
    policy: 'rules-policy-' + randomUUID(),
    otherClientPolicy: 'rules-policy-' + randomUUID(),
    lead: 'rules-lead-' + randomUUID(),
    otherClientLead: 'rules-lead-' + randomUUID(),
    rfq: 'rules-rfq-' + randomUUID(),
  };
  const ownAlternateClient = 'rules-client-' + randomUUID();
  await setDoc(doc(ownerA.db, 'clients', ownAlternateClient), {
    organizationId: orgA,
    name: 'Isolated alternate synthetic client',
    createdBy: ownerA.user.uid,
    createdAt: serverTimestamp(),
  });
  await Promise.all([
    setDoc(doc(ownerB.db, 'policies', foreignRelations.policy), {
      organizationId: orgB, clientId: clientB, policyNumber: 'SYNTHETIC-CROSS-ORG', createdBy: ownerB.user.uid,
    }),
    setDoc(doc(ownerB.db, 'leads', foreignRelations.lead), {
      organizationId: orgB, name: 'Synthetic cross-org lead',
      assignedTo: ownerB.user.uid, clientId: clientB, createdBy: ownerB.user.uid,
    }),
    setDoc(doc(ownerB.db, 'rfqs', foreignRelations.rfq), {
      organizationId: orgB, clientId: clientB, leadId: foreignRelations.lead,
      insurerIds: [], createdBy: ownerB.user.uid,
    }),
    setDoc(doc(ownerA.db, 'policies', ownRelations.policy), {
      organizationId: orgA, clientId: clientA, policyNumber: 'SYNTHETIC-SAME-ORG', createdBy: ownerA.user.uid,
    }),
    setDoc(doc(ownerA.db, 'policies', ownRelations.otherClientPolicy), {
      organizationId: orgA, clientId: ownAlternateClient,
      policyNumber: 'SYNTHETIC-OTHER-CLIENT', createdBy: ownerA.user.uid,
    }),
    setDoc(doc(ownerA.db, 'leads', ownRelations.lead), {
      organizationId: orgA, name: 'Synthetic same-org lead',
      assignedTo: ownerA.user.uid, clientId: clientA, createdBy: ownerA.user.uid,
    }),
    setDoc(doc(ownerA.db, 'leads', ownRelations.otherClientLead), {
      organizationId: orgA, name: 'Synthetic lead for another client',
      assignedTo: ownerA.user.uid, clientId: ownAlternateClient, createdBy: ownerA.user.uid,
    }),
    setDoc(doc(ownerA.db, 'rfqs', ownRelations.rfq), {
      organizationId: orgA, clientId: clientA, leadId: ownRelations.lead,
      insurerIds: [], createdBy: ownerA.user.uid,
    }),
  ]);
  await Promise.all([
    setDoc(doc(ownerB.db, 'claims', foreignRelations.claim), {
      organizationId: orgB, clientId: clientB, policyId: foreignRelations.policy,
      claimNumber: 'SYNTHETIC-CROSS-ORG', createdBy: ownerB.user.uid,
    }),
    setDoc(doc(ownerA.db, 'claims', ownRelations.claim), {
      organizationId: orgA, clientId: clientA, policyId: ownRelations.policy,
      claimNumber: 'SYNTHETIC-SAME-ORG', createdBy: ownerA.user.uid,
    }),
  ]);
  check((await getDoc(doc(ownerA.db, 'claims', ownRelations.claim))).exists(),
    'a claim can link to its own organization client and policy');

  const ownClaimActivity = 'rules-claim-activity-' + randomUUID();
  await setDoc(doc(ownerA.db, 'claimActivities', ownClaimActivity), {
    organizationId: orgA,
    claimId: ownRelations.claim,
    type: 'note',
    title: 'Synthetic claim activity',
    createdBy: ownerA.user.uid,
  });
  check((await getDoc(doc(ownerA.db, 'claimActivities', ownClaimActivity))).exists(),
    'a claim activity can reference a claim in its own organization');
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'claimActivities', 'rules-claim-activity-cross-org-' + randomUUID()), {
      organizationId: orgA,
      claimId: foreignRelations.claim,
      type: 'note',
      title: 'Invalid cross-organization claim activity',
      createdBy: ownerA.user.uid,
    }),
    'a claim activity cannot reference a claim from another organization',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'claimActivities', 'rules-claim-activity-missing-' + randomUUID()), {
      organizationId: orgA,
      claimId: 'missing-claim-' + randomUUID(),
      type: 'note',
      title: 'Invalid missing-claim activity',
      createdBy: ownerA.user.uid,
    }),
    'a claim activity cannot reference a nonexistent claim',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'claimActivities', ownClaimActivity), {
      claimId: foreignRelations.claim,
    }),
    'a claim activity cannot be relinked to a claim from another organization',
  );
  await updateDoc(doc(ownerA.db, 'claimActivities', ownClaimActivity), { title: 'Updated synthetic activity' });
  check(
    (await getDoc(doc(ownerA.db, 'claimActivities', ownClaimActivity))).data().claimId === ownRelations.claim,
    'a claim activity can update its title while preserving its valid claim relationship',
  );

  const ownLeadActivity = 'rules-lead-activity-' + randomUUID();
  await setDoc(doc(ownerA.db, 'leadActivities', ownLeadActivity), {
    organizationId: orgA,
    leadId: ownRelations.lead,
    type: 'note',
    message: 'Synthetic lead activity',
    createdBy: ownerA.user.uid,
  });
  check((await getDoc(doc(ownerA.db, 'leadActivities', ownLeadActivity))).exists(),
    'a lead activity can reference a lead in its own organization');
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'leadActivities', 'rules-lead-activity-cross-org-' + randomUUID()), {
      organizationId: orgA,
      leadId: foreignRelations.lead,
      type: 'note',
      message: 'Invalid cross-organization lead activity',
      createdBy: ownerA.user.uid,
    }),
    'a lead activity cannot reference a lead from another organization',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'leadActivities', 'rules-lead-activity-missing-' + randomUUID()), {
      organizationId: orgA,
      leadId: 'missing-lead-' + randomUUID(),
      type: 'note',
      message: 'Invalid missing-lead activity',
      createdBy: ownerA.user.uid,
    }),
    'a lead activity cannot reference a nonexistent lead',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'leadActivities', ownLeadActivity), {
      leadId: foreignRelations.lead,
    }),
    'a lead activity cannot be relinked to a lead from another organization',
  );
  await updateDoc(doc(ownerA.db, 'leadActivities', ownLeadActivity), { message: 'Updated synthetic activity' });
  check(
    (await getDoc(doc(ownerA.db, 'leadActivities', ownLeadActivity))).data().leadId === ownRelations.lead,
    'a lead activity can update its message while preserving its valid lead relationship',
  );

  const ownClientDocumentId = 'rules-document-client-' + randomUUID();
  await setDoc(doc(ownerA.db, 'documents', ownClientDocumentId), {
    organizationId: orgA,
    category: 'client',
    relatedType: 'client',
    relatedId: clientA,
    name: 'Synthetic client document',
    createdBy: ownerA.user.uid,
  });
  check((await getDoc(doc(ownerA.db, 'documents', ownClientDocumentId))).exists(),
    'a document can reference a client in its own organization');
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'documents', 'rules-document-cross-client-' + randomUUID()), {
      organizationId: orgA,
      category: 'client',
      relatedType: 'client',
      relatedId: clientB,
      name: 'Invalid cross-organization client document',
      createdBy: ownerA.user.uid,
    }),
    'a document cannot reference a client from another organization',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'documents', 'rules-document-missing-claim-' + randomUUID()), {
      organizationId: orgA,
      category: 'claim',
      relatedType: 'claim',
      relatedId: 'missing-document-claim-' + randomUUID(),
      name: 'Invalid missing-claim document',
      createdBy: ownerA.user.uid,
    }),
    'a document cannot reference a nonexistent claim',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'documents', 'rules-document-unlinked-policy-' + randomUUID()), {
      organizationId: orgA,
      category: 'policy',
      relatedType: 'policy',
      name: 'Invalid unlinked policy document',
      createdBy: ownerA.user.uid,
    }),
    'a typed document relationship must include its parent ID',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'documents', ownClientDocumentId), {
      relatedId: clientB,
    }),
    'a document cannot be relinked to a client from another organization',
  );
  await updateDoc(doc(ownerA.db, 'documents', ownClientDocumentId), { name: 'Updated synthetic document' });
  check(
    (await getDoc(doc(ownerA.db, 'documents', ownClientDocumentId))).data().relatedId === clientA,
    'a document can update its name while preserving its valid parent relationship',
  );
  const generalDocumentId = 'rules-document-general-' + randomUUID();
  await setDoc(doc(ownerA.db, 'documents', generalDocumentId), {
    organizationId: orgA,
    category: 'other',
    relatedType: 'general',
    relatedId: '',
    name: 'Synthetic general document',
    createdBy: ownerA.user.uid,
  });
  check((await getDoc(doc(ownerA.db, 'documents', generalDocumentId))).exists(),
    'a general document can remain unlinked');

  await expectDenied(
    () => setDoc(doc(ownerA.db, 'rfqs', 'rules-rfq-cross-client-' + randomUUID()), {
      organizationId: orgA,
      clientId: clientB,
      insurerIds: [],
      createdBy: ownerA.user.uid,
    }),
    'an RFQ cannot reference a client from another organization',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'leads', 'rules-lead-cross-client-' + randomUUID()), {
      organizationId: orgA,
      name: 'Cross-organization lead client',
      assignedTo: ownerA.user.uid,
      clientId: clientB,
      createdBy: ownerA.user.uid,
    }),
    'a lead cannot reference a client from another organization',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'policies', 'rules-policy-cross-client-' + randomUUID()), {
      organizationId: orgA,
      clientId: clientB,
      policyNumber: 'SYNTHETIC-CROSS-ORG-CLIENT',
      createdBy: ownerA.user.uid,
    }),
    'a policy cannot reference a client from another organization',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'policies', 'rules-policy-nonexistent-client-' + randomUUID()), {
      organizationId: orgA,
      clientId: 'missing-policy-client-' + randomUUID(),
      policyNumber: 'SYNTHETIC-MISSING-CLIENT',
      createdBy: ownerA.user.uid,
    }),
    'a policy cannot reference a nonexistent client',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'policies', ownRelations.policy), {
      clientId: clientB,
      updatedAt: serverTimestamp(),
    }),
    'a policy cannot be updated to a client from another organization',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'policies', ownRelations.policy), {
      clientId: 'missing-policy-client-' + randomUUID(),
      updatedAt: serverTimestamp(),
    }),
    'a policy cannot be updated to a nonexistent client',
  );
  await updateDoc(doc(ownerA.db, 'policies', ownRelations.policy), {
    status: 'active',
    updatedAt: serverTimestamp(),
  });
  check(
    (await getDoc(doc(ownerA.db, 'policies', ownRelations.policy))).data().clientId === clientA,
    'a policy can update unrelated fields while preserving its valid client relationship',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'leads', 'rules-lead-nonexistent-client-' + randomUUID()), {
      organizationId: orgA,
      name: 'Nonexistent lead client',
      assignedTo: ownerA.user.uid,
      clientId: 'missing-lead-client-' + randomUUID(),
      createdBy: ownerA.user.uid,
    }),
    'a lead cannot reference a nonexistent client',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'leads', ownRelations.lead), {
      clientId: clientB,
      updatedAt: serverTimestamp(),
    }),
    'a lead cannot be updated to a client from another organization',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'leads', ownRelations.lead), {
      clientId: 'missing-lead-client-' + randomUUID(),
      updatedAt: serverTimestamp(),
    }),
    'a lead cannot be updated to a nonexistent client',
  );
  const convertingLead = 'rules-lead-transactional-client-' + randomUUID();
  await setDoc(doc(ownerA.db, 'leads', convertingLead), {
    organizationId: orgA,
    name: 'Synthetic converting lead',
    assignedTo: ownerA.user.uid,
    createdBy: ownerA.user.uid,
  });
  const convertedClient = 'rules-client-from-lead-' + randomUUID();
  const conversionBatch = writeBatch(ownerA.db);
  conversionBatch.set(doc(ownerA.db, 'clients', convertedClient), {
    organizationId: orgA,
    name: 'Synthetic converted client',
    assignedTo: ownerA.user.uid,
    sourceLeadId: convertingLead,
    createdBy: ownerA.user.uid,
  });
  conversionBatch.update(doc(ownerA.db, 'leads', convertingLead), {
    clientId: convertedClient,
    updatedAt: serverTimestamp(),
  });
  await conversionBatch.commit();
  check(
    (await getDoc(doc(ownerA.db, 'leads', convertingLead))).data().clientId === convertedClient,
    'a lead can link to a same-organization client created in the same batch',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'rfqs', 'rules-rfq-missing-client-' + randomUUID()), {
      organizationId: orgA,
      insurerIds: [],
      createdBy: ownerA.user.uid,
    }),
    'an RFQ must include its client parent ID',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'rfqs', 'rules-rfq-nonexistent-client-' + randomUUID()), {
      organizationId: orgA,
      clientId: 'missing-rfq-client-' + randomUUID(),
      insurerIds: [],
      createdBy: ownerA.user.uid,
    }),
    'an RFQ cannot reference a nonexistent client',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'rfqs', 'rules-rfq-cross-lead-' + randomUUID()), {
      organizationId: orgA,
      clientId: clientA,
      leadId: foreignRelations.lead,
      insurerIds: [],
      createdBy: ownerA.user.uid,
    }),
    'an RFQ cannot reference a lead from another organization',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'rfqs', 'rules-rfq-mismatched-lead-' + randomUUID()), {
      organizationId: orgA,
      clientId: clientA,
      leadId: ownRelations.otherClientLead,
      insurerIds: [],
      createdBy: ownerA.user.uid,
    }),
    'an RFQ cannot reference a same-organization lead linked to another client',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'rfqs', 'rules-rfq-nonexistent-lead-' + randomUUID()), {
      organizationId: orgA,
      clientId: clientA,
      leadId: 'missing-rfq-lead-' + randomUUID(),
      insurerIds: [],
      createdBy: ownerA.user.uid,
    }),
    'an RFQ cannot reference a nonexistent lead',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'rfqs', ownRelations.rfq), {
      clientId: ownAlternateClient,
      updatedAt: serverTimestamp(),
    }),
    'an RFQ cannot be updated to a client that does not match its linked lead',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'rfqs', ownRelations.rfq), {
      clientId: 'missing-rfq-client-' + randomUUID(),
      updatedAt: serverTimestamp(),
    }),
    'an RFQ cannot be updated to a nonexistent client',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'rfqs', ownRelations.rfq), {
      leadId: foreignRelations.lead,
      updatedAt: serverTimestamp(),
    }),
    'an RFQ cannot be updated to a lead from another organization',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'rfqs', ownRelations.rfq), {
      leadId: 'missing-rfq-lead-' + randomUUID(),
      updatedAt: serverTimestamp(),
    }),
    'an RFQ cannot be updated to a nonexistent lead',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'rfqs', ownRelations.rfq), {
      leadId: ownRelations.otherClientLead,
      updatedAt: serverTimestamp(),
    }),
    'an RFQ cannot be updated to a lead linked to another client',
  );
  await updateDoc(doc(ownerA.db, 'rfqs', ownRelations.rfq), {
    status: 'ready',
    updatedAt: serverTimestamp(),
  });
  const preservedRfq = (await getDoc(doc(ownerA.db, 'rfqs', ownRelations.rfq))).data();
  check(
    preservedRfq.status === 'ready'
      && preservedRfq.clientId === clientA
      && preservedRfq.leadId === ownRelations.lead,
    'an RFQ can update workflow fields while preserving its valid client and lead relationships',
  );

  await expectDenied(
    () => setDoc(doc(ownerA.db, 'leads', 'rules-lead-cross-assignee-' + randomUUID()), {
      organizationId: orgA,
      name: 'Cross-organization lead assignee',
      assignedTo: ownerB.user.uid,
      createdBy: ownerA.user.uid,
    }),
    'a lead cannot be assigned to a user from another organization',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'leads', ownRelations.lead), {
      assignedTo: ownerB.user.uid,
      updatedAt: serverTimestamp(),
    }),
    'a lead cannot be updated to an assignee from another organization',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'leads', 'rules-lead-missing-assignee-' + randomUUID()), {
      organizationId: orgA,
      name: 'Nonexistent lead assignee',
      assignedTo: 'missing-lead-assignee-' + randomUUID(),
      createdBy: ownerA.user.uid,
    }),
    'a lead cannot be assigned to a nonexistent user',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'leads', ownRelations.lead), {
      assignedTo: 'missing-user-' + randomUUID(),
      updatedAt: serverTimestamp(),
    }),
    'a lead cannot be updated to a nonexistent assignee',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'leads', ownRelations.lead), {
      name: 'Unexpected lead name change',
      updatedAt: serverTimestamp(),
    }),
    'lead updates cannot change fields outside the approved workflow allowlist',
  );
  await updateDoc(doc(ownerA.db, 'leads', ownRelations.lead), {
    notes: 'Updated synthetic lead',
    updatedAt: serverTimestamp(),
  });
  const preservedLead = (await getDoc(doc(ownerA.db, 'leads', ownRelations.lead))).data();
  check(
    preservedLead.assignedTo === ownerA.user.uid
      && preservedLead.clientId === clientA
      && preservedLead.notes === 'Updated synthetic lead',
    'a lead can update other fields while preserving its valid client relationship and assignee',
  );

  const linkedTask = 'rules-task-client-' + randomUUID();
  await setDoc(doc(ownerA.db, 'tasks', linkedTask), {
    organizationId: orgA,
    title: 'Same-organization client task',
    status: 'open',
    relatedType: 'client',
    relatedId: clientA,
    assignedTo: '',
    createdBy: ownerA.user.uid,
  });
  check((await getDoc(doc(ownerA.db, 'tasks', linkedTask))).exists(),
    'a task can reference a client in its own organization');
  await updateDoc(doc(ownerA.db, 'tasks', linkedTask), {
    assignedTo: ownerA.user.uid,
    updatedAt: serverTimestamp(),
  });
  check((await getDoc(doc(ownerA.db, 'tasks', linkedTask))).data().assignedTo === ownerA.user.uid,
    'a task can be assigned to an active user in its own organization');
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'tasks', 'rules-task-cross-assignee-' + randomUUID()), {
      organizationId: orgA,
      title: 'Cross-organization assignee task',
      status: 'open',
      assignedTo: ownerB.user.uid,
      createdBy: ownerA.user.uid,
    }),
    'a task cannot be assigned to a user from another organization',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'tasks', 'rules-task-missing-assignee-' + randomUUID()), {
      organizationId: orgA,
      title: 'Nonexistent assignee task',
      status: 'open',
      assignedTo: 'missing-user-' + randomUUID(),
      createdBy: ownerA.user.uid,
    }),
    'a task cannot be assigned to a nonexistent user',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'tasks', linkedTask), {
      assignedTo: ownerB.user.uid,
      updatedAt: serverTimestamp(),
    }),
    'a task cannot be updated to an assignee from another organization',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'tasks', linkedTask), {
      assignedTo: 'missing-user-' + randomUUID(),
      updatedAt: serverTimestamp(),
    }),
    'a task cannot be updated to a nonexistent assignee',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'tasks', 'rules-task-cross-client-' + randomUUID()), {
      organizationId: orgA,
      title: 'Cross-organization client task',
      status: 'open',
      relatedType: 'client',
      relatedId: clientB,
      createdBy: ownerA.user.uid,
    }),
    'a task cannot reference a client from another organization',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'tasks', linkedTask), {
      relatedId: clientB,
      updatedAt: serverTimestamp(),
    }),
    'a task cannot be updated to reference a client from another organization',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'tasks', 'rules-task-invalid-relation-' + randomUUID()), {
      organizationId: orgA,
      title: 'Unsupported relation task',
      status: 'open',
      relatedType: 'unsupported',
      relatedId: clientA,
      createdBy: ownerA.user.uid,
    }),
    'a task cannot use an unsupported related record type',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'tasks', linkedTask), {
      relatedType: 'unsupported',
      updatedAt: serverTimestamp(),
    }),
    'a task cannot be updated to use an unsupported related record type',
  );
  await updateDoc(doc(ownerA.db, 'tasks', linkedTask), {
    status: 'in_progress',
    description: 'Unrelated task fields can change without rewriting its relationship',
    updatedAt: serverTimestamp(),
  });
  const preservedTask = (await getDoc(doc(ownerA.db, 'tasks', linkedTask))).data();
  check(
    preservedTask.status === 'in_progress'
      && preservedTask.relatedType === 'client'
      && preservedTask.relatedId === clientA
      && preservedTask.assignedTo === ownerA.user.uid,
    'a task can update workflow fields while preserving its valid parent relationship and assignee',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'claims', 'rules-claim-cross-client-' + randomUUID()), {
      organizationId: orgA,
      clientId: clientB,
      policyId: ownRelations.policy,
      claimNumber: 'SYNTHETIC-CROSS-CLIENT',
      createdBy: ownerA.user.uid,
    }),
    'a claim cannot reference a client from another organization',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'claims', 'rules-claim-cross-policy-' + randomUUID()), {
      organizationId: orgA,
      clientId: clientA,
      policyId: foreignRelations.policy,
      claimNumber: 'SYNTHETIC-CROSS-POLICY',
      createdBy: ownerA.user.uid,
    }),
    'a claim cannot reference a policy from another organization',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'claims', 'rules-claim-missing-client-' + randomUUID()), {
      organizationId: orgA,
      policyId: ownRelations.policy,
      claimNumber: 'SYNTHETIC-MISSING-CLIENT',
      createdBy: ownerA.user.uid,
    }),
    'a claim must include its client parent ID',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'claims', 'rules-claim-missing-policy-' + randomUUID()), {
      organizationId: orgA,
      clientId: clientA,
      claimNumber: 'SYNTHETIC-MISSING-POLICY',
      createdBy: ownerA.user.uid,
    }),
    'a claim must include its policy parent ID',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'claims', 'rules-claim-nonexistent-client-' + randomUUID()), {
      organizationId: orgA,
      clientId: 'missing-client-' + randomUUID(),
      policyId: ownRelations.policy,
      claimNumber: 'SYNTHETIC-NONEXISTENT-CLIENT',
      createdBy: ownerA.user.uid,
    }),
    'a claim cannot reference a nonexistent client',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'claims', 'rules-claim-nonexistent-policy-' + randomUUID()), {
      organizationId: orgA,
      clientId: clientA,
      policyId: 'missing-policy-' + randomUUID(),
      claimNumber: 'SYNTHETIC-NONEXISTENT-POLICY',
      createdBy: ownerA.user.uid,
    }),
    'a claim cannot reference a nonexistent policy',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'claims', 'rules-claim-mismatched-client-' + randomUUID()), {
      organizationId: orgA,
      clientId: clientA,
      policyId: ownRelations.otherClientPolicy,
      claimNumber: 'SYNTHETIC-MISMATCHED-PARENT',
      createdBy: ownerA.user.uid,
    }),
    'a claim cannot reference a policy linked to a different client',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'claims', ownRelations.claim), {
      clientId: clientB,
      updatedAt: serverTimestamp(),
    }),
    'a claim cannot be updated to a client from another organization',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'claims', ownRelations.claim), {
      policyId: foreignRelations.policy,
      updatedAt: serverTimestamp(),
    }),
    'a claim cannot be updated to a policy from another organization',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'claims', ownRelations.claim), {
      policyId: ownRelations.otherClientPolicy,
      updatedAt: serverTimestamp(),
    }),
    'a claim cannot be updated to a same-organization policy linked to another client',
  );
  await updateDoc(doc(ownerA.db, 'claims', ownRelations.claim), {
    status: 'review',
    updatedAt: serverTimestamp(),
  });
  check((await getDoc(doc(ownerA.db, 'claims', ownRelations.claim))).data().status === 'review',
    'a claim can update its workflow state without changing parent relationships');
  const taskRelations = [
    { type: 'claim', ownId: ownRelations.claim, foreignId: foreignRelations.claim },
    { type: 'policy', ownId: ownRelations.policy, foreignId: foreignRelations.policy },
    { type: 'renewal', ownId: ownRelations.policy, foreignId: foreignRelations.policy },
    { type: 'lead', ownId: ownRelations.lead, foreignId: foreignRelations.lead },
    { type: 'rfq', ownId: ownRelations.rfq, foreignId: foreignRelations.rfq },
  ];
  for (const relation of taskRelations) {
    const taskRef = doc(ownerA.db, 'tasks', 'rules-task-' + relation.type + '-' + randomUUID());
    await setDoc(taskRef, {
      organizationId: orgA,
      title: 'Same-organization ' + relation.type + ' task',
      status: 'open',
      relatedType: relation.type,
      relatedId: relation.ownId,
      createdBy: ownerA.user.uid,
    });
    check((await getDoc(taskRef)).exists(),
      'a task can reference its own organization ' + relation.type);
    await expectDenied(
      () => setDoc(doc(ownerA.db, 'tasks', 'rules-task-cross-' + relation.type + '-' + randomUUID()), {
        organizationId: orgA,
        title: 'Cross-organization ' + relation.type + ' task',
        status: 'open',
        relatedType: relation.type,
        relatedId: relation.foreignId,
        createdBy: ownerA.user.uid,
      }),
      'a task cannot reference a ' + relation.type + ' from another organization',
    );
    await expectDenied(
      () => setDoc(doc(ownerA.db, 'tasks', 'rules-task-unlinked-' + relation.type + '-' + randomUUID()), {
        organizationId: orgA,
        title: 'Unlinked ' + relation.type + ' task',
        status: 'open',
        relatedType: relation.type,
        createdBy: ownerA.user.uid,
      }),
      'a ' + relation.type + ' task must include its related record ID',
    );
    await expectDenied(
      () => setDoc(doc(ownerA.db, 'tasks', 'rules-task-nonexistent-' + relation.type + '-' + randomUUID()), {
        organizationId: orgA,
        title: 'Nonexistent-parent ' + relation.type + ' task',
        status: 'open',
        relatedType: relation.type,
        relatedId: 'missing-' + relation.type + '-' + randomUUID(),
        createdBy: ownerA.user.uid,
      }),
      'a ' + relation.type + ' task cannot reference a nonexistent parent',
    );
    await expectDenied(
      () => updateDoc(taskRef, {
        relatedId: relation.foreignId,
        updatedAt: serverTimestamp(),
      }),
      'a task cannot be updated to reference a ' + relation.type + ' from another organization',
    );
    await expectDenied(
      () => updateDoc(taskRef, {
        relatedId: 'missing-' + relation.type + '-' + randomUUID(),
        updatedAt: serverTimestamp(),
      }),
      'a task cannot be updated to reference a nonexistent ' + relation.type + ' parent',
    );
  }

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
  await acceptMemberViaInvitation(
    ownerA,
    orgA,
    'forged-invited-broker',
    'broker',
    {
      membershipExtras: {
        clientSensitiveCapabilities: ['client.sensitive.read.medical'],
      },
      expectCommitDenied: true,
    },
  );
  const brokerMember = await acceptMemberViaInvitation(ownerA, orgA, 'invited-broker', 'broker');
  const roleChangeMember = await acceptMemberViaInvitation(ownerA, orgA, 'role-change-member', 'broker');
  const roleChangeUid = roleChangeMember.actor.user.uid;
  const memberRoleUpdate = writeBatch(ownerA.db);
  memberRoleUpdate.update(doc(ownerA.db, 'users', roleChangeUid), {
    role: 'claims',
    status: 'active',
    updatedAt: serverTimestamp(),
  });
  memberRoleUpdate.update(doc(ownerA.db, 'organizations', orgA, 'members', roleChangeUid), {
    role: 'claims',
    status: 'active',
    updatedAt: serverTimestamp(),
  });
  await memberRoleUpdate.commit();
  check(
    (await getDoc(doc(ownerA.db, 'users', roleChangeUid))).data().role === 'claims'
      && (await getDoc(doc(ownerA.db, 'organizations', orgA, 'members', roleChangeUid))).data().role === 'claims',
    'owner can update member profile and organization membership role atomically',
  );
  await expectDenied(
    () => updateDoc(
      doc(ownerA.db, 'organizations', orgA, 'members', brokerMember.actor.user.uid),
      { clientSensitiveCapabilities: ['client.sensitive.read.medical'] },
    ),
    'tenant administrators cannot add trusted capability fields to an existing membership',
  );
  const salesMember = await acceptMemberViaInvitation(ownerA, orgA, 'invited-sales', 'sales');
  const claimsMember = await acceptMemberViaInvitation(ownerA, orgA, 'invited-claims', 'claims');
  const financeMember = await acceptMemberViaInvitation(ownerA, orgA, 'invited-finance', 'finance');
  const staffMember = await acceptMemberViaInvitation(ownerA, orgA, 'invited-staff', 'staff');
  const adminMember = await acceptMemberViaInvitation(ownerA, orgA, 'invited-admin', 'admin');
  const inactiveAssignee = await acceptMemberViaInvitation(ownerA, orgA, 'inactive-assignee', 'staff');
  const disableAssignee = writeBatch(ownerA.db);
  disableAssignee.update(doc(ownerA.db, 'users', inactiveAssignee.actor.user.uid), {
    status: 'disabled',
    updatedAt: serverTimestamp(),
  });
  disableAssignee.update(doc(ownerA.db, 'organizations', orgA, 'members', inactiveAssignee.actor.user.uid), {
    status: 'disabled',
    updatedAt: serverTimestamp(),
  });
  await disableAssignee.commit();
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'tasks', 'rules-task-inactive-assignee-' + randomUUID()), {
      organizationId: orgA,
      title: 'Inactive assignee task',
      status: 'open',
      assignedTo: inactiveAssignee.actor.user.uid,
      createdBy: ownerA.user.uid,
    }),
    'a task cannot be assigned to an inactive user',
  );
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'tasks', linkedTask), {
      assignedTo: inactiveAssignee.actor.user.uid,
      updatedAt: serverTimestamp(),
    }),
    'a task cannot be reassigned to an inactive user',
  );

  // Phase 3 proposed sensitive collections remain closed until a dedicated,
  // collection-specific rules PR explicitly enables the approved role matrix.
  // This guards against accidentally adding them to the generic business allow-list.
  const defaultDenyCollections = [
    'clientSensitiveProfiles',
    'clientMedicalProfiles',
    'claimSensitiveDetails',
    'aiFindings',
    'auditLogs',
  ];
  const sensitiveCollectionActors = [
    { label: 'owner', actor: ownerA, organizationId: orgA },
    { label: 'admin', actor: adminMember.actor, organizationId: orgA },
    { label: 'broker', actor: brokerMember.actor, organizationId: orgA },
    { label: 'sales', actor: salesMember.actor, organizationId: orgA },
    { label: 'claims', actor: claimsMember.actor, organizationId: orgA },
    { label: 'finance', actor: financeMember.actor, organizationId: orgA },
    { label: 'staff', actor: staffMember.actor, organizationId: orgA },
    { label: 'foreign organization owner', actor: ownerB, organizationId: orgB },
  ];
  for (const collectionName of defaultDenyCollections) {
    for (const roleActor of sensitiveCollectionActors) {
      const candidateId = 'phase3-deny-' + randomUUID();
      await expectDenied(
        () => getDoc(doc(roleActor.actor.db, collectionName, candidateId)),
        roleActor.label + ' cannot read proposed sensitive collection ' + collectionName + ' before explicit rules exist',
      );
      await expectDenied(
        () => getDocs(query(
          collection(roleActor.actor.db, collectionName),
          where('organizationId', '==', roleActor.organizationId),
        )),
        roleActor.label + ' cannot query proposed sensitive collection ' + collectionName + ' before explicit rules exist',
      );
      await expectDenied(
        () => setDoc(doc(roleActor.actor.db, collectionName, candidateId), {
          organizationId: roleActor.organizationId,
          createdBy: roleActor.actor.user.uid,
          createdAt: serverTimestamp(),
          sensitivityClass: collectionName,
          syntheticFixture: true,
        }),
        roleActor.label + ' cannot create records in proposed sensitive collection ' + collectionName + ' before explicit rules exist',
      );
    }
  }


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
    clientName: 'RBAC fixture client', policyNumber: 'RBAC-POLICY',
    claimNumber: 'RBAC-CLAIM', status: 'review', createdBy: ownerA.user.uid, createdAt: serverTimestamp(),
  });
  const protectedClaimRef = doc(claimsMember.actor.db, 'claims', protectedClaimId);
  await updateDoc(protectedClaimRef, {
    status: 'approved',
    updatedAt: serverTimestamp(),
  });
  check((await getDoc(protectedClaimRef)).data().status === 'approved',
    'an authorized Claims role can transition claim status');

  await expectDenied(
    () => updateDoc(protectedClaimRef, {
      approvedAmount: 999999,
      updatedAt: serverTimestamp(),
    }),
    'claim updates cannot change approved financial amounts',
  );
  await expectDenied(
    () => updateDoc(protectedClaimRef, {
      clientId: 'forged-client-id',
      updatedAt: serverTimestamp(),
    }),
    'claim updates cannot change their original client relationship',
  );
  await expectDenied(
    () => updateDoc(protectedClaimRef, {
      description: 'Injected claim description',
      updatedAt: serverTimestamp(),
    }),
    'claim updates cannot change descriptive or unapproved fields',
  );

  const protectedClaimActivityId = 'rbac-claim-activity-' + randomUUID();
  const protectedClaimActivityRef = doc(claimsMember.actor.db, 'claimActivities', protectedClaimActivityId);
  await setDoc(protectedClaimActivityRef, {
    organizationId: orgA,
    claimId: protectedClaimId,
    type: 'status_change',
    title: 'Synthetic claim event',
    toStatus: 'approved',
    createdBy: claimsMember.actor.user.uid,
    createdAt: serverTimestamp(),
  });
  await expectDenied(
    () => updateDoc(protectedClaimActivityRef, { message: 'Tampered claim event' }),
    'claim activity history cannot be updated after creation',
  );
  await setDoc(doc(ownerA.db, 'leads', protectedLeadId), {
    organizationId: orgA, name: 'RBAC lead', stage: 'new',
    createdBy: ownerA.user.uid, createdAt: serverTimestamp(),
  });
  const protectedLeadSalesRef = doc(salesMember.actor.db, 'leads', protectedLeadId);
  await updateDoc(protectedLeadSalesRef, {
    stage: 'contacted',
    lastActivityAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  check((await getDoc(protectedLeadSalesRef)).data().stage === 'contacted',
    'Sales can move a lead to the next permitted stage');

  await updateDoc(protectedLeadSalesRef, {
    notes: 'Synthetic follow-up note',
    lastActivityAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  check((await getDoc(protectedLeadSalesRef)).data().notes === 'Synthetic follow-up note',
    'Sales can update lead notes without changing protected lead fields');

  await expectDenied(
    () => updateDoc(protectedLeadSalesRef, {
      stage: 'won',
      wonAt: serverTimestamp(),
      lastActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    'lead stage updates cannot skip required sales workflow stages',
  );
  await expectDenied(
    () => updateDoc(protectedLeadSalesRef, {
      clientId: protectedClientId,
      clientLinkedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    'Sales cannot attach a Client 360 record to a lead',
  );

  const protectedLeadBrokerRef = doc(brokerMember.actor.db, 'leads', protectedLeadId);
  await updateDoc(protectedLeadBrokerRef, {
    clientId: protectedClientId,
    clientLinkedAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  check((await getDoc(protectedLeadBrokerRef)).data().clientId === protectedClientId,
    'Broker can link a lead to an existing same-tenant Client 360 record');

  const protectedLeadActivityId = 'rbac-lead-activity-' + randomUUID();
  const protectedLeadActivityRef = doc(salesMember.actor.db, 'leadActivities', protectedLeadActivityId);
  await setDoc(protectedLeadActivityRef, {
    organizationId: orgA,
    leadId: protectedLeadId,
    type: 'stage_changed',
    message: 'Synthetic lead history',
    createdBy: salesMember.actor.user.uid,
    createdAt: serverTimestamp(),
  });
  await expectDenied(
    () => updateDoc(protectedLeadActivityRef, { createdBy: ownerA.user.uid + '-forged' }),
    'lead activity creator identity cannot be changed after creation',
  );
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

  // Additional tenant-scoped fixtures for the complete role/read matrix.
  const protectedRfqId = 'rbac-rfq-' + randomUUID();
  const protectedQuoteId = 'rbac-quote-' + randomUUID();
  const protectedInsurerId = 'rbac-insurer-' + randomUUID();
  const protectedMatrixOperationId = 'rbac-operation-' + randomUUID();
  const foreignOperationId = 'rbac-foreign-operation-' + randomUUID();
  const protectedNotificationId = 'rbac-notification-' + randomUUID();
  const protectedExpenseId = 'rbac-expense-' + randomUUID();
  const protectedCommissionId = 'rbac-commission-' + randomUUID();

  await setDoc(doc(ownerA.db, 'rfqs', protectedRfqId), {
    organizationId: orgA, clientId: protectedClientId, insurerIds: [protectedInsurerId], status: 'draft',
    createdBy: ownerA.user.uid, createdAt: serverTimestamp(),
  });
  const protectedRfqRef = doc(salesMember.actor.db, 'rfqs', protectedRfqId);
  await updateDoc(protectedRfqRef, {
    status: 'ready',
    updatedAt: serverTimestamp(),
  });
  check((await getDoc(protectedRfqRef)).data().status === 'ready',
    'Sales can update an RFQ workflow status');

  await updateDoc(protectedRfqRef, {
    insuranceType: 'medical',
    coverageSummary: 'Synthetic coverage summary',
    documentIds: ['synthetic-doc-1'],
    insurers: [{ insurerId: protectedInsurerId, insurerName: 'Synthetic Insurer', status: 'draft' }],
    insurerIds: [protectedInsurerId],
    updatedAt: serverTimestamp(),
  });
  check((await getDoc(protectedRfqRef)).data().coverageSummary === 'Synthetic coverage summary',
    'RFQ details and insurer submission metadata can be updated through approved fields');

  await updateDoc(protectedRfqRef, {
    status: 'quotes_received',
    selectedQuoteId: protectedQuoteId,
    selectedInsurerId: protectedInsurerId,
    updatedAt: serverTimestamp(),
  });
  check((await getDoc(protectedRfqRef)).data().selectedQuoteId === protectedQuoteId,
    'the quote-selection workflow can attach its selected quote and insurer');

  await updateDoc(protectedRfqRef, {
    status: 'closed',
    issuedPolicyId: 'synthetic-policy-1',
    updatedAt: serverTimestamp(),
  });
  check((await getDoc(protectedRfqRef)).data().issuedPolicyId === 'synthetic-policy-1',
    'the issuance workflow can close an RFQ with its resulting policy reference');

  await expectDenied(
    () => updateDoc(protectedRfqRef, {
      clientId: 'forged-client-id',
      updatedAt: serverTimestamp(),
    }),
    'RFQ updates cannot change the original client relationship',
  );
  await expectDenied(
    () => updateDoc(protectedRfqRef, {
      leadId: 'forged-lead-id',
      updatedAt: serverTimestamp(),
    }),
    'RFQ updates cannot change the original lead relationship',
  );
  await expectDenied(
    () => updateDoc(protectedRfqRef, {
      clientName: 'Forged client name',
      updatedAt: serverTimestamp(),
    }),
    'RFQ updates cannot modify immutable client identity fields',
  );
  await expectDenied(
    () => updateDoc(protectedRfqRef, {
      status: 'unknown_status',
      updatedAt: serverTimestamp(),
    }),
    'RFQ updates reject unknown workflow states',
  );
  await setDoc(doc(ownerA.db, 'quotes', protectedQuoteId), {
    organizationId: orgA, rfqId: protectedRfqId, clientId: protectedClientId,
    insurerId: protectedInsurerId, insurerName: 'Synthetic Insurer', premium: 1200,
    commissionRate: 10, commissionAmount: 120, currency: 'EGP', validUntil: '2026-11-30', status: 'received',
    createdBy: ownerA.user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  await setDoc(doc(ownerA.db, 'insurers', protectedInsurerId), {
    organizationId: orgA, name: 'Synthetic Insurer', status: 'active',
    createdBy: ownerA.user.uid, createdAt: serverTimestamp(),
  });
  await setDoc(doc(ownerA.db, 'operations', protectedMatrixOperationId), {
    organizationId: orgA, kind: 'policy_issuance', status: 'request',
    createdBy: ownerA.user.uid, createdAt: serverTimestamp(),
  });
  await setDoc(doc(ownerB.db, 'operations', foreignOperationId), {
    organizationId: orgB, kind: 'policy_issuance', status: 'request',
    createdBy: ownerB.user.uid, createdAt: serverTimestamp(),
  });

  const protectedOperationRef = doc(brokerMember.actor.db, 'operations', protectedMatrixOperationId);
  await updateDoc(protectedOperationRef, {
    status: 'data_collection',
    updatedAt: serverTimestamp(),
  });
  check((await getDoc(protectedOperationRef)).data().status === 'data_collection',
    'an authorized operations role can update a workflow status');

  await updateDoc(protectedOperationRef, {
    quoteDocumentId: 'synthetic-quote-doc-1',
    quoteDocumentName: 'synthetic-quote.pdf',
    insurerId: protectedInsurerId,
    premium: 1200,
    currency: 'EGP',
    approvalReason: 'Synthetic approval reason',
    updatedAt: serverTimestamp(),
  });
  check((await getDoc(protectedOperationRef)).data().quoteDocumentId === 'synthetic-quote-doc-1',
    'the quote handoff can update only its approved operation reference fields');

  await updateDoc(protectedOperationRef, {
    status: 'completed',
    policyId: 'synthetic-policy-1',
    policyNumber: 'SYN-POL-001',
    policyDocumentId: 'synthetic-policy-document-1',
    completedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
  });
  check((await getDoc(protectedOperationRef)).data().policyId === 'synthetic-policy-1',
    'policy completion can attach only its approved policy reference fields');

  await expectDenied(
    () => updateDoc(protectedOperationRef, {
      clientId: 'forged-client-id',
      updatedAt: serverTimestamp(),
    }),
    'operations cannot change the original client relationship',
  );
  await expectDenied(
    () => updateDoc(protectedOperationRef, {
      notes: 'Injected operation note',
      updatedAt: serverTimestamp(),
    }),
    'operations updates cannot change unrestricted notes or unapproved fields',
  );

  const protectedOperationEventId = 'rbac-operation-event-' + randomUUID();
  const protectedOperationEventRef = doc(ownerA.db, 'operationEvents', protectedOperationEventId);
  await setDoc(protectedOperationEventRef, {
    organizationId: orgA,
    operationId: protectedMatrixOperationId,
    action: 'created',
    note: 'Synthetic immutable event',
    createdBy: ownerA.user.uid,
    createdAt: serverTimestamp(),
  });
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'operationEvents', 'rbac-operation-event-cross-org-' + randomUUID()), {
      organizationId: orgA,
      operationId: foreignOperationId,
      action: 'forged',
      createdBy: ownerA.user.uid,
      createdAt: serverTimestamp(),
    }),
    'an operation event cannot reference an operation from another organization',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'operationEvents', 'rbac-operation-event-missing-' + randomUUID()), {
      organizationId: orgA,
      operationId: 'missing-operation-' + randomUUID(),
      action: 'orphaned',
      createdBy: ownerA.user.uid,
      createdAt: serverTimestamp(),
    }),
    'an operation event cannot reference a nonexistent operation',
  );
  await expectDenied(
    () => updateDoc(doc(brokerMember.actor.db, 'operationEvents', protectedOperationEventId), {
      note: 'Tampered event history',
    }),
    'operation events cannot be updated after creation',
  );
  await setDoc(doc(ownerA.db, 'notifications', protectedNotificationId), {
    organizationId: orgA, title: 'Synthetic role test notification',
    message: 'No customer data', type: 'task', read: false,
    createdBy: ownerA.user.uid, createdAt: serverTimestamp(),
  });
  await setDoc(doc(ownerA.db, 'expenses', protectedExpenseId), {
    organizationId: orgA, amount: 250, category: 'test',
    status: 'pending', currency: 'EGP', createdBy: ownerA.user.uid, createdAt: serverTimestamp(),
  });
  await setDoc(doc(ownerA.db, 'commissions', protectedCommissionId), {
    organizationId: orgA, commissionAmount: 125, status: 'pending',
    currency: 'EGP', createdBy: ownerA.user.uid, createdAt: serverTimestamp(),
  });

  const protectedTimelineId = 'rbac-client-timeline-' + randomUUID();
  await setDoc(doc(ownerA.db, 'clients', protectedClientId, 'timeline', protectedTimelineId), {
    organizationId: orgA,
    clientId: protectedClientId,
    type: 'created',
    title: 'Synthetic Client Timeline Event',
    by: ownerA.user.uid,
    at: serverTimestamp(),
  });

  await expectDenied(
    () => setDoc(doc(ownerA.db, 'clients', protectedClientId, 'timeline', 'forged-org-' + randomUUID()), {
      organizationId: orgB,
      clientId: protectedClientId,
      type: 'note',
      title: 'Synthetic forged tenant event',
      by: ownerA.user.uid,
      at: serverTimestamp(),
    }),
    'timeline event cannot claim a different organization from its parent client',
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'clients', protectedClientId, 'timeline', 'forged-client-' + randomUUID()), {
      organizationId: orgA,
      clientId: 'another-client',
      type: 'note',
      title: 'Synthetic forged client event',
      by: ownerA.user.uid,
      at: serverTimestamp(),
    }),
    'timeline event clientId must match its parent client path',
  );

  // Explicit read matrix: every allowed and denied path is exercised both by
  // known document ID and by a tenant-scoped query against the Firestore Rules Emulator.
  const roleActors = {
    owner: ownerA,
    admin: adminMember.actor,
    broker: brokerMember.actor,
    sales: salesMember.actor,
    claims: claimsMember.actor,
    finance: financeMember.actor,
    staff: staffMember.actor,
  };
  const readCases = [
    { collection: 'clients', id: protectedClientId, allowed: ['owner', 'admin', 'broker'] },
    { collection: 'policies', id: protectedPolicyId, allowed: ['owner', 'admin', 'broker', 'claims'] },
    { collection: 'claims', id: protectedClaimId, allowed: ['owner', 'admin', 'broker', 'claims'] },
    { collection: 'leads', id: protectedLeadId, allowed: ['owner', 'admin', 'broker', 'sales'] },
    { collection: 'tasks', id: protectedTaskId, allowed: ['owner', 'admin', 'broker', 'sales', 'claims', 'finance', 'staff'] },
    { collection: 'rfqs', id: protectedRfqId, allowed: ['owner', 'admin', 'broker', 'sales'] },
    { collection: 'quotes', id: protectedQuoteId, allowed: ['owner', 'admin', 'broker', 'sales'] },
    { collection: 'insurers', id: protectedInsurerId, allowed: ['owner', 'admin', 'broker', 'sales', 'claims', 'finance', 'staff'] },
    { collection: 'operations', id: protectedMatrixOperationId, allowed: ['owner', 'admin', 'broker', 'claims'] },
    { collection: 'revenue', id: protectedRevenueId, allowed: ['owner', 'admin', 'finance'] },
    { collection: 'expenses', id: protectedExpenseId, allowed: ['owner', 'admin', 'finance'] },
    { collection: 'commissions', id: protectedCommissionId, allowed: ['owner', 'admin', 'finance'] },
    { collection: 'notifications', id: protectedNotificationId, allowed: ['owner', 'admin', 'broker', 'sales', 'claims', 'finance', 'staff'] },
  ];

  for (const testCase of readCases) {
    const allowedRoles = new Set(testCase.allowed);
    for (const [role, actor] of Object.entries(roleActors)) {
      const recordRef = doc(actor.db, testCase.collection, testCase.id);
      const queryRef = query(
        collection(actor.db, testCase.collection),
        where('organizationId', '==', orgA),
        limit(50),
      );
      if (allowedRoles.has(role)) {
        check((await getDoc(recordRef)).exists(),
          role + ' can read ' + testCase.collection + ' by known document ID');
        const querySnapshot = await getDocs(queryRef);
        check(querySnapshot.docs.some((item) => item.id === testCase.id),
          role + ' can query ' + testCase.collection + ' within its organization');
      } else {
        await expectDenied(
          () => getDoc(recordRef),
          role + ' cannot read ' + testCase.collection + ' by known document ID',
        );
        await expectDenied(
          () => getDocs(queryRef),
          role + ' cannot query ' + testCase.collection + ' in its organization',
        );
      }
    }
  }

  // Claims can access only claim-category document metadata; a broader query
  // would include identity/medical categories and must be rejected.
  check((await getDoc(doc(claimsMember.actor.db, 'documents', protectedClaimDocumentId))).exists(),
    'claims can read claim-category document metadata by ID');
  await expectDenied(
    () => getDocs(query(
      collection(claimsMember.actor.db, 'documents'),
      where('organizationId', '==', orgA),
      where('category', '==', 'identity'),
      limit(50),
    )),
    'claims cannot query identity-category document metadata',
  );
  await expectDenied(
    () => getDocs(query(
      collection(claimsMember.actor.db, 'documents'),
      where('organizationId', '==', orgA),
      limit(50),
    )),
    'claims cannot query mixed-category document metadata without a claim-category filter',
  );

  // Action-level checks complement read checks: each operational role can
  // create/update only the records assigned to its capability group.
  const salesCreatedLeadId = 'rbac-sales-created-lead-' + randomUUID();
  await setDoc(doc(salesMember.actor.db, 'leads', salesCreatedLeadId), {
    organizationId: orgA, name: 'Synthetic sales lead', stage: 'new',
    createdBy: salesMember.actor.user.uid, createdAt: serverTimestamp(),
  });
  check((await getDoc(doc(salesMember.actor.db, 'leads', salesCreatedLeadId))).exists(),
    'sales can create a lead in its own organization');
  const salesCreatedQuoteId = 'rbac-sales-created-quote-' + randomUUID();
  await setDoc(doc(salesMember.actor.db, 'quotes', salesCreatedQuoteId), {
    organizationId: orgA, rfqId: protectedRfqId, clientId: protectedClientId,
    insurerId: protectedInsurerId, insurerName: 'Synthetic Insurer', premium: 900,
    commissionRate: 5, commissionAmount: 45, currency: 'EGP', validUntil: '2026-11-30', status: 'received',
    createdBy: salesMember.actor.user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  check((await getDoc(doc(salesMember.actor.db, 'quotes', salesCreatedQuoteId))).exists(),
    'sales can record insurer quotes against an RFQ in its own organization');
  await updateDoc(doc(salesMember.actor.db, 'quotes', salesCreatedQuoteId), { status: 'shortlisted', updatedAt: serverTimestamp() });
  await expectDenied(
    () => updateDoc(doc(salesMember.actor.db, 'quotes', salesCreatedQuoteId), { premium: 1 }),
    'an insurer quote premium cannot be edited after it is recorded'
  );
  await expectDenied(
    () => setDoc(doc(salesMember.actor.db, 'quotes', 'rbac-unlisted-insurer-' + randomUUID()), {
      organizationId: orgA, rfqId: protectedRfqId, clientId: protectedClientId,
      insurerId: 'insurer-not-in-rfq', insurerName: 'Unlisted', premium: 900,
      commissionRate: 5, commissionAmount: 45, currency: 'EGP', validUntil: '2026-11-30', status: 'received',
      createdBy: salesMember.actor.user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }),
    'a quote cannot be recorded for an insurer outside the RFQ target list'
  );
  await expectDenied(
    () => updateDoc(doc(salesMember.actor.db, 'quotes', salesCreatedQuoteId), {
      status: 'issued', policyId: 'forged-policy', policyNumber: 'FORGED', issuedAt: serverTimestamp(),
    }),
    'a quote cannot be marked issued without its matching policy'
  );
  check((await getDoc(doc(salesMember.actor.db, 'quotes', salesCreatedQuoteId))).data().status === 'shortlisted',
    'sales can update a quote status within its own organization');

  const claimsCreatedClaimId = 'rbac-claims-created-claim-' + randomUUID();
  await setDoc(doc(claimsMember.actor.db, 'claims', claimsCreatedClaimId), {
    organizationId: orgA, clientId: protectedClientId, policyId: protectedPolicyId,
    claimNumber: 'RBAC-CLAIMS-CREATE', status: 'new',
    createdBy: claimsMember.actor.user.uid, createdAt: serverTimestamp(),
  });
  check((await getDoc(doc(claimsMember.actor.db, 'claims', claimsCreatedClaimId))).exists(),
    'claims can create a claim record in its own organization');
  const financeCreatedExpenseId = 'rbac-finance-created-expense-' + randomUUID();
  await setDoc(doc(financeMember.actor.db, 'expenses', financeCreatedExpenseId), {
    organizationId: orgA, amount: 75, category: 'test',
    currency: 'EGP', status: 'pending',
    createdBy: financeMember.actor.user.uid, createdAt: serverTimestamp(),
  });
  check((await getDoc(doc(financeMember.actor.db, 'expenses', financeCreatedExpenseId))).exists(),
    'finance can create an expense in its own organization');
  const staffCreatedTaskId = 'rbac-staff-created-task-' + randomUUID();
  await setDoc(doc(staffMember.actor.db, 'tasks', staffCreatedTaskId), {
    organizationId: orgA, title: 'Synthetic assigned task',
    status: 'open', createdBy: staffMember.actor.user.uid,
  });
  check((await getDoc(doc(staffMember.actor.db, 'tasks', staffCreatedTaskId))).exists(),
    'staff can create an operational task in its own organization');

  await expectDenied(
    () => setDoc(doc(salesMember.actor.db, 'policies', 'rbac-sales-forged-policy-' + randomUUID()), {
      organizationId: orgA, policyNumber: 'FORGED', createdBy: salesMember.actor.user.uid,
    }),
    'sales cannot create an insurance policy',
  );
  await expectDenied(
    () => setDoc(doc(financeMember.actor.db, 'claims', 'rbac-finance-forged-claim-' + randomUUID()), {
      organizationId: orgA, claimNumber: 'FORGED', createdBy: financeMember.actor.user.uid,
    }),
    'finance cannot create a claim',
  );
  await expectDenied(
    () => setDoc(doc(staffMember.actor.db, 'revenue', 'rbac-staff-forged-revenue-' + randomUUID()), {
      organizationId: orgA, amount: 999999, createdBy: staffMember.actor.user.uid,
    }),
    'staff cannot create financial records',
  );

  check((await getDoc(doc(brokerMember.actor.db, 'clients', protectedClientId))).exists(),
    'broker can read the organization client record');
  check((await getDoc(doc(brokerMember.actor.db, 'clients', protectedClientId, 'timeline', protectedTimelineId))).exists(),
    'broker can read the timeline of an authorized client');
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
  await expectDenied(
    () => getDoc(doc(claimsMember.actor.db, 'clients', protectedClientId)),
    'claims cannot read the legacy mixed-sensitivity client record by known document ID',
  );
  await expectDenied(
    () => getDocs(query(
      collection(claimsMember.actor.db, 'clients'),
      where('organizationId', '==', orgA),
      limit(50),
    )),
    'claims cannot query the legacy mixed-sensitivity clients collection',
  );
  await expectDenied(
    () => getDoc(doc(claimsMember.actor.db, 'clients', protectedClientId, 'timeline', protectedTimelineId)),
    'claims cannot read unrestricted Client 360 timeline events',
  );
  check((await getDoc(doc(claimsMember.actor.db, 'claims', protectedClaimId))).exists(),
    'claims role can read claim records in its own organization');
  check((await getDoc(doc(claimsMember.actor.db, 'policies', protectedPolicyId))).exists(),
    'claims role can read linked policy metadata within its organization');
  check((await getDoc(doc(claimsMember.actor.db, 'documents', protectedClaimDocumentId))).exists(),
    'claims retains access to claim-category document metadata without raw Client 360 access');
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
  const crossOrganizationAttachmentId = 'rbac-cross-org-attachment-' + randomUUID();
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'operationAttachments', crossOrganizationAttachmentId), {
      organizationId: orgA, operationId: foreignOperationId, name: 'invoice.pdf',
      uploadedBy: ownerA.user.uid, createdBy: ownerA.user.uid,
      storageProvider: 'supabase', storageKeyVersion: 2, storageBucket: 'insurnex-documents',
      storagePath: `organizations/${orgA}/operations/${foreignOperationId}/${crossOrganizationAttachmentId}-invoice.pdf`,
      downloadUrl: '', uploadState: 'pending',
    }),
    'an operation attachment cannot reference an operation from another organization',
  );
  const missingOperationAttachmentId = 'rbac-missing-operation-attachment-' + randomUUID();
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'operationAttachments', missingOperationAttachmentId), {
      organizationId: orgA, operationId: 'missing-operation-' + randomUUID(), name: 'invoice.pdf',
      uploadedBy: ownerA.user.uid, createdBy: ownerA.user.uid,
      storageProvider: 'supabase', storageKeyVersion: 2, storageBucket: 'insurnex-documents',
      storagePath: `organizations/${orgA}/operations/missing/${missingOperationAttachmentId}-invoice.pdf`,
      downloadUrl: '', uploadState: 'pending',
    }),
    'an operation attachment cannot reference a nonexistent operation',
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

  const invalidCopilotMessages = [
    {
      label: 'system-role Copilot messages are rejected',
      payload: {
        organizationId: orgA, userId: ownerA.user.uid, conversationId: ownerConversationId,
        role: 'system', content: 'Synthetic invalid role', createdAt: serverTimestamp(),
      },
    },
    {
      label: 'empty Copilot message content is rejected',
      payload: {
        organizationId: orgA, userId: ownerA.user.uid, conversationId: ownerConversationId,
        role: 'user', content: '', createdAt: serverTimestamp(),
      },
    },
    {
      label: 'oversized Copilot message content is rejected',
      payload: {
        organizationId: orgA, userId: ownerA.user.uid, conversationId: ownerConversationId,
        role: 'user', content: 'x'.repeat(8001), createdAt: serverTimestamp(),
      },
    },
    {
      label: 'Copilot messages cannot carry unexpected sensitive fields',
      payload: {
        organizationId: orgA, userId: ownerA.user.uid, conversationId: ownerConversationId,
        role: 'user', content: 'Synthetic allowlist test', createdAt: serverTimestamp(),
        medicalDetails: 'SYNTHETIC_PRIVATE_FIELD_SENTINEL',
      },
    },
  ];
  for (const invalidMessage of invalidCopilotMessages) {
    await expectDenied(
      () => setDoc(doc(ownerA.db, 'copilotMessages', 'rbac-invalid-message-' + randomUUID()), invalidMessage.payload),
      invalidMessage.label,
    );
  }

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
  const issuedPolicyId = 'rbac-issued-policy-' + randomUUID();
  const issuedPolicyNumber = 'RULES-ISSUED-' + randomUUID().slice(0, 8);
  const selectQuoteBatch = writeBatch(ownerA.db);
  selectQuoteBatch.update(doc(ownerA.db, 'rfqs', protectedRfqId), {
    selectedQuoteId: protectedQuoteId,
    selectedInsurerId: protectedInsurerId,
    updatedAt: serverTimestamp(),
  });
  selectQuoteBatch.update(doc(ownerA.db, 'quotes', protectedQuoteId), {
    status: 'selected',
    updatedAt: serverTimestamp(),
  });
  await selectQuoteBatch.commit();

  const issuePolicyBatch = writeBatch(ownerA.db);
  issuePolicyBatch.set(doc(ownerA.db, 'policies', issuedPolicyId), {
    policyId: issuedPolicyId,
    quoteId: protectedQuoteId,
    rfqId: protectedRfqId,
    clientId: protectedClientId,
    clientName: 'RBAC fixture client',
    insurerId: protectedInsurerId,
    insurerName: 'Synthetic Insurer',
    organizationId: orgA,
    policyNumber: issuedPolicyNumber,
    premium: 1200,
    commissionRate: 10,
    commissionAmount: 120,
    currency: 'EGP',
    status: 'active',
    createdBy: ownerA.user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  issuePolicyBatch.set(doc(ownerA.db, 'commissions', issuedPolicyId), {
    organizationId: orgA,
    policyId: issuedPolicyId,
    quoteId: protectedQuoteId,
    rfqId: protectedRfqId,
    clientId: protectedClientId,
    clientName: 'RBAC fixture client',
    insurerId: protectedInsurerId,
    insurerName: 'Synthetic Insurer',
    policyNumber: issuedPolicyNumber,
    premium: 1200,
    commissionRate: 10,
    commissionAmount: 120,
    currency: 'EGP',
    status: 'pending',
    source: 'policy_issuance',
    createdBy: ownerA.user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  issuePolicyBatch.update(doc(ownerA.db, 'quotes', protectedQuoteId), {
    status: 'issued',
    policyId: issuedPolicyId,
    policyNumber: issuedPolicyNumber,
    issuedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  issuePolicyBatch.update(doc(ownerA.db, 'rfqs', protectedRfqId), {
    status: 'closed',
    selectedQuoteId: protectedQuoteId,
    selectedInsurerId: protectedInsurerId,
    issuedPolicyId,
    updatedAt: serverTimestamp(),
  });
  await issuePolicyBatch.commit();
  check((await getDoc(doc(ownerA.db, 'policies', issuedPolicyId))).exists(),
    'a selected quote can be issued only with its matching policy and closed RFQ in one atomic write');
  check((await getDoc(doc(ownerA.db, 'commissions', issuedPolicyId))).data().source === 'policy_issuance',
    'policy issuance creates exactly one linked commission ledger row in the same atomic write');
  await expectDenied(
    () => getDoc(doc(brokerMember.actor.db, 'commissions', issuedPolicyId)),
    'broker cannot read finance-only commission ledger records'
  );
  await updateDoc(doc(financeMember.actor.db, 'commissions', issuedPolicyId), {
    status: 'received',
    receivedDate: '2026-11-03',
    updatedAt: serverTimestamp(),
  });
  check((await getDoc(doc(financeMember.actor.db, 'commissions', issuedPolicyId))).data().status === 'received',
    'finance can mark a policy-linked commission as received');
  await expectDenied(
    () => updateDoc(doc(financeMember.actor.db, 'commissions', issuedPolicyId), { commissionAmount: 9999 }),
    'finance cannot alter the premium or commission basis of an issued policy ledger row'
  );
  await expectDenied(
    () => deleteDoc(doc(ownerA.db, 'commissions', issuedPolicyId)),
    'owner cannot delete an issued policy commission ledger row'
  );
  const manualCommissionCollisionId = 'manual-collision-' + randomUUID();
  await setDoc(doc(ownerA.db, 'commissions', manualCommissionCollisionId), {
    organizationId: orgA,
    premium: 500,
    commissionRate: 10,
    commissionAmount: 50,
    currency: 'EGP',
    status: 'pending',
    createdBy: ownerA.user.uid,
    createdAt: serverTimestamp(),
  });
  await expectDenied(
    () => updateDoc(doc(ownerA.db, 'commissions', manualCommissionCollisionId), {
      policyId: manualCommissionCollisionId,
      quoteId: protectedQuoteId,
      rfqId: protectedRfqId,
      clientId: protectedClientId,
      clientName: 'RBAC fixture client',
      insurerId: protectedInsurerId,
      insurerName: 'Synthetic Insurer',
      policyNumber: issuedPolicyNumber,
      source: 'policy_issuance',
    }),
    'an existing manual commission cannot be overwritten or promoted into a policy-issued ledger row'
  );

  const forgedPolicyId = 'missing-policy-' + randomUUID();
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'commissions', forgedPolicyId), {
      organizationId: orgA, policyId: forgedPolicyId,
      quoteId: protectedQuoteId, rfqId: protectedRfqId, clientId: protectedClientId,
      clientName: 'RBAC fixture client', insurerId: protectedInsurerId,
      insurerName: 'Synthetic Insurer', policyNumber: issuedPolicyNumber,
      premium: 1200, commissionRate: 10, commissionAmount: 120,
      currency: 'EGP', status: 'pending', source: 'policy_issuance',
      createdBy: ownerA.user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }),
    'policy commission ledger cannot be forged without its matching policy in the same write'
  );

  await expectDenied(
    () => setDoc(doc(ownerB.db, 'quotes', 'cross-org-quote-' + randomUUID()), {
      organizationId: orgB, rfqId: protectedRfqId, clientId: protectedClientId,
      insurerId: 'forged-insurer', insurerName: 'Cross tenant quote', premium: 1,
      currency: 'EGP', commissionRate: 0, status: 'received', createdBy: ownerB.user.uid,
    }),
    'a quote cannot reference an RFQ belonging to another organization'
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

