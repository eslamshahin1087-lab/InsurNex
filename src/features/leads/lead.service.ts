import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Lead, LeadInput, LeadStage } from '../../types/lead';

export type LeadActivityType =
  | 'created'
  | 'stage_changed'
  | 'notes_updated'
  | 'task_created'
  | 'client_linked'
  | 'converted';

export type LeadActivity = {
  id: string;
  organizationId: string;
  leadId: string;
  type: LeadActivityType;
  message: string;
  createdBy: string;
  createdAt?: unknown;
};

const allowed: Record<LeadStage, LeadStage[]> = {
  new: ['contacted', 'lost'],
  contacted: ['qualified', 'lost'],
  qualified: ['quotation', 'lost'],
  quotation: ['negotiation', 'won', 'lost'],
  negotiation: ['won', 'lost'],
  won: [],
  lost: [],
};

const validLeadStages = new Set<string>([
  'new',
  'contacted',
  'qualified',
  'quotation',
  'negotiation',
  'won',
  'lost',
]);

/**
 * Normalizes missing or legacy/unknown stage values to "new" so an unexpected
 * Firestore value cannot crash the Lead details page.
 */
export function normalizeLeadStage(value: unknown): LeadStage {
  return typeof value === 'string' && validLeadStages.has(value)
    ? (value as LeadStage)
    : 'new';
}

export function canMoveLeadToStage(a: LeadStage, b: LeadStage): boolean {
  const from = normalizeLeadStage(a);
  const to = normalizeLeadStage(b);
  return from === to || (allowed[from] ?? []).includes(to);
}

export function getAllowedLeadStages(stage: LeadStage): LeadStage[] {
  return allowed[normalizeLeadStage(stage)] ?? [];
}

async function activity(
  organizationId: string,
  leadId: string,
  type: LeadActivityType,
  message: string,
  uid: string,
) {
  await addDoc(collection(db, 'leadActivities'), {
    organizationId,
    leadId,
    type,
    message,
    createdBy: uid,
    createdAt: serverTimestamp(),
  });
}

export async function createLead(
  input: LeadInput,
  organizationId: string,
  uid: string,
) {
  const ref = await addDoc(collection(db, 'leads'), {
    ...input,
    name: input.name.trim(),
    companyName: input.companyName?.trim() || '',
    phone: input.phone.trim(),
    email: input.email.trim(),
    insuranceType: input.insuranceType.trim(),
    preferredInsurerId: input.preferredInsurerId?.trim() || '',
    preferredInsurerName: input.preferredInsurerName?.trim() || '',
    notes: input.notes?.trim() || '',
    lostReason: input.lostReason?.trim() || '',
    estimatedValue: Number(input.estimatedValue) || 0,
    organizationId,
    createdBy: uid,
    lastActivityAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await activity(organizationId, ref.id, 'created', 'تم إنشاء فرصة البيع', uid);
  return ref.id;
}

export async function listLeads(org: string): Promise<Lead[]> {
  const q = query(
    collection(db, 'leads'),
    where('organizationId', '==', org),
    orderBy('createdAt', 'desc'),
    limit(200),
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((item) => {
    const data = item.data();
    return {
      ...data,
      id: item.id,
      stage: normalizeLeadStage(data.stage),
    } as Lead;
  });
}

export async function getLead(
  id: string,
  organizationId?: string,
): Promise<Lead | null> {
  const snapshot = await getDoc(doc(db, 'leads', id));
  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  const lead = {
    ...data,
    id: snapshot.id,
    stage: normalizeLeadStage(data.stage),
  } as Lead;

  if (organizationId && lead.organizationId !== organizationId) return null;
  return lead;
}

export async function listLeadActivities(
  org: string,
  leadId: string,
): Promise<LeadActivity[]> {
  const q = query(
    collection(db, 'leadActivities'),
    where('organizationId', '==', org),
    where('leadId', '==', leadId),
    orderBy('createdAt', 'desc'),
    limit(100),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }) as LeadActivity);
}

export async function setLeadStage(
  id: string,
  current: LeadStage,
  next: LeadStage,
  org?: string,
  uid?: string,
  lostReason?: string,
) {
  if (!canMoveLeadToStage(current, next)) {
    throw new Error('INVALID_STAGE_TRANSITION');
  }

  const ref = doc(db, 'leads', id);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('LEAD_NOT_FOUND');

  const data = snapshot.data() as Lead;
  if (org && data.organizationId !== org) throw new Error('LEAD_ORG_MISMATCH');

  const nextStage = normalizeLeadStage(next);
  const patch: Record<string, unknown> = {
    stage: nextStage,
    updatedAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
  };

  if (nextStage === 'won') {
    patch.wonAt = serverTimestamp();
    patch.lostReason = '';
  }

  if (nextStage === 'lost') {
    const reason = lostReason?.trim() || '';
    if (!reason) throw new Error('LOST_REASON_REQUIRED');
    patch.lostReason = reason;
    patch.lostAt = serverTimestamp();
  }

  await updateDoc(ref, patch);
  if (org && uid) {
    await activity(
      org,
      id,
      'stage_changed',
      `تغيرت المرحلة من ${normalizeLeadStage(current)} إلى ${nextStage}`,
      uid,
    );
  }
}

export async function updateLeadNotes(
  id: string,
  notes: string,
  org?: string,
  uid?: string,
) {
  const ref = doc(db, 'leads', id);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('LEAD_NOT_FOUND');
  if (org && snapshot.data().organizationId !== org) {
    throw new Error('LEAD_ORG_MISMATCH');
  }

  await updateDoc(ref, {
    notes: notes.trim(),
    lastActivityAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (org && uid) {
    await activity(org, id, 'notes_updated', 'تم تحديث ملاحظات فرصة البيع', uid);
  }
}

/**
 * Create a prospect Client 360 record for an eligible lead before the deal is
 * won, so RFQs and quotes share a stable client identity. Idempotent by leadId.
 */
export async function ensureLeadClientForSales(
  leadId: string,
  org: string,
  uid: string,
): Promise<string> {
  const leadRef = doc(db, 'leads', leadId);
  const newClientRef = doc(collection(db, 'clients'));

  const result = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(leadRef);
    if (!snapshot.exists()) throw new Error('LEAD_NOT_FOUND');

    const data = snapshot.data();
    const lead = {
      ...data,
      id: snapshot.id,
      stage: normalizeLeadStage(data.stage),
    } as Lead;

    if (lead.organizationId !== org) throw new Error('LEAD_ORG_MISMATCH');
    if (lead.stage === 'lost') throw new Error('LEAD_ALREADY_LOST');

    if (lead.clientId) {
      const existingClientRef = doc(db, 'clients', lead.clientId);
      const clientSnapshot = await transaction.get(existingClientRef);
      if (!clientSnapshot.exists()) throw new Error('LINKED_CLIENT_NOT_FOUND');
      const client = clientSnapshot.data();
      if (client.organizationId !== org) throw new Error('CLIENT_ORG_MISMATCH');

      const clientPatch: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (!client.sourceLeadId) clientPatch.sourceLeadId = leadId;
      if (lead.companyName?.trim() && !client.contactName) clientPatch.contactName = lead.name;
      const activated = lead.stage === 'won' && client.status !== 'active';
      if (activated) clientPatch.status = 'active';
      if (Object.keys(clientPatch).length > 1) transaction.update(existingClientRef, clientPatch);
      if (lead.stage === 'won' && !lead.convertedAt) {
        transaction.update(leadRef, {
          convertedAt: serverTimestamp(),
          lastActivityAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      return { clientId: lead.clientId, created: false, activated };
    }

    transaction.set(newClientRef, {
      organizationId: org,
      type: lead.clientType === 'corporate' || Boolean(lead.companyName?.trim()) ? 'company' : 'individual',
      status: lead.stage === 'won' ? 'active' : 'prospect',
      name: lead.companyName?.trim() || lead.name,
      ...(lead.companyName?.trim() ? { contactName: lead.name } : {}),
      email: lead.email || '',
      phone: lead.phone || '',
      notes: lead.notes || '',
      assignedTo: lead.assignedTo || uid,
      sourceLeadId: leadId,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const clientTimelineRef = doc(collection(db, 'clients', newClientRef.id, 'timeline'));
    transaction.set(clientTimelineRef, {
      organizationId: org,
      clientId: newClientRef.id,
      type: 'lead_linked',
      title: 'تم ربط ملف العميل بفرصة بيع',
      description: 'تم إنشاء ملف عميل محتمل لبدء رحلة التسعير.',
      by: uid,
      byName: 'InsurNex',
      at: serverTimestamp(),
      metadata: { leadId },
    });

    transaction.update(leadRef, {
      clientId: newClientRef.id,
      clientLinkedAt: serverTimestamp(),
      ...(lead.stage === 'won' ? { convertedAt: serverTimestamp() } : {}),
      lastActivityAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      clientId: newClientRef.id,
      created: true,
      activated: lead.stage === 'won',
    };
  });

  if (result.created) {
    await activity(
      org,
      leadId,
      result.activated ? 'converted' : 'client_linked',
      result.activated
        ? 'تم تحويل فرصة البيع إلى عميل نشط'
        : 'تم إنشاء ملف عميل محتمل لبدء طلبات التسعير',
      uid,
    );
  } else if (result.activated) {
    await activity(org, leadId, 'converted', 'تم تفعيل ملف العميل بعد إغلاق الصفقة', uid);
  }

  return result.clientId;
}

export async function convertWonLeadToClient(
  leadId: string,
  org: string,
  uid: string,
): Promise<string> {
  const lead = await getLead(leadId, org);
  if (!lead) throw new Error('LEAD_NOT_FOUND');
  if (lead.stage !== 'won') throw new Error('LEAD_NOT_WON');
  return ensureLeadClientForSales(leadId, org, uid);
}

export async function recordLeadTaskActivity(
  org: string,
  leadId: string,
  uid: string,
  title: string,
) {
  await activity(org, leadId, 'task_created', `تم إنشاء مهمة: ${title}`, uid);
}
