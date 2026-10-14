import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { ClientInput, InsuranceClient } from '../../types/client';
import type { ClientWizardInput, ExtendedClient } from './client.types';
import { generateClientCode } from './code-generator.service';
import { calculateCompleteness, assessRisk } from './risk-assessment.service';

// ============================================================
// LEGACY (kept for backward compatibility)
// ============================================================

export async function createClient(
  input: ClientInput,
  organizationId: string,
  uid: string,
): Promise<string> {
  const ref = await addDoc(collection(db, 'clients'), {
    ...input,
    organizationId,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listClients(
  organizationId: string,
): Promise<InsuranceClient[]> {
  const q = query(
    collection(db, 'clients'),
    where('organizationId', '==', organizationId),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as InsuranceClient),
  );
}

export async function getClient(
  id: string,
): Promise<InsuranceClient | null> {
  const snap = await getDoc(doc(db, 'clients', id));
  return snap.exists()
    ? ({ id: snap.id, ...snap.data() } as InsuranceClient)
    : null;
}

export async function activateIssuedClientV978(
  clientId: string,
  organizationId: string,
): Promise<void> {
  const snap = await getDoc(doc(db, 'clients', clientId));
  if (!snap.exists()) throw new Error('Client not found: ' + clientId);
  const data = snap.data() as InsuranceClient;
  if (data.organizationId !== organizationId)
    throw new Error('Client organization mismatch');
}

// ============================================================
// EXTENDED (Wizard flow)
// ============================================================

/**
 * Create a client from the wizard flow:
 *   1. Generate unique code (CLI-YYYY-NNNN)
 *   2. Calculate completeness + risk assessment
 *   3. Save to Firestore
 *   4. Return the new client id + code
 */
export async function createExtendedClient(
  input: ClientWizardInput,
  organizationId: string,
  uid: string,
): Promise<{ id: string; code: string }> {
  // 1. Generate code
  const code = await generateClientCode(organizationId);

  // 2. Calculate meta
  const completeness = calculateCompleteness(input);
  const riskAssessment = assessRisk(input);

  // 3. Convenience fields for lists/search
  const name =
    input.type === 'individual'
      ? input.individual?.fullName || 'بدون اسم'
      : input.corporate?.companyName || 'بدون اسم';
  const phone =
    input.type === 'individual'
      ? input.individual?.phone || ''
      : input.corporate?.phone || '';
  const email =
    input.type === 'individual'
      ? input.individual?.email
      : input.corporate?.email;
  const city =
    input.type === 'individual'
      ? input.individual?.city || ''
      : input.corporate?.city || '';
  const address =
    input.type === 'individual'
      ? [input.individual?.city, input.individual?.area, input.individual?.street]
          .filter(Boolean)
          .join(' — ')
      : [input.corporate?.city, input.corporate?.area, input.corporate?.street]
          .filter(Boolean)
          .join(' — ');
  const nationalId =
    input.type === 'individual'
      ? input.individual?.nationalId
      : input.corporate?.authorizedSignatoryNid;

  // 4. Save
  const docData: Omit<ExtendedClient, 'id'> = {
    code,
    type: input.type,
    status: 'active',
    organizationId,
    assignedTo: input.assignedTo || uid,
    leadSource: input.leadSource,
    referredBy: input.referredBy,
    tags: input.tags,

    individual: input.individual,
    corporate: input.corporate,

    name,
    phone,
    email,
    city,
    address,
    nationalId,

    needs: input.needs,
    riskData: input.riskData,
    documents: input.documents,

    riskAssessment,

    preferences: input.preferences,
    lifetimeValue: 0,
    completeness,
    createdBy: uid,
    notes: input.notes,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, 'clients'), docData);

  // 5. Add initial timeline entry (as subcollection)
  try {
    await addDoc(collection(db, 'clients', ref.id, 'timeline'), {
      type: 'created',
      note: `تم إنشاء العميل بواسطة النظام — كود: ${code}`,
      at: serverTimestamp(),
      by: uid,
    });
  } catch {
    /* ignore */
  }

  return { id: ref.id, code };
}

/**
 * Save AI analysis to client doc (called after Copilot responds).
 */
export async function saveClientAiAnalysis(
  clientId: string,
  aiAnalysis: ExtendedClient['aiAnalysis'],
): Promise<void> {
  const { updateDoc } = await import('firebase/firestore');
  await updateDoc(doc(db, 'clients', clientId), {
    aiAnalysis,
    updatedAt: serverTimestamp(),
  });
}