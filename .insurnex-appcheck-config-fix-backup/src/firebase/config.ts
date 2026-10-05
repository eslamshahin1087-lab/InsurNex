import { getApps, initializeApp } from 'firebase/app';
import {
  ReCaptchaEnterpriseProvider,
  initializeAppCheck,
} from 'firebase/app-check';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
} from 'firebase/firestore';
import {
  connectStorageEmulator,
  getStorage,
} from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseApp =
  getApps()[0] ?? initializeApp(firebaseConfig);

/*
 * Firebase App Check
 *
 * Development:
 * Firebase generates a local debug token.
 * Register that token in:
 * Firebase Console > App Check > InsurNex-app > Manage debug tokens
 *
 * Production:
 * Uses the reCAPTCHA Enterprise site key configured in:
 * VITE_RECAPTCHA_ENTERPRISE_SITE_KEY
 */
if (import.meta.env.DEV) {
* (
    self as typeof self & {
   *  FIREBASE_APPCHECK_DEBUG_TOKEN?: *oolean | string;
    }
  ).FIREBAS*_APPCHECK_DEBUG_TOKEN = true;
}

c*nst recaptchaEnterpriseSiteKey =
 *import.meta.env.VITE_RECAPTCHA_ENT*RPRISE_SITE_KEY;

export const app*heck = recaptchaEnterpriseSiteKey
* ? initializeAppCheck(firebaseApp,*{
      provider: new ReCaptchaEnt*rpriseProvider(
        recaptchaE*terpriseSiteKey,
      ),
      is*okenAutoRefreshEnabled: true,
    *)
  : undefined;

export const aut* = getAuth(firebaseApp);
export co*st db = getFirestore(firebaseApp);*export const storage = getStorage(*irebaseApp);

if (
  import.meta.e*v.DEV &&
  import.meta.env.VITE_US*_FIREBASE_EMULATORS === 'true'
) {*  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {
    disableWar*ings: true,
  });

  connectFirest*reEmulator(db, '127.0.0.1', 8080);*  connectStorageEmulator(storage, *127.0.0.1', 9199);
}