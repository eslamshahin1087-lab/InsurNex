import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { ClientInput, InsuranceClient } from '../../types/client';
import type { ClientWizardInput, ExtendedClient } from './client.types';
import { generateClientCode } from './code-generator.service';
import { calculateCompleteness, assessRisk } from './risk-assessment.service';

// ============================================================
// HELPERS
// ============================================================

/**
 * Recursively remove keys whose value is `undefined`.
 * Firestore rejects `undefined` values with addDoc/setDoc.
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v === null) {
      out[k] = v;
      continue;
    }
    if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? stripUndefined(item as Record<string, unknown>)
          : item,
      );
      continue;
    }
    if (typeof v === 'object') {
      out[k] = stripUndefined(v as Record<string, unknown>);
      continue;
    }
    out[k] = v;
  }
  return out as T;
}

// ============================================================
// LEGACY (kept for backward compatibility)
// ============================================================

export async function createClient(
  input: ClientInput,
  organizationId: string,
  uid: string,
): Promise<string> {
  const ref = await addDoc(
    collection(db, 'clients'),
    stripUndefined({
      ...input,
      organizationId,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
  return ref.id;
}

/**
 * @deprecated UI code should use listClientSummaries(profile) from
 * client-data-access.service.ts so broad list state receives only the
 * allowlisted base projection. Kept temporarily for compatibility.
 */
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

/**
 * @deprecated UI code should use getLegacyClientWorkspace(profile, id) from
 * client-data-access.service.ts so role, active status and tenant checks run
 * before the legacy mixed-sensitivity record is fetched.
 */
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
 *   3. Strip all `undefined` values (Firestore rejects them)
 *   4. Save to Firestore
 *   5. Add initial timeline entry
 *   6. Return the new client id + code
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

  // 4. Build raw docData (may contain `undefined`)
  const rawDocData = {
    code,
    type: input.type,
    status: 'active' as const,
    organizationId,
    assignedTo: input.assignedTo || uid,
    leadSource: input.leadSource,
    referredBy: input.referredBy,
    tags: input.tags || [],

    individual: input.individual,
    corporate: input.corporate,

    name,
    phone,
    email,
    city,
    address,
    nationalId,

    needs: input.needs || [],
    riskData: input.riskData || {},
    documents: input.documents || [],

    riskAssessment,

    preferences: input.preferences,
    lifetimeValue: 0,
    completeness,
    createdBy: uid,
    notes: input.notes || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // 5. Strip undefined values recursively
  const docData = stripUndefined(rawDocData as unknown as Record<string, unknown>);

  // 6. Save
  const ref = await addDoc(collection(db, 'clients'), docData);

  // 7. Add initial timeline entry
  try {
    await addDoc(collection(db, 'clients', ref.id, 'timeline'), {
      clientId: ref.id,
      organizationId,
      type: 'created',
      title: `تم إنشاء العميل بواسطة النظام — كود: ${code}`,
      description: '',
      by: uid,
      byName: '',
      at: serverTimestamp(),
      metadata: { code },
    });
  } catch (e) {
    console.warn('Timeline entry failed (non-critical):', e);
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
  await updateDoc(
    doc(db, 'clients', clientId),
    stripUndefined({
      aiAnalysis: aiAnalysis as unknown as Record<string, unknown>,
      updatedAt: serverTimestamp(),
    }),
  );
}