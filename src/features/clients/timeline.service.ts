import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase/config';

// ============================================================
// Timeline Event Types
// ============================================================

export type TimelineEventType =
  | 'created'
  | 'updated'
  | 'document_added'
  | 'document_removed'
  | 'policy_added'
  | 'claim_opened'
  | 'renewal'
  | 'note'
  | 'call'
  | 'meeting'
  | 'email'
  | 'task';

export interface TimelineEvent {
  id: string;
  clientId: string;
  organizationId: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  by: string;
  byName?: string;
  at: unknown;
  metadata?: Record<string, unknown>;
}

const COLLECTION = 'timeline';

// ============================================================
// Add an event
// ============================================================

export async function addTimelineEvent(params: {
  clientId: string;
  organizationId: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  by: string;
  byName?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const ref = await addDoc(
    collection(db, 'clients', params.clientId, COLLECTION),
    {
      clientId: params.clientId,
      organizationId: params.organizationId,
      type: params.type,
      title: params.title,
      description: params.description || '',
      by: params.by,
      byName: params.byName || '',
      at: serverTimestamp(),
      metadata: params.metadata || {},
    },
  );
  return ref.id;
}

// ============================================================
// List events (newest first)
// ============================================================

export async function listTimelineEvents(
  clientId: string,
  organizationId: string,
  limitCount = 100,
): Promise<TimelineEvent[]> {
  const q = query(
    collection(db, 'clients', clientId, COLLECTION),
    where('organizationId', '==', organizationId),
    orderBy('at', 'desc'),
    limit(limitCount),
  );
  const snap = await getDocs(q);
  return snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as TimelineEvent),
  );
}

// ============================================================
// Helpers
// ============================================================

export function timelineIcon(type: TimelineEventType): string {
  const map: Record<TimelineEventType, string> = {
    created: '🎉',
    updated: '✏️',
    document_added: '📄',
    document_removed: '🗑️',
    policy_added: '🛡️',
    claim_opened: '⚠️',
    renewal: '🔄',
    note: '📝',
    call: '📞',
    meeting: '👥',
    email: '✉️',
    task: '✅',
  };
  return map[type] || '•';
}

export function timelineTone(type: TimelineEventType): string {
  const map: Record<TimelineEventType, string> = {
    created: 'success',
    updated: 'primary',
    document_added: 'cyan',
    document_removed: 'danger',
    policy_added: 'success',
    claim_opened: 'warning',
    renewal: 'warning',
    note: 'neutral',
    call: 'primary',
    meeting: 'purple',
    email: 'cyan',
    task: 'success',
  };
  return map[type] || 'neutral';
}

export function formatTimelineDate(value: unknown): string {
  if (!value) return '—';
  const t = value as { toDate?: () => Date; seconds?: number };
  let d: Date | undefined;
  if (typeof t.toDate === 'function') d = t.toDate();
  else if (typeof t.seconds === 'number') d = new Date(t.seconds * 1000);
  if (!d) return '—';
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}