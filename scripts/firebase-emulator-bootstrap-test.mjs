import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile('src/firebase/config.ts', 'utf8');

const authInit = source.indexOf('export const auth = getAuth(firebaseApp);');
const authConnect = source.indexOf('connectAuthEmulator(auth,');
const firestoreInit = source.indexOf('export const db = getFirestore(firebaseApp);');
const firestoreConnect = source.indexOf('connectFirestoreEmulator(db,');
const storageInit = source.indexOf('export const storage = getStorage(firebaseApp);');
const storageConnect = source.indexOf('connectStorageEmulator(storage,');

assert.ok(authInit >= 0, 'Auth must be initialized');
assert.ok(authConnect > authInit, 'Auth emulator must be connected after Auth initialization');
assert.ok(
  authConnect < firestoreInit,
  'Auth emulator must be connected before initializing other Firebase services',
);
assert.ok(firestoreConnect > firestoreInit, 'Firestore emulator must be connected after Firestore initialization');
assert.ok(
  firestoreConnect < storageInit,
  'Firestore emulator must be connected before initializing Storage',
);
assert.ok(storageConnect > storageInit, 'Storage emulator must be connected after Storage initialization');

assert.match(
  source,
  /const useFirebaseEmulators\s*=\s*import\.meta\.env\.DEV\s*&&\s*import\.meta\.env\.VITE_USE_FIREBASE_EMULATORS === 'true'/,
  'Emulator mode must only activate in Vite development mode',
);
assert.match(
  source,
  /if \(\s*useFirebaseEmulators\s*&&\s*!firebaseConfig\.projectId\?\.startsWith\('demo-'\)\s*\)/,
  'Emulator mode must fail closed unless the project ID starts with demo-',
);

console.log('Firebase emulator bootstrap order and demo-project safety checks passed.');
