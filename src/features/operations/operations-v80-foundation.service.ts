import { deleteDoc, doc } from 'firebase/firestore';
import { createClient } from '../clients/client.service';
import { auth } from '../../firebase/config';
import { db } from '../../firebase/config';
import type { ClientInput, ClientType, InsuranceClient } from '../../types/client';
import { uploadClientDocumentsAtomic, validatePendingClientDocuments, type PendingClientDocument } from './operations-document.service';

export type ClientOnboardingInput = {
  type: ClientType; name: string; email: string; phone: string;
  nationalId?: string; taxId?: string; industry?: string; city?: string; address?: string; notes?: string;
};
export type ClientOnboardingDocument = PendingClientDocument;

function optionalText(value?: string) { const normalized = value?.trim(); return normalized ? normalized : undefined; }
function buildClientPayload(input: ClientOnboardingInput): ClientInput {
  const payload: ClientInput = { type: input.type, status: 'prospect', name: input.name.trim(), email: input.email.trim(), phone: input.phone.trim() };
  const optional = {
    nationalId: optionalText(input.nationalId), taxId: optionalText(input.taxId), industry: optionalText(input.industry),
    city: optionalText(input.city), address: optionalText(input.address), notes: optionalText(input.notes),
  };
  if (optional.nationalId !== undefined) payload.nationalId = optional.nationalId;
  if (optional.taxId !== undefined) payload.taxId = optional.taxId;
  if (optional.industry !== undefined) payload.industry = optional.industry;
  if (optional.city !== undefined) payload.city = optional.city;
  if (optional.address !== undefined) payload.address = optional.address;
  if (optional.notes !== undefined) payload.notes = optional.notes;
  return payload;
}

export async function onboardOperationsClient(input: ClientOnboardingInput, documents: ClientOnboardingDocument[], organizationId: string, userId: string) {
  if (!input.name.trim() || !input.phone.trim()) throw new Error('CLIENT_REQUIRED_FIELDS');
  validatePendingClientDocuments(documents);
  const firebaseUser = auth.currentUser;
  if (!firebaseUser || firebaseUser.uid !== userId) throw new Error('AUTH_REQUIRED');
  const firebaseToken = await firebaseUser.getIdToken();
  const payload = buildClientPayload(input);
  let clientId = '';
  try {
    clientId = await createClient(payload, organizationId, userId);
    const result = documents.length
      ? await uploadClientDocumentsAtomic({ organizationId, clientId, userId, firebaseToken, documents })
      : { uploaded: [], metadataIds: [] };
    return { clientId, uploadedDocumentIds: result.metadataIds, failedDocuments: [] as { fileName: string; reason: string }[] };
  } catch (error) {
    if (clientId) await deleteDoc(doc(db, 'clients', clientId)).catch(() => undefined);
    throw error;
  }
}

export function clientTypeLabel(client: InsuranceClient) { return client.type === 'company' ? 'شركة / جماعي' : 'فردي'; }
