import { loadEnv } from 'vite';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const EXPECTED_FIREBASE_PROJECT_ID = 'insurnex-8a9df';

const REQUIRED_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const PLACEHOLDER_PATTERN = /^(?:REPLACE_|YOUR_|<|\\$\\{|fake-api-key$|demo-)/i;

export function validateHostingFirebaseConfig(env) {
  const errors = [];

  for (const key of REQUIRED_KEYS) {
    const value = typeof env[key] === 'string' ? env[key].trim() : '';
    if (!value) {
      errors.push(`${key} is missing.`);
    } else if (PLACEHOLDER_PATTERN.test(value)) {
      errors.push(`${key} still contains a placeholder value.`);
    }
  }

  if (
    env.VITE_FIREBASE_PROJECT_ID &&
    env.VITE_FIREBASE_PROJECT_ID !== EXPECTED_FIREBASE_PROJECT_ID
  ) {
    errors.push(
      `VITE_FIREBASE_PROJECT_ID must equal ${EXPECTED_FIREBASE_PROJECT_ID} for production Hosting.`,
    );
  }

  if (env.VITE_USE_FIREBASE_EMULATORS?.trim().toLowerCase() === 'true') {
    errors.push('VITE_USE_FIREBASE_EMULATORS must not be true in a production Hosting build.');
  }

  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN?.trim();
  if (authDomain && !authDomain.includes('firebaseapp.com') && !authDomain.includes('web.app')) {
    errors.push('VITE_FIREBASE_AUTH_DOMAIN does not look like a Firebase Auth domain; verify it against Firebase Console.');
  }

  return errors;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  const env = loadEnv('production', process.cwd(), 'VITE_');
  const errors = validateHostingFirebaseConfig(env);

  if (errors.length > 0) {
    console.error('\nInsurNex Hosting configuration check failed:');
    for (const error of errors) console.error(`- ${error}`);
    console.error('\nCreate .env.production.local using the exact Firebase Web App config for project insurnex-8a9df.');
    console.error('Do not use .env.demo.local or Admin SDK/service-account credentials for production Hosting.\n');
    process.exitCode = 1;
  } else {
    console.log('InsurNex Hosting Firebase config is complete and targets insurnex-8a9df.');
  }
}
