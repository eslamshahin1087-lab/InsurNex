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
  | 'task'
  | 'lead_linked'
  | 'rfq_created'
  | 'quote_received'
  | 'policy_issued_from_quote';

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
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(clientId)) {
    throw new Error('CLIENT_TIMELINE_CLIENT_ID_INVALID');
  }
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(organizationId)) {
    throw new Error('CLIENT_TIMELINE_ORGANIZATION_ID_INVALID');
  }
  if (!Number.isInteger(limitCount) || limitCount < 1) {
    throw new Error('CLIENT_TIMELINE_LIMIT_INVALID');
  }

  const safeLimit = Math.min(limitCount, 100);
  const timelineRef = collection(db, 'clients', clientId, 'timeline');
  const projectEvents = (snapshot: Awaited<ReturnType<typeof getDocs>>) =>
    snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }) as TimelineEvent)
      .filter((event) => event.organizationId === organizationId);

  try {
    const snapshot = await getDocs(query(
      timelineRef,
      orderBy('at', 'desc'),
      limit(safeLimit),
    ));
    return projectEvents(snapshot);
  } catch (error) {
    // Only an index/precondition failure may use the compatibility fallback.
    // Authorization and network failures must propagate unchanged.
    if (!(error && typeof error === 'object' && 'code' in error
      && error.code === 'failed-precondition')) {
      throw error;
    }
    const snapshot = await getDocs(timelineRef);
    const events = projectEvents(snapshot);
    events.sort((a, b) => {
      const left = (a.at as { seconds?: number })?.seconds ?? 0;
      const right = (b.at as { seconds?: number })?.seconds ?? 0;
      return right - left;
    });
    return events.slice(0, safeLimit);
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
    lead_linked: '🔗',
    rfq_created: '📨',
    quote_received: '💰',
    policy_issued_from_quote: '🛡️',
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
    lead_linked: 'primary',
    rfq_created: 'cyan',
    quote_received: 'success',
    policy_issued_from_quote: 'success',
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