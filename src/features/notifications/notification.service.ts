import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { AppTask } from '../../types/task';
import type { Claim } from '../../types/claim';
import { listRenewals, type RenewalItem } from '../renewals/renewal.service';
import { getDashboardRoleAccess } from '../dashboard/dashboard-access.policy.js';

export type AppNotification = {
  id: string;
  type: 'task' | 'claim' | 'renewal' | 'lead';
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'urgent';
  href: string;
};

/**
 * Dashboard notification inputs follow the same collection-level read matrix
 * as dashboard metrics. Tasks are visible to all active organization roles;
 * claims and renewal notices are queried only when Rules permit their sources.
 */
export async function buildNotifications(
  org: string,
  role: string,
): Promise<AppNotification[]> {
  const access = getDashboardRoleAccess(role);
  const taskQuery = query(
    collection(db, 'tasks'),
    where('organizationId', '==', org),
    limit(100),
  );
  const claimQuery = query(
    collection(db, 'claims'),
    where('organizationId', '==', org),
    limit(100),
  );

  const [taskSnapshot, claimSnapshot, renewals] = await Promise.all([
    getDocs(taskQuery),
    access.claims ? getDocs(claimQuery) : Promise.resolve(null),
    access.policies ? listRenewals(org) : Promise.resolve([] as RenewalItem[]),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const tasks = taskSnapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }) as AppTask);
  const claims: Claim[] = claimSnapshot?.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }) as Claim) ?? [];

  const taskNotes: AppNotification[] = tasks
    .filter((task) => task.status !== 'completed' && task.dueDate <= today)
    .map((task) => ({
      id: `task-${task.id}`,
      type: task.relatedType === 'lead' ? 'lead' : 'task',
      title: task.dueDate < today ? 'مهمة متأخرة' : 'مهمة مستحقة اليوم',
      body: task.title,
      severity: task.priority === 'urgent' ? 'urgent' : 'warning',
      href: task.relatedType === 'lead' && task.relatedId
        ? `/leads/${task.relatedId}`
        : '/tasks',
    }));

  const claimNotes: AppNotification[] = claims
    .filter((claim) => ['new', 'documents', 'additional_documents', 'review'].includes(claim.status))
    .map((claim) => ({
      id: `claim-${claim.id}`,
      type: 'claim',
      title: 'مطالبة تحتاج متابعة',
      body: `${claim.claimNumber} · ${claim.clientName}`,
      severity: claim.status === 'additional_documents' ? 'urgent' : 'info',
      href: `/claims/${claim.id}`,
    }));

  const renewalNotes: AppNotification[] = renewals
    .filter((renewal) => renewal.daysLeft >= 0 && renewal.daysLeft <= 30)
    .map((renewal) => ({
      id: `renewal-${renewal.id}`,
      type: 'renewal',
      title: 'تجديد قريب',
      body: `${renewal.policyNumber} · متبقي ${renewal.daysLeft} يوم`,
      severity: renewal.daysLeft <= 7 ? 'urgent' : 'warning',
      href: '/renewals',
    }));

  return [...taskNotes, ...claimNotes, ...renewalNotes].slice(0, 30);
}
