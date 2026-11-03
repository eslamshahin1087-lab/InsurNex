import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  addDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { AppTask, TaskInput, TaskStatus } from '../../types/task';
import {
  canTransitionTaskStatus,
  normalizeTaskStatus,
} from './task-workflow';

export async function listTasks(org: string): Promise<AppTask[]> {
  const q = query(
    collection(db, 'tasks'),
    where('organizationId', '==', org),
    orderBy('dueDate', 'asc'),
    limit(100),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }) as AppTask);
}

export async function createTask(
  input: TaskInput,
  organizationId: string,
  uid: string,
) {
  return addDoc(collection(db, 'tasks'), {
    ...input,
    organizationId,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Change a task status only after verifying its current tenant and state.
 * The transaction prevents two stale clients from applying conflicting transitions.
 * Firestore Rules remain the authoritative authorization boundary.
 */
export async function setTaskStatus(
  taskId: string,
  organizationId: string,
  nextStatus: TaskStatus,
): Promise<void> {
  if (!taskId.trim() || !organizationId.trim()) {
    throw new Error('TASK_ID_AND_ORGANIZATION_REQUIRED');
  }
  if (!normalizeTaskStatus(nextStatus)) {
    throw new Error('INVALID_TASK_STATUS');
  }

  const taskRef = doc(db, 'tasks', taskId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(taskRef);
    if (!snapshot.exists()) throw new Error('TASK_NOT_FOUND');

    const current = snapshot.data();
    if (current.organizationId !== organizationId) {
      throw new Error('TASK_ORGANIZATION_MISMATCH');
    }

    const currentStatus = normalizeTaskStatus(current.status);
    if (!currentStatus) throw new Error('UNKNOWN_TASK_STATUS');
    if (!canTransitionTaskStatus(currentStatus, nextStatus)) {
      throw new Error('INVALID_TASK_TRANSITION');
    }

    transaction.update(taskRef, {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  });
}
