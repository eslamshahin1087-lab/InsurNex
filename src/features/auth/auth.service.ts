import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import type { AppUser } from '../../types/auth';

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function register(displayName: string, email: string, password: string) {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(credential.user, { displayName: displayName.trim() });
  return credential.user;
}

export async function signOut() {
  await firebaseSignOut(auth);
}

export async function loadProfile(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? ({ uid, ...snap.data() } as AppUser) : null;
}
