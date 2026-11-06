import { getApps, initializeApp } from 'firebase/app';
import {
  ReCaptchaEnterpriseProvider,
  initializeAppCheck,
} from 'firebase/app-check';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { connectStorageEmulator, getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const useFirebaseEmulators =
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true';

// Fail closed: a local emulator session must never be pointed at a live project.
if (
  useFirebaseEmulators &&
  !firebaseConfig.projectId?.startsWith('demo-')
) {
  throw new Error(
    'InsurNex safety stop: Firebase Emulator mode requires a demo-* project ID.',
  );
}

export const firebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);

// ============================================================
// App Check — Disabled in DEV to avoid debug-token 403 errors
// ============================================================
// App Check is only initialized when:
//   1. We're in a PRODUCTION build, OR
//   2. An explicit debug token is provided via VITE_APPCHECK_DEBUG_TOKEN
//
// This prevents local development from depending on a production App Check
// configuration unless a developer explicitly opts into a debug token.

const recaptchaEnterpriseSiteKey =
  import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;

const explicitDebugToken = import.meta.env
  .VITE_APPCHECK_DEBUG_TOKEN as string | undefined;

export const appCheck =
  recaptchaEnterpriseSiteKey && (import.meta.env.PROD || explicitDebugToken)
    ? (() => {
        if (explicitDebugToken) {
          const debugSelf = self as typeof self & {
            FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
          };
          debugSelf.FIREBASE_APPCHECK_DEBUG_TOKEN = explicitDebugToken;
        }
        return initializeAppCheck(firebaseApp, {
          provider: new ReCaptchaEnterpriseProvider(
            recaptchaEnterpriseSiteKey,
          ),
          isTokenAutoRefreshEnabled: true,
        });
      })()
    : undefined;

// ============================================================
// Firebase Services
// ============================================================
// Connect each SDK service to its emulator immediately after initialization.
// This prevents Auth from starting a project-config request against production
// before the emulator endpoint has been attached.

export const auth = getAuth(firebaseApp);
if (useFirebaseEmulators) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
    disableWarnings: true,
  });
}

export const db = getFirestore(firebaseApp);
if (useFirebaseEmulators) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

export const storage = getStorage(firebaseApp);
if (useFirebaseEmulators) {
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}

if (useFirebaseEmulators) {
  console.info(
    `[InsurNex] Firebase Emulator mode active for ${firebaseConfig.projectId}.`,
  );
}
