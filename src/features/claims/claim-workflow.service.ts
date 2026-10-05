import { addDoc, collection, doc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../firebase/config';

export type ClaimWorkflowStatus =
  | 'new'
  | 'documents'
  | 'additional_documents'
  | 'review'
  | 'approved'
  | 'settled'
  | 'rejected'
  | 'closed';

export type ClaimActivity = {
  id: string;
  organizationId: string;
  claimId: string;
  type: 'status_change' | 'note' | 'task_created';
  title: string;
  fromStatus?: string;
  toStatus?: string;
  createdBy: string;
  createdAt?: unknown;
};

const transitions: Record<ClaimWorkflowStatus, ClaimWorkflowStatus[]> = {
  new: ['documents', 'review', 'rejected'],
  documents: ['additional_documents', 'review', 'rejected'],
  additional_documents: ['documents', 'review', 'rejected'],
  review: ['additional_documents', 'approved', 'rejected'],
  approved: ['settled', 'closed'],
  settled: ['closed'],
  rejected: ['closed'],
  closed: [],
};

export function canTransitionClaim(from: string, to: string) {
  return (transitions[from as ClaimWorkflowStatus] || []).includes(to as ClaimWorkflowStatus);
}

export function nextClaimStatuses(status: string): ClaimWorkflowStatus[] {
  return transitions[status as ClaimWorkflowStatus] || [];
}

export async function transitionClaimStatus(input: {
  claimId: string;
  organizationId: string;
  userId: string;
  toStatus: ClaimWorkflowStatus;
}) {
  const claimRef = doc(db, 'claims', input.claimId);
  await runTransaction(db, async transaction => {
    const snap = await transaction.get(claimRef);
    if (!snap.exists()) throw new Error('CLAIM_NOT_FOUND');
    const data = snap.data();
    if (data.organizationId !== input.organizationId) throw new Error('CLAIM_ORGANIZATION_MISMATCH');
    const fromStatus = String(data.status || 'new');
    if (!canTransitionClaim(fromStatus, input.toStatus)) throw new Error('INVALID_CLAIM_TRANSITION');
    transaction.update(claimRef, { status: input.toStatus, updatedAt: serverTimestamp() });
  });

  await addDoc(collection(db, 'claimActivities'), {
    organizationId: input.organizationId,
    claimId: input.claimId,
    type: 'status_change',
    title: 'تغيير حالة المطالبة',
    toStatus: input.toStatus,
    createdBy: input.userId,
    createdAt: serverTimestamp(),
  });
}

export async function addClaimNote(input: {
  claimId: string;
  organizationId: string;
  userId: string;
  note: string;
}) {
  const note = input.note.trim();
  if (!note) throw new Error('EMPTY_NOTE');
  await addDoc(collection(db, 'claimActivities'), {
    organizationId: input.organizationId,
    claimId: input.claimId,
    type: 'note',
    title: note,
    createdBy: input.userId,
    createdAt: serverTimestamp(),
  });
}

export async function createClaimTask(input: {
  claimId: string;
  organizationId: string;
  userId: string;
  title: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}) {
  const title = input.title.trim();
  if (!title) throw new Error('EMPTY_TASK_TITLE');
  const task = await addDoc(collection(db, 'tasks'), {
    organizationId: input.organizationId,
    title,
    description: '',
    priority: input.priority,
    status: 'open',
    dueDate: input.dueDate,
    assignedTo: '',
    relatedType: 'claim',
    relatedId: input.claimId,
    createdBy: input.userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, 'claimActivities'), {
    organizationId: input.organizationId,
    claimId: input.claimId,
    type: 'task_created',
    title,
    createdBy: input.userId,
    createdAt: serverTimestamp(),
  });
  return task.id;
}

export async function listClaimActivities(organizationId: string, claimId: string): Promise<ClaimActivity[]> {
  const q = query(
    collection(db, 'claimActivities'),
    where('organizationId', '==', organizationId),
    where('claimId', '==', claimId),
    orderBy('createdAt', 'desc'),
    limit(100),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ClaimActivity));
}
