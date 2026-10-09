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
