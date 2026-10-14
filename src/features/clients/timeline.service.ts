import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
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
    collection(db, 'clients', params.clientId, 'timeline'),
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
// NOTE: No `where` clause — the subcollection is already
// scoped to a single client by its path. Adding a `where`
// would require a composite index, which we don't need.

export async function listTimelineEvents(
  clientId: string,
  organizationId: string,
  limitCount = 100,
): Promise<TimelineEvent[]> {
  try {
    const q = query(
      collection(db, 'clients', clientId, 'timeline'),
      orderBy('at', 'desc'),
      limit(limitCount),
    );
    const snap = await getDocs(q);
    const events = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as TimelineEvent),
    );
    // Safety filter by organizationId (no index needed)
    return events.filter(
      (e) => !e.organizationId || e.organizationId === organizationId,
    );
  } catch (e) {
    // Fallback: if orderBy fails (no index), fetch without orderBy
    console.warn('Timeline orderBy failed, falling back to unordered:', e);
    const snap = await getDocs(
      collection(db, 'clients', clientId, 'timeline'),
    );
    const events = snap.docs.map(
      (d) => ({ id: d.id, ...d.data() } as TimelineEvent),
    );
    // Sort client-side
    events.sort((a, b) => {
      const ta = (a.at as { seconds?: number })?.seconds ?? 0;
      const tb = (b.at as { seconds?: number })?.seconds ?? 0;
      return tb - ta;
    });
    return events
      .filter(
        (e) => !e.organizationId || e.organizationId === organizationId,
      )
      .slice(0, limitCount);
  }
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