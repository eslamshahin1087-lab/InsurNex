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

if (import.meta.env.DEV) {
  const debugSelf = self as typeof self & {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
  };
  debugSelf.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

const recaptchaEnterpriseSiteKey =
  import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;

export const appCheck = recaptchaEnterpriseSiteKey
  ? initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaEnterpriseProvider(
        recaptchaEnterpriseSiteKey,
      ),
      isTokenAutoRefreshEnabled: true,
    })
  : undefined;

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

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
