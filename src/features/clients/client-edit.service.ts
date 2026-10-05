import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { InsuranceClient } from '../../types/client';

export type ClientEditInput = Pick<InsuranceClient, 'name' | 'type' | 'status' | 'phone' | 'email' | 'city' | 'address' | 'notes'>;

export async function updateClientProfile(clientId: string, organizationId: string, input: ClientEditInput) {
  const name = input.name.trim();
  if (!name) throw new Error('CLIENT_NAME_REQUIRED');
  await updateDoc(doc(db, 'clients', clientId), {
    name,
    type: input.type,
    status: input.status,
    phone: input.phone?.trim() || '',
    email: input.email?.trim() || '',
    city: input.city?.trim() || '',
    address: input.address?.trim() || '',
    notes: input.notes?.trim() || '',
    organizationId,
    updatedAt: serverTimestamp(),
  });
}
