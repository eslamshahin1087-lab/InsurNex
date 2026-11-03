import {
  collection, doc, getDoc, getDocs, query, runTransaction,
  serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { CreateRfqInput, MarketSubmissionStatus, RfqRecord, RfqStatus } from './rfq-types';

const RFQ_COLLECTION = 'rfqs';

export async function createRfq(input: CreateRfqInput): Promise<string> {
  if (!input.organizationId || !input.clientId || !input.createdBy) throw new Error('RFQ_REQUIRED_CONTEXT');
  if (!input.insuranceType.trim()) throw new Error('RFQ_INSURANCE_TYPE_REQUIRED');
  if (!input.insurers.length) throw new Error('RFQ_INSURER_REQUIRED');

  const rfqRef = doc(collection(db, RFQ_COLLECTION));
  await runTransaction(db, async (transaction) => {
    const clientRef = doc(db, 'clients', input.clientId);
    const clientSnapshot = await transaction.get(clientRef);
    if (!clientSnapshot.exists()) throw new Error('CLIENT_NOT_FOUND');
    if (clientSnapshot.data().organizationId !== input.organizationId) throw new Error('CLIENT_ORGANIZATION_MISMATCH');

    let leadRef = null;
    let leadSnapshot = null;
    if (input.leadId) {
      leadRef = doc(db, 'leads', input.leadId);
      leadSnapshot = await transaction.get(leadRef);
      if (!leadSnapshot.exists()) throw new Error('LEAD_NOT_FOUND');
      const lead = leadSnapshot.data();
      if (lead.organizationId !== input.organizationId || lead.clientId !== input.clientId) {
        throw new Error('LEAD_CLIENT_RELATIONSHIP_MISMATCH');
      }
      if (lead.stage === 'lost') throw new Error('LEAD_ALREADY_LOST');
      if (!['qualified', 'quotation', 'negotiation', 'won'].includes(String(lead.stage))) {
        throw new Error('LEAD_NOT_QUALIFIED_FOR_RFQ');
      }
    }

    transaction.set(rfqRef, {
      ...input,
      ...(input.leadId ? { leadId: input.leadId } : {}),
      status: 'draft',
      insurers: input.insurers.map((item) => ({ ...item, status: 'draft' })),
      insurerIds: Array.from(new Set(input.insurers.map((item) => item.insurerId))),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const timelineRef = doc(collection(db, 'clients', input.clientId, 'timeline'));
    transaction.set(timelineRef, {
      organizationId: input.organizationId,
      clientId: input.clientId,
      type: 'rfq_created',
      title: 'إنشاء طلب تسعير جديد',
      description: `تم إنشاء طلب ${input.insuranceType} وإرساله للتسعير من شركات التأمين المحددة.`,
      by: input.createdBy,
      byName: 'InsurNex',
      at: serverTimestamp(),
      metadata: {
        rfqId: rfqRef.id,
        leadId: input.leadId || '',
        insurerIds: input.insurers.map((item) => item.insurerId),
      },
    });

    if (leadSnapshot && leadRef && leadSnapshot.data().stage === 'qualified') {
      transaction.update(leadRef, { stage: 'quotation', lastActivityAt: serverTimestamp(), updatedAt: serverTimestamp() });
      const activityRef = doc(collection(db, 'leadActivities'));
      transaction.set(activityRef, {
        organizationId: input.organizationId,
        leadId: input.leadId,
        type: 'stage_changed',
        message: 'تم إنشاء طلب عروض أسعار وبدء مرحلة التسعير',
        createdBy: input.createdBy,
        createdAt: serverTimestamp(),
      });
    }
  });
  return rfqRef.id;
}

export async function listClientRfqs(organizationId: string, clientId: string): Promise<RfqRecord[]> {
  const snapshot = await getDocs(query(collection(db, RFQ_COLLECTION),
    where('organizationId', '==', organizationId), where('clientId', '==', clientId)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as RfqRecord));
}

export async function updateRfqStatus(id: string, status: RfqStatus): Promise<void> {
  await updateDoc(doc(db, RFQ_COLLECTION, id), { status, updatedAt: serverTimestamp() });
}

export async function updateSubmissionStatus(id: string, insurerId: string, status: MarketSubmissionStatus): Promise<void> {
  const ref = doc(db, RFQ_COLLECTION, id);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('RFQ_NOT_FOUND');
  const data = snapshot.data() as RfqRecord;
  const insurers = (data.insurers || []).map((item) => item.insurerId === insurerId
    ? { ...item, status, ...(status === 'sent' ? { sentAt: new Date().toISOString() } : {}) } : item);
  await updateDoc(ref, { insurers, updatedAt: serverTimestamp() });
}

export async function updateRfqDetails(
  id: string,
  input: { insuranceType: string; coverageSummary: string; documentIds: string[]; insurers: Array<{ insurerId: string; insurerName: string; status: MarketSubmissionStatus }> },
): Promise<void> {
  await updateDoc(doc(db, RFQ_COLLECTION, id), {
    ...input,
    insurerIds: Array.from(new Set(input.insurers.map((item) => item.insurerId))),
    updatedAt: serverTimestamp(),
  });
}

export async function updateSubmissionMeta(
  id: string,
  insurerId: string,
  patch: Partial<{ recipientEmail: string; sentAt: string; preparedAt: string; followUpAt: string; quoteReceivedAt: string; notes: string }>,
  uid: string,
): Promise<void> {
  if (!id.trim() || !insurerId.trim() || !uid.trim()) throw new Error('RFQ_FOLLOW_UP_CONTEXT_REQUIRED');
  const ref = doc(db, RFQ_COLLECTION, id);
  const cleanPatch = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  );

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('RFQ_NOT_FOUND');
    const data = snapshot.data() as RfqRecord;
    const target = (data.insurers || []).find((item) => item.insurerId === insurerId);
    if (!target) throw new Error('RFQ_INSURER_NOT_FOUND');

    const followUpAt = typeof cleanPatch.followUpAt === 'string' ? cleanPatch.followUpAt : '';
    const taskRef = followUpAt
      ? doc(db, 'tasks', `rfq_followup_${encodeURIComponent(id)}_${encodeURIComponent(insurerId)}`)
      : null;
    const taskSnapshot = taskRef ? await transaction.get(taskRef) : null;

    const insurers = (data.insurers || []).map((item) => item.insurerId === insurerId
      ? { ...item, ...cleanPatch, ...(taskRef ? { followUpTaskId: taskRef.id } : {}) }
      : item);

    transaction.update(ref, { insurers, updatedAt: serverTimestamp() });

    if (taskRef && followUpAt) {
      const existingTask = taskSnapshot?.exists() ? taskSnapshot.data() : null;
      transaction.set(taskRef, {
        organizationId: data.organizationId,
        title: `متابعة عرض سعر — ${target.insurerName}`,
        description: `متابعة إرسال الطلب واستلام رد شركة ${target.insurerName} على طلب التسعير للعميل ${data.clientName}.`,
        priority: 'medium',
        status: existingTask?.status === 'in_progress' ? 'in_progress' : 'open',
        dueDate: followUpAt,
        assignedTo: uid,
        relatedType: 'rfq',
        relatedId: id,
        relatedSubId: insurerId,
        createdBy: existingTask?.createdBy || uid,
        createdAt: existingTask?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const timelineRef = doc(collection(db, 'clients', data.clientId, 'timeline'));
      transaction.set(timelineRef, {
        organizationId: data.organizationId,
        clientId: data.clientId,
        type: 'task',
        title: `جدولة متابعة عرض ${target.insurerName}`,
        description: `موعد المتابعة المحدد: ${followUpAt}`,
        by: uid,
        byName: 'InsurNex',
        at: serverTimestamp(),
        metadata: { rfqId: id, insurerId, taskId: taskRef.id, followUpAt },
      });
    }
  });
}

export async function listOrganizationRfqs(organizationId: string): Promise<RfqRecord[]> {
  const snapshot = await getDocs(query(collection(db, RFQ_COLLECTION), where('organizationId', '==', organizationId)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as RfqRecord));
}

export async function updateRfqStatusV976(id: string, status: 'draft' | 'ready' | 'submitted' | 'quotes_received' | 'closed'): Promise<void> {
  await updateDoc(doc(db, RFQ_COLLECTION, id), { status, updatedAt: serverTimestamp() });
}

export async function recordRepricingRequestV981(id: string, insurerId: string, input: { recipientEmail: string; reason: string }): Promise<void> {
  const ref = doc(db, RFQ_COLLECTION, id);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('RFQ_NOT_FOUND');
  const data = snapshot.data() as RfqRecord;
  const insurers = (data.insurers || []).map((item) => item.insurerId === insurerId
    ? { ...item, status: 'follow_up' as const, recipientEmail: input.recipientEmail, followUpAt: new Date().toISOString(), notes: ['REPRICING', input.reason].join(' | ') } : item);
  await updateDoc(ref, { status: 'submitted', insurers, updatedAt: serverTimestamp() });
}
