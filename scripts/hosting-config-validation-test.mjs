import assert from 'node:assert/strict';
import { validateHostingFirebaseConfig } from './validate-firebase-hosting-config.mjs';

const valid = {
  VITE_FIREBASE_API_KEY: 'AIzaSyExamplePublicWebConfigKey',
  VITE_FIREBASE_AUTH_DOMAIN: 'insurnex-8a9df.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'insurnex-8a9df',
  VITE_FIREBASE_STORAGE_BUCKET: 'insurnex-8a9df.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123456789012',
  VITE_FIREBASE_APP_ID: '1:123456789012:web:abcdef012345',
  VITE_USE_FIREBASE_EMULATORS: 'false',
};

assert.deepEqual(validateHostingFirebaseConfig(valid), [], 'valid production Firebase config should pass');

const missingKey = { ...valid, VITE_FIREBASE_API_KEY: '' };
assert.ok(
  validateHostingFirebaseConfig(missingKey).some((item) => item.includes('VITE_FIREBASE_API_KEY is missing')),
  'missing API key must fail',
);

const placeholder = { ...valid, VITE_FIREBASE_APP_ID: 'REPLACE_WITH_FIREBASE_WEB_APP_ID' };
assert.ok(
  validateHostingFirebaseConfig(placeholder).some((item) => item.includes('placeholder')),
  'placeholder config must fail',
);

const wrongProject = { ...valid, VITE_FIREBASE_PROJECT_ID: 'demo-insurnex' };
assert.ok(
  validateHostingFirebaseConfig(wrongProject).some((item) => item.includes('must equal')),
  'a demo or unrelated project must fail the production guard',
);

const emulatorMode = { ...valid, VITE_USE_FIREBASE_EMULATORS: 'true' };
assert.ok(
  validateHostingFirebaseConfig(emulatorMode).some((item) => item.includes('must not be true')),
  'emulator mode must fail the production guard',
);

console.log('Hosting Firebase config validation tests passed.');
