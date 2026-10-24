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
import { normalizeFeatureEntitlements } from './feature-catalog';
import type { PricingPlanDoc } from './plans.types';
import { DEFAULT_PRICING_PLANS } from './pricing.config';

const COLLECTION = 'pricingPlans';

function normalizePlan(id: string, value: Record<string, unknown>): PricingPlanDoc {
  return {
    id,
    name: typeof value.name === 'string' ? value.name : id,
    duration: typeof value.duration === 'number' ? value.duration : 30,
    subtotal: typeof value.subtotal === 'number' ? value.subtotal : 0,
    currency: typeof value.currency === 'string' ? value.currency : 'EGP',
    description: typeof value.description === 'string' ? value.description : '',
    discountNote: typeof value.discountNote === 'string' ? value.discountNote : '',
    isActive: typeof value.isActive === 'boolean' ? value.isActive : true,
    order: typeof value.order === 'number' ? value.order : 0,
    features: normalizeFeatureEntitlements(value.features),
    updatedAt: value.updatedAt,
    updatedBy: typeof value.updatedBy === 'string' ? value.updatedBy : undefined,
  };
}

function persistedPlan(plan: PricingPlanDoc) {
  return {
    name: plan.name,
    duration: plan.duration,
    subtotal: plan.subtotal,
    currency: plan.currency || 'EGP',
    description: plan.description || '',
    discountNote: plan.discountNote || '',
    isActive: plan.isActive,
    order: plan.order ?? 0,
    features: normalizeFeatureEntitlements(plan.features),
  };
}

export async function listPlans(): Promise<PricingPlanDoc[]> {
  const q = query(collection(db, COLLECTION), orderBy('order', 'asc'));
  const snap = await getDocs(q);

  // If empty, seed defaults
  if (snap.empty) {
    await seedDefaults();
    return DEFAULT_PRICING_PLANS.map((p) => ({ ...p, id: p.id }));
  }

  return snap.docs.map((d) => normalizePlan(d.id, d.data()));
}

export async function getPlanById(id: string): Promise<PricingPlanDoc | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) {
    // Legacy/default plans are available even before their documents are seeded.
    const def = DEFAULT_PRICING_PLANS.find((p) => p.id === id);
    return def ? { ...def, features: normalizeFeatureEntitlements(def.features) } : null;
  }
  return normalizePlan(snap.id, snap.data());
}

export async function savePlan(
  plan: PricingPlanDoc,
  updatedBy: string,
): Promise<void> {
  const ref = doc(db, COLLECTION, plan.id);
  await setDoc(
    ref,
    {
      ...persistedPlan(plan),
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
      ...persistedPlan({ ...plan, id: plan.id }),
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
        ...persistedPlan({ ...plan, id: plan.id }),
        updatedAt: serverTimestamp(),
        updatedBy,
      },
      { merge: true },
    );
  }
  await batch.commit();
}
