import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { listRenewals, type RenewalItem } from '../renewals/renewal.service';
import type { Claim } from '../../types/claim';
import type { AppTask } from '../../types/task';
import type { OperationWorkItem } from './operations-workflow.service';

export type OperationsSnapshot = { tasks: AppTask[]; claims: Claim[]; renewals: RenewalItem[]; workItems: OperationWorkItem[] };

export async function loadOperationsSnapshot(organizationId: string): Promise<OperationsSnapshot> {
  const q = (name: string, max: number) => query(collection(db, name), where('organizationId', '==', organizationId), limit(max));
  const [tasksSnapshot, claimsSnapshot, renewals, operationsSnapshot] = await Promise.all([
    getDocs(q('tasks', 250)),
    getDocs(q('claims', 250)),
    listRenewals(organizationId),
    getDocs(q('operations', 250)),
  ]);
  return {
    tasks: tasksSnapshot.docs.map((item) => ({ id: item.id, ...item.data() } as AppTask)),
    claims: claimsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Claim)),
    renewals,
    workItems: operationsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() } as OperationWorkItem)),
  };
}
