import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/config';

// ============================================================
// Types
// ============================================================

export interface OrganizationProfile {
  id: string;
  name?: string;
  legalName?: string;
  type?: 'individual' | 'office' | 'company';
  phone?: string;
  email?: string;
  city?: string;
  country?: string;
  address?: string;
  licenseNumber?: string;
  ownerId?: string;
  status?: string;
}

// ============================================================
// Get
// ============================================================

export async function getOrganization(
  orgId: string,
): Promise<OrganizationProfile | null> {
  const snap = await getDoc(doc(db, 'organizations', orgId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as OrganizationProfile;
}

// ============================================================
// Update (only safe fields — ownerId/type/status are immutable)
// ============================================================

export interface OrganizationUpdateInput {
  name?: string;
  legalName?: string;
  phone?: string;
  email?: string;
  city?: string;
  country?: string;
  address?: string;
  licenseNumber?: string;
}

export async function updateOrganization(
  orgId: string,
  input: OrganizationUpdateInput,
): Promise<void> {
  const updates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  const fields: (keyof OrganizationUpdateInput)[] = [
    'name',
    'legalName',
    'phone',
    'email',
    'city',
    'country',
    'address',
    'licenseNumber',
  ];

  for (const f of fields) {
    const v = input[f];
    if (v !== undefined) updates[f] = String(v).trim();
  }

  await updateDoc(doc(db, 'organizations', orgId), updates);
}