import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, db } from '../../firebase/config';

// ============================================================
// Read user profile
// ============================================================

export interface UserProfile {
  uid: string;
  email?: string;
  displayName?: string;
  phone?: string;
  photoURL?: string;
  role?: string;
  status?: string;
  organizationId?: string;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as UserProfile;
}

// ============================================================
// Update profile (Firestore + Firebase Auth)
// ============================================================

export interface ProfileUpdateInput {
  displayName?: string;
  phone?: string;
}

export async function updateUserProfile(
  uid: string,
  input: ProfileUpdateInput,
): Promise<void> {
  const updates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (input.displayName !== undefined)
    updates.displayName = input.displayName.trim();
  if (input.phone !== undefined) updates.phone = input.phone.trim();

  await updateDoc(doc(db, 'users', uid), updates);

  // Sync displayName to Firebase Auth
  const currentUser = auth.currentUser;
  if (currentUser && input.displayName) {
    try {
      await updateProfile(currentUser, {
        displayName: input.displayName.trim(),
      });
    } catch (e) {
      console.warn('Failed to sync displayName to Auth:', e);
    }
  }
}

// ============================================================
// Change password (requires reauthentication)
// ============================================================

export async function changeUserPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user: User | null = auth.currentUser;
  if (!user || !user.email) {
    throw new Error('NOT_AUTHENTICATED');
  }

  if (newPassword.length < 6) {
    throw new Error('PASSWORD_TOO_SHORT');
  }

  try {
    const credential = EmailAuthProvider.credential(
      user.email,
      currentPassword,
    );
    await reauthenticateWithCredential(user, credential);
  } catch {
    throw new Error('CURRENT_PASSWORD_WRONG');
  }

  await updatePassword(user, newPassword);
}