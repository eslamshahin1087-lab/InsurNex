import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { listRenewals, type RenewalItem } from '../renewals/renewal.service';
import { listTasks } from '../tasks/task.service';
import { buildNotifications } from '../notifications/notification.service';
import { getDashboardRoleAccess } from './dashboard-access.policy.js';
import type { AppTask } from '../../types/task';

export type DashboardData = {
  /** null means the current role is not allowed to read this aggregate. */
  clients: number | null;
  activePolicies: number | null;
  openClaims: number | null;
  renewals: RenewalItem[];
  tasks: AppTask[];
  notificationCount: number;
};

export async function loadDashboard(
  organizationId: string,
  role: string,
): Promise<DashboardData> {
  const access = getDashboardRoleAccess(role);

  const clientsQuery = query(
    collection(db, 'clients'),
    where('organizationId', '==', organizationId),
  );
  const policiesQuery = query(
    collection(db, 'policies'),
    where('organizationId', '==', organizationId),
    where('status', '==', 'active'),
  );
  const claimsQuery = query(
    collection(db, 'claims'),
    where('organizationId', '==', organizationId),
    limit(100),
  );

  // Do not issue a Firestore query when the current role is not permitted
  // to read the source collection. null distinguishes "not authorized"
  // from a genuine aggregate value of zero.
  const clientsCountPromise: Promise<number | null> = access.clients
    ? getCountFromServer(clientsQuery).then((snapshot) => snapshot.data().count)
    : Promise.resolve(null);

  const policiesCountPromise: Promise<number | null> = access.policies
    ? getCountFromServer(policiesQuery).then((snapshot) => snapshot.data().count)
    : Promise.resolve(null);

  const openClaimsPromise: Promise<number | null> = access.claims
    ? getDocs(claimsQuery).then((snapshot) => snapshot.docs.filter((item) => {
        const status = item.get('status');
        return status !== 'closed' && status !== 'rejected';
      }).length)
    : Promise.resolve(null);

  const renewalsPromise = access.policies
    ? listRenewals(organizationId)
    : Promise.resolve([]);

  const [
    clients,
    activePolicies,
    openClaims,
    renewals,
    tasks,
    notifications,
  ] = await Promise.all([
    clientsCountPromise,
    policiesCountPromise,
    openClaimsPromise,
    renewalsPromise,
    listTasks(organizationId),
    buildNotifications(organizationId, role),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const priorityTasks: AppTask[] = [...tasks]
    .filter((task) => task.status !== 'completed')
    .sort((a, b) => {
      const aIsDue = Boolean(a.dueDate) && a.dueDate <= today;
      const bIsDue = Boolean(b.dueDate) && b.dueDate <= today;
      if (aIsDue && !bIsDue) return -1;
      if (!aIsDue && bIsDue) return 1;
      return (a.dueDate || '').localeCompare(b.dueDate || '');
    })
    .slice(0, 5);

  const upcomingRenewals = renewals
    .filter((renewal) => renewal.daysLeft >= 0)
    .slice(0, 5);

  return {
    clients,
    activePolicies,
    openClaims,
    renewals: upcomingRenewals,
    tasks: priorityTasks,
    notificationCount: notifications.length,
  };
}
