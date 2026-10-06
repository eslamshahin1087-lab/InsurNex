import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { listRenewals, type RenewalItem } from '../renewals/renewal.service';
import type { Claim } from '../../types/claim';
import type { AppTask } from '../../types/task';

export type OperationsSnapshot = { tasks: AppTask[]; claims: Claim[]; renewals: RenewalItem[] };

export async function loadOperationsSnapshot(organizationId: string): Promise<OperationsSnapshot> {
  const tasksQuery = query(collection(db, 'tasks'), where('organizationId', '==', organizationId), limit(200));
  const claimsQuery = query(collection(db, 'claims'), where('organizationId', '==', organizationId), limit(200));
  const [tasksSnapshot, claimsSnapshot, renewals] = await Promise.all([
    getDocs(tasksQuery), getDocs(claimsQuery), listRenewals(organizationId),
  ]);
  return {
    tasks: tasksSnapshot.docs.map((item) => ({ id: item.id, ...item.data() } as AppTask)),
    claims: claimsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Claim)),
    renewals,
  };
}
