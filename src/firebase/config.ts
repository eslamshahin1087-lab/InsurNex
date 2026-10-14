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

export const firebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);

// ============================================================
// App Check — Disabled in DEV to avoid debug-token 403 errors
// ============================================================
// App Check is only initialized when:
//   1. We're in PRODUCTION build (import.meta.env.PROD), OR
//   2. An explicit debug token is provided via VITE_APPCHECK_DEBUG_TOKEN
//
// This prevents the "exchangeDebugToken 403" error during local dev
// which breaks Firebase Auth and blocks downstream services (Copilot).

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
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

// ============================================================
// Emulators (DEV only)
// ============================================================
if (
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
    disableWarnings: true,
  });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}