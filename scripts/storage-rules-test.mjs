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
  doc,
  getFirestore,
  serverTimestamp,
  writeBatch,
  updateDoc,
} from 'firebase/firestore';
import {
  connectStorageEmulator,
  deleteObject,
  getBytes,
  getStorage,
  ref,
  uploadBytes,
} from 'firebase/storage';

const projectId = process.env.GCLOUD_PROJECT || '';
if (projectId !== 'demo-insurnex' || !projectId.startsWith('demo-')) {
  throw new Error('Safety stop: Storage rules tests must run only against the demo-insurnex emulator project.');
}

const apps = [];
const config = {
  apiKey: 'fake-api-key',
  authDomain: 'demo-insurnex.firebaseapp.com',
  projectId,
  storageBucket: 'demo-insurnex.appspot.com',
  appId: '1:123456789:web:storage-rules-test',
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
    if (!String(error?.code || '').includes('unauthorized')) throw error;
    denied = true;
  }
  assert.equal(denied, true, 'Expected storage/unauthorized: ' + message);
  console.log('PASS denied: ' + message);
}

async function makeActor(label) {
  const app = initializeApp(config, 'storage-' + label + '-' + randomUUID());
  apps.push(app);
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const storage = getStorage(app);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  const credential = await createUserWithEmailAndPassword(
    auth,
    label + '-' + randomUUID() + '@example.test',
    'LocalStorageRulesTest-Password-123!'
  );
  return { app, auth, db, storage, user: credential.user };
}

async function createOwnerWorkspace(actor, name) {
  const uid = actor.user.uid;
  const organizationId = 'org_' + uid;
  const batch = writeBatch(actor.db);
  batch.set(doc(actor.db, 'organizations', organizationId), {
    name,
    type: 'office',
    ownerId: uid,
    country: 'EG',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(actor.db, 'users', uid), {
    email: actor.user.email,
    displayName: name + ' Owner',
    organizationId,
    role: 'owner',
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(actor.db, 'organizations', organizationId, 'members', uid), {
    uid,
    email: actor.user.email,
    displayName: name + ' Owner',
    role: 'owner',
    status: 'active',
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return organizationId;
}

// This fixture seed uses the Firestore emulator's admin-only "owner" token.
// The test suite exits unless GCLOUD_PROJECT is exactly demo-insurnex.
async function seedEmulatorDocument(path, data) {
  const fields = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, { stringValue: String(value) }])
  );
  const response = await fetch(
    `http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/${path}`,
    {
      method: 'PATCH',
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    }
  );
  if (!response.ok) {
    throw new Error(`Emulator fixture seeding failed for ${path}: ${response.status} ${await response.text()}`);
  }
}

async function seedRoleFixture(actor, organizationId, role, status = 'active') {
  await seedEmulatorDocument(`users/${actor.user.uid}`, {
    uid: actor.user.uid,
    email: actor.user.email,
    displayName: 'Storage rules ' + role,
    organizationId,
    role,
    status,
  });
  await seedEmulatorDocument(`organizations/${organizationId}/members/${actor.user.uid}`, {
    uid: actor.user.uid,
    email: actor.user.email,
    role,
    status,
  });
}

function fileRef(actor, organizationId, documentId, fileName = 'sample.pdf') {
  return ref(actor.storage, `organizations/${organizationId}/documents/${documentId}/${fileName}`);
}

function uploadOptions(actor, organizationId, documentId, contentType = 'application/pdf') {
  return {
    contentType,
    customMetadata: {
      organizationId,
      documentId,
      uploaderId: actor.user.uid,
    },
  };
}

try {
  const owner = await makeActor('owner');
  const organizationId = await createOwnerWorkspace(owner, 'InsurNex Storage Rules Test');

  const broker = await makeActor('broker');
  await seedRoleFixture(broker, organizationId, 'broker');

  const otherBroker = await makeActor('other-broker');
  await seedRoleFixture(otherBroker, organizationId, 'broker');

  const otherOwner = await makeActor('other-owner');
  const otherOrganizationId = await createOwnerWorkspace(otherOwner, 'InsurNex Storage Other Organization');

  const docId = 'storage-doc-' + randomUUID();
  const object = fileRef(broker, organizationId, docId);
  const pdfBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10]);
  await uploadBytes(object, pdfBytes, uploadOptions(broker, organizationId, docId));
  check((await getBytes(object)).byteLength === pdfBytes.byteLength, 'active broker can upload and read their organization document');

  const peerObject = fileRef(otherBroker, organizationId, docId);
  check((await getBytes(peerObject)).byteLength === pdfBytes.byteLength, 'another active organization member can read a shared document');
  await expectDenied(
    () => deleteObject(peerObject),
    'a different broker cannot delete another member uploaded file'
  );

  await uploadBytes(object, new Uint8Array([37, 80, 68, 70, 45, 50]), uploadOptions(broker, organizationId, docId));
  check((await getBytes(object)).byteLength > 0, 'uploader may replace their own file with a valid upload');

  const badDocId = 'bad-type-' + randomUUID();
  await expectDenied(
    () => uploadBytes(
      fileRef(broker, organizationId, badDocId, 'script.txt'),
      new Uint8Array([1, 2, 3]),
      uploadOptions(broker, organizationId, badDocId, 'text/plain')
    ),
    'unsupported MIME types are rejected'
  );

  await expectDenied(
    () => uploadBytes(
      fileRef(otherOwner, organizationId, 'cross-org-' + randomUUID()),
      pdfBytes,
      uploadOptions(otherOwner, organizationId, 'cross-org-' + randomUUID())
    ),
    'a different organization cannot upload into another organization path'
  );
  await expectDenied(
    () => getBytes(fileRef(otherOwner, organizationId, docId)),
    'a different organization cannot read another organizations document'
  );
  await expectDenied(
    () => deleteObject(fileRef(otherOwner, organizationId, docId)),
    'a different organization cannot delete another organizations document'
  );

  const suspendedDocId = 'suspended-' + randomUUID();
  const suspendedObject = fileRef(broker, organizationId, suspendedDocId);
  await uploadBytes(suspendedObject, pdfBytes, uploadOptions(broker, organizationId, suspendedDocId));
  await updateDoc(doc(owner.db, 'organizations', organizationId, 'members', broker.user.uid), {
    status: 'suspended',
  });
  await expectDenied(
    () => getBytes(suspendedObject),
    'a suspended organization member can no longer read stored documents'
  );
  await expectDenied(
    () => uploadBytes(
      fileRef(broker, organizationId, 'suspended-upload-' + randomUUID()),
      pdfBytes,
      uploadOptions(broker, organizationId, 'suspended-upload-' + randomUUID())
    ),
    'a suspended organization member can no longer upload documents'
  );

  await deleteObject(object);
  console.log('All Storage emulator security regression tests passed.');
} finally {
  await Promise.allSettled(apps.map((app) => deleteApp(app)));
}
