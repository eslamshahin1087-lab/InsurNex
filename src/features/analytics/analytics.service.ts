import {
  collection,
  getDocs,
  limit,
  query,
  startAfter,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { buildAnalyticsSnapshot, type AnalyticsInput, type AnalyticsRow, type AnalyticsSnapshot } from './analytics-metrics.js';

const ANALYTICS_PAGE_SIZE = 500;
type AnalyticsCollection = keyof AnalyticsInput;

async function listAllOrganizationDocuments(
  collectionName: AnalyticsCollection,
  organizationId: string,
): Promise<AnalyticsRow[]> {
  const rows: AnalyticsRow[] = [];
  const baseQuery = query(
    collection(db, collectionName),
    where('organizationId', '==', organizationId),
  );
  let cursor: QueryDocumentSnapshot | undefined;

  while (true) {
    const pageQuery = cursor
      ? query(baseQuery, startAfter(cursor), limit(ANALYTICS_PAGE_SIZE))
      : query(baseQuery, limit(ANALYTICS_PAGE_SIZE));
    const snapshot = await getDocs(pageQuery);
    rows.push(...snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })));
    if (snapshot.size < ANALYTICS_PAGE_SIZE) break;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }

  return rows;
}

export async function loadAnalytics(organizationId: string): Promise<AnalyticsSnapshot> {
  if (!organizationId.trim()) throw new Error('ANALYTICS_ORGANIZATION_REQUIRED');
  const collectionNames: AnalyticsCollection[] = [
    'clients',
    'policies',
    'claims',
    'leads',
    'tasks',
  ];
  const entries = await Promise.all(
    collectionNames.map((collectionName) =>
      listAllOrganizationDocuments(collectionName, organizationId),
    ),
  );
  const [clients, policies, claims, leads, tasks] = entries as [
    AnalyticsRow[],
    AnalyticsRow[],
    AnalyticsRow[],
    AnalyticsRow[],
    AnalyticsRow[],
  ];

  return buildAnalyticsSnapshot(
    { clients, policies, claims, leads, tasks },
    new Date().toISOString(),
  );
}
