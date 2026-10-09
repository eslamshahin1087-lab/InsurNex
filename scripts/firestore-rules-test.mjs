import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  initializeAuth,
  inMemoryPersistence,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
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
    membershipEnforced: true,
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

// The Firestore emulator accepts the "owner" token for test-fixture seeding.
// This is emulator-only and intentionally guarded by the project-ID check above.
async function seedEmulatorDocument(path, data) {
  const fields = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, { stringValue: String(value) }])
  );
  const response = await fetch(
    `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/${path}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: 'Bearer owner',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    }
  );
  if (!response.ok) {
    throw new Error(`Emulator fixture seeding failed for ${path}: ${response.status} ${await response.text()}`);
  }
}

async function seedRoleFixture(actor, organizationId, role) {
  await seedEmulatorDocument(`users/${actor.user.uid}`, {
    uid: actor.user.uid,
    email: actor.user.email,
    displayName: `Rules test ${role}`,
    organizationId,
    role,
    status: 'active',
    membershipEnforced: true,
  });
  await seedEmulatorDocument(`organizations/${organizationId}/members/${actor.user.uid}`, {
    uid: actor.user.uid,
    email: actor.user.email,
    role,
    status: 'active',
  });
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

  const ownerB = await makeActor('owner-b');
  const orgB = await createOwnerWorkspace(ownerB, 'InsurNex Rules Test B');
  check((await getDoc(doc(ownerB.db, 'organizations', orgB))).exists(), 'a second owner can complete normal onboarding');

  // Legacy profile without the new flag keeps its existing organization access
  // while production membership data is audited before strict migration.
  const legacyActor = await makeActor('legacy-profile');
  await seedEmulatorDocument(`users/${legacyActor.user.uid}`, {
    uid: legacyActor.user.uid,
    email: legacyActor.user.email,
    displayName: 'Legacy broker',
    organizationId: orgA,
    role: 'broker',
    status: 'active',
  });
  check((await getDoc(doc(legacyActor.db, 'organizations', orgA))).exists(),
    'legacy profile without membershipEnforced stays readable during staged rollout');
  await setDoc(doc(legacyActor.db, 'clients', 'legacy-' + randomUUID()), {
    organizationId: orgA,
    name: 'Legacy profile can continue CRM writes',
    createdBy: legacyActor.user.uid,
  });
  check(true, 'legacy profile with protected role retains existing business write compatibility');

  // Regression for Firestore's OR semantics across overlapping match blocks.
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

  const broker = await makeActor('broker-fixture');
  await seedRoleFixture(broker, orgA, 'broker');
  const finance = await makeActor('finance-fixture');
  await seedRoleFixture(finance, orgA, 'finance');
  const viewer = await makeActor('viewer-fixture');
  await seedRoleFixture(viewer, orgA, 'viewer');

  check((await getDoc(doc(viewer.db, 'clients', clientA))).exists(), 'read-only viewer can read own organization records');
  await expectDenied(
    () => setDoc(doc(viewer.db, 'clients', 'viewer-write-' + randomUUID()), {
      organizationId: orgA,
      name: 'Viewer write must fail',
      createdBy: viewer.user.uid,
    }),
    'read-only viewer cannot create client records'
  );
  await expectDenied(
    () => setDoc(doc(broker.db, 'payments', 'broker-payment-' + randomUUID()), {
      organizationId: orgA,
      amount: 100,
      status: 'pending',
      createdBy: broker.user.uid,
      createdAt: serverTimestamp(),
    }),
    'broker cannot create a payment record'
  );
  await expectDenied(
    () => setDoc(doc(broker.db, 'clients', 'forged-creator-' + randomUUID()), {
      organizationId: orgA,
      name: 'Forged creator',
      createdBy: ownerA.user.uid,
    }),
    'creator cannot be forged in a new business record'
  );
  await expectDenied(
    () => setDoc(doc(ownerA.db, 'unknown-business-collection', 'unknown-' + randomUUID()), {
      organizationId: orgA,
      createdBy: ownerA.user.uid,
    }),
    'unregistered top-level collections do not inherit generic create permission'
  );

  const policyId = 'policy-' + randomUUID();
  await setDoc(doc(ownerA.db, 'policies', policyId), {
    organizationId: orgA,
    createdBy: ownerA.user.uid,
    clientId: clientA,
    policyNumber: 'TEST-' + randomUUID(),
    premium: 1000,
    commissionRate: 10,
    commissionAmount: 100,
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await expectDenied(
    () => updateDoc(doc(broker.db, 'policies', policyId), { premium: 9000 }),
    'broker cannot change policy premium or other protected financial values'
  );
  await updateDoc(doc(broker.db, 'policies', policyId), { status: 'renewal_pending', updatedAt: serverTimestamp() });
  check((await getDoc(doc(broker.db, 'policies', policyId))).data().status === 'renewal_pending',
    'broker can update a policy workflow field without changing financial values');

  const claimId = 'claim-' + randomUUID();
  await setDoc(doc(ownerA.db, 'claims', claimId), {
    organizationId: orgA,
    createdBy: ownerA.user.uid,
    claimNumber: 'CL-' + randomUUID(),
    claimAmount: 25000,
    approvedAmount: 0,
    currency: 'EGP',
    status: 'new',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await expectDenied(
    () => updateDoc(doc(broker.db, 'claims', claimId), { claimAmount: 999999 }),
    'broker cannot change the claimed loss amount'
  );
  await updateDoc(doc(broker.db, 'claims', claimId), { status: 'review', updatedAt: serverTimestamp() });
  check((await getDoc(doc(broker.db, 'claims', claimId))).data().status === 'review',
    'broker can advance a claim workflow without changing settlement amounts');

  const paymentId = 'payment-' + randomUUID();
  await setDoc(doc(finance.db, 'payments', paymentId), {
    organizationId: orgA,
    createdBy: finance.user.uid,
    amount: 1500,
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(finance.db, 'payments', paymentId), { status: 'paid', updatedAt: serverTimestamp() });
  check((await getDoc(doc(finance.db, 'payments', paymentId))).data().status === 'paid',
    'finance role can update payment state');
  await expectDenied(
    () => updateDoc(doc(finance.db, 'payments', paymentId), { amount: 999999 }),
    'finance role cannot alter a payment amount after creation'
  );
  await expectDenied(
    () => deleteDoc(doc(ownerA.db, 'payments', paymentId)),
    'payment records cannot be deleted, even by organization owners'
  );
  await expectDenied(
    () => updateDoc(doc(broker.db, 'clients', clientA), { organizationId: orgB }),
    'business records cannot be moved to another organization by updating organizationId'
  );
  await expectDenied(
    () => updateDoc(doc(broker.db, 'clients', clientA), { createdBy: broker.user.uid }),
    'business record creator and creation time remain immutable'
  );

  const documentRecordId = 'document-meta-' + randomUUID();
  await setDoc(doc(ownerA.db, 'documents', documentRecordId), {
    organizationId: orgA,
    uploadedBy: ownerA.user.uid,
    name: 'Immutable storage metadata',
    originalFileName: 'test.pdf',
    storagePath: `organizations/${orgA}/documents/${ownerA.user.uid}/${documentRecordId}/test.pdf`,
    storageProvider: 'supabase',
    storageBucket: 'insurnex-documents',
    contentType: 'application/pdf',
    size: 1024,
    createdAt: serverTimestamp(),
  });
  await expectDenied(
    () => updateDoc(doc(broker.db, 'documents', documentRecordId), { storagePath: 'organizations/another-org/secret.pdf' }),
    'a member cannot change the protected object storage path'
  );
  await expectDenied(
    () => updateDoc(doc(broker.db, 'documents', documentRecordId), { contentType: 'text/html' }),
    'a member cannot forge the stored file MIME type'
  );

  const activityId = 'lead-activity-' + randomUUID();
  await setDoc(doc(ownerA.db, 'leadActivities', activityId), {
    organizationId: orgA,
    leadId: 'test-lead',
    type: 'created',
    message: 'Immutable activity',
    createdBy: ownerA.user.uid,
    createdAt: serverTimestamp(),
  });
  await expectDenied(
    () => updateDoc(doc(broker.db, 'leadActivities', activityId), { message: 'Rewritten history' }),
    'lead activity history cannot be rewritten after creation'
  );

  // Membership role/status, not the stale profile role, governs authorization.
  await updateDoc(doc(ownerA.db, 'organizations', orgA, 'members', broker.user.uid), { role: 'viewer' });
  await expectDenied(
    () => setDoc(doc(broker.db, 'clients', 'demoted-broker-' + randomUUID()), {
      organizationId: orgA,
      name: 'A demoted broker must not write',
      createdBy: broker.user.uid,
    }),
    'member role downgrade immediately removes business write permission'
  );
  await updateDoc(doc(ownerA.db, 'organizations', orgA, 'members', broker.user.uid), { status: 'suspended' });
  await expectDenied(
    () => getDoc(doc(broker.db, 'clients', clientA)),
    'suspended organization membership revokes Firestore reads'
  );
  await expectDenied(
    () => setDoc(doc(broker.db, 'clients', 'suspended-member-' + randomUUID()), {
      organizationId: orgA,
      name: 'Suspended member must not write',
      createdBy: broker.user.uid,
    }),
    'suspended organization membership revokes Firestore writes'
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
    'a user cannot create another users profile'
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
