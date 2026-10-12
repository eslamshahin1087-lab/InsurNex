import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { OnboardingProgress } from './onboarding.types';

function progressPath(uid: string) {
  return doc(db, 'onboardingProgress', uid);
}

export async function getOnboardingProgress(
  uid: string,
): Promise<OnboardingProgress | null> {
  const snap = await getDoc(progressPath(uid));
  if (!snap.exists()) return null;
  return snap.data() as OnboardingProgress;
}

export async function startOnboarding(
  uid: string,
  organizationId: string,
): Promise<OnboardingProgress> {
  const data = {
    uid,
    organizationId,
    currentStep: 1,
    completed: false,
    skippedSteps: [],
    startedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(progressPath(uid), data, { merge: true });
  return data as unknown as OnboardingProgress;
}

export async function advanceStep(
  uid: string,
  nextStep: number,
): Promise<void> {
  await updateDoc(progressPath(uid), {
    currentStep: nextStep,
    updatedAt: serverTimestamp(),
  });
}

export async function skipStep(uid: string, step: number): Promise<void> {
  const snap = await getDoc(progressPath(uid));
  if (!snap.exists()) return;
  const cur = (snap.data() as OnboardingProgress).skippedSteps || [];
  const next = Array.from(new Set([...cur, step]));
  await updateDoc(progressPath(uid), {
    skippedSteps: next,
    updatedAt: serverTimestamp(),
  });
}

export async function completeOnboarding(uid: string): Promise<void> {
  await updateDoc(progressPath(uid), {
    currentStep: 5,
    completed: true,
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function resetOnboarding(uid: string): Promise<void> {
  await updateDoc(progressPath(uid), {
    currentStep: 1,
    completed: false,
    skippedSteps: [],
    completedAt: null,
    updatedAt: serverTimestamp(),
  });
}