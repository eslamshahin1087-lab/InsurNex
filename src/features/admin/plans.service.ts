import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { PricingPlanDoc } from './plans.types';
import { DEFAULT_PRICING_PLANS } from './pricing.config';

const COLLECTION = 'pricingPlans';

export async function listPlans(): Promise<PricingPlanDoc[]> {
  const q = query(collection(db, COLLECTION), orderBy('order', 'asc'));
  const snap = await getDocs(q);

  // If empty, seed defaults
  if (snap.empty) {
    await seedDefaults();
    return DEFAULT_PRICING_PLANS.map((p) => ({ ...p, id: p.id }));
  }

  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PricingPlanDoc));
}

export async function getPlanById(id: string): Promise<PricingPlanDoc | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) {
    // Fallback to default
    const def = DEFAULT_PRICING_PLANS.find((p) => p.id === id);
    return def ? { ...def } : null;
  }
  return { id: snap.id, ...snap.data() } as PricingPlanDoc;
}

export async function savePlan(
  plan: PricingPlanDoc,
  updatedBy: string,
): Promise<void> {
  const ref = doc(db, COLLECTION, plan.id);
  await setDoc(
    ref,
    {
      name: plan.name,
      duration: plan.duration,
      subtotal: plan.subtotal,
      currency: plan.currency || 'EGP',
      description: plan.description || '',
      discountNote: plan.discountNote || '',
      isActive: plan.isActive,
      order: plan.order ?? 0,
      updatedAt: serverTimestamp(),
      updatedBy,
    },
    { merge: true },
  );
}

export async function seedDefaults(): Promise<void> {
  const batch = writeBatch(db);
  for (const plan of DEFAULT_PRICING_PLANS) {
    const ref = doc(db, COLLECTION, plan.id);
    batch.set(ref, {
      name: plan.name,
      duration: plan.duration,
      subtotal: plan.subtotal,
      currency: plan.currency,
      description: plan.description,
      discountNote: plan.discountNote || '',
      isActive: plan.isActive,
      order: plan.order,
      updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function resetToDefaults(updatedBy: string): Promise<void> {
  const batch = writeBatch(db);
  for (const plan of DEFAULT_PRICING_PLANS) {
    const ref = doc(db, COLLECTION, plan.id);
    batch.set(
      ref,
      {
        name: plan.name,
        duration: plan.duration,
        subtotal: plan.subtotal,
        currency: plan.currency,
        description: plan.description,
        discountNote: plan.discountNote || '',
        isActive: plan.isActive,
        order: plan.order,
        updatedAt: serverTimestamp(),
        updatedBy,
      },
      { merge: true },
    );
  }
  await batch.commit();
}