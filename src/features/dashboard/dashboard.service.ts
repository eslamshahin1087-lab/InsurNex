import {
  collection,
  getCountFromServer,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';

import { db } from '../../firebase/config';

import {
  listRenewals,
  type RenewalItem,
} from '../renewals/renewal.service';

import {
  listTasks,
} from '../tasks/task.service';

import {
  buildNotifications,
} from '../notifications/notification.service';

import type {
  AppTask,
} from '../../types/task';

import type {
  Claim,
} from '../../types/claim';

export type DashboardData = {
  clients: number;
  activePolicies: number;
  openClaims: number;
  renewals: RenewalItem[];
  tasks: AppTask[];
  notificationCount: number;
};

export async function loadDashboard(
  organizationId: string,
): Promise<DashboardData> {
  const clientsQuery = query(
    collection(
      db,
      'clients',
    ),
    where(
      'organizationId',
      '==',
      organizationId,
    ),
  );

  const policiesQuery = query(
    collection(
      db,
      'policies',
    ),
    where(
      'organizationId',
      '==',
      organizationId,
    ),
    where(
      'status',
      '==',
      'active',
    ),
  );

  const claimsQuery = query(
    collection(
      db,
      'claims',
    ),
    where(
      'organizationId',
      '==',
      organizationId,
    ),
    limit(100),
  );

  const [
    clientsCount,
    policiesCount,
    claimsSnapshot,
    renewals,
    tasks,
    notifications,
  ] = await Promise.all([
    getCountFromServer(
      clientsQuery,
    ),

    getCountFromServer(
      policiesQuery,
    ),

    getDocs(
      claimsQuery,
    ),

    listRenewals(
      organizationId,
    ),

    listTasks(
      organizationId,
    ),

    buildNotifications(
      organizationId,
    ),
  ]);

  const claims: Claim[] =
    claimsSnapshot.docs.map(
      (claimDocument) => {
        return {
          id: claimDocument.id,
          ...claimDocument.data(),
        } as Claim;
      },
    );

  const openClaims =
    claims.filter(
      (claim) => {
        return (
          claim.status !== 'closed' &&
          claim.status !== 'rejected'
        );
      },
    ).length;

  const today =
    new Date()
      .toISOString()
      .slice(
        0,
        10,
      );

  const priorityTasks: AppTask[] =
    [...tasks]
      .filter(
        (task) => {
          return (
            task.status !==
            'completed'
          );
        },
      )
      .sort(
        (a, b) => {
          const aIsDue =
            Boolean(
              a.dueDate,
            ) &&
            a.dueDate <= today;

          const bIsDue =
            Boolean(
              b.dueDate,
            ) &&
            b.dueDate <= today;

          if (
            aIsDue &&
            !bIsDue
          ) {
            return -1;
          }

          if (
            !aIsDue &&
            bIsDue
          ) {
            return 1;
          }

          return (
            a.dueDate || ''
          ).localeCompare(
            b.dueDate || '',
          );
        },
      )
      .slice(
        0,
        5,
      );

  const upcomingRenewals:
    RenewalItem[] =
      renewals
        .filter(
          (renewal) => {
            return (
              renewal.daysLeft >=
              0
            );
          },
        )
        .slice(
          0,
          5,
        );

  return {
    clients:
      clientsCount
        .data()
        .count,

    activePolicies:
      policiesCount
        .data()
        .count,

    openClaims,

    renewals:
      upcomingRenewals,

    tasks:
      priorityTasks,

    notificationCount:
      notifications.length,
  };
}