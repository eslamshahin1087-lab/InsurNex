import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type {
  ArchiveAction,
  ArchiveEntry,
  ArchiveSource,
  ArchiveType,
} from './archive.types';
import { ARCHIVE_SOURCE_LABELS } from './archive.types';

// ============================================================
// ARCHIVE AN ITEM
// ============================================================

export interface ArchiveInput {
  type: ArchiveType;
  action: ArchiveAction;
  source: ArchiveSource;
  data: Record<string, unknown>;
  deletedBy: string;
  deletedByName: string;
  deletedByEmail?: string;
  reason?: string;
}

export async function archiveItem(input: ArchiveInput): Promise<string> {
  const ref = await addDoc(collection(db, 'archives'), {
    type: input.type,
    action: input.action,
    source: input.source,
    sourceLabel: ARCHIVE_SOURCE_LABELS[input.source] || input.source,
    deletedBy: input.deletedBy,
    deletedByName: input.deletedByName,
    deletedByEmail: input.deletedByEmail || '',
    deletedAt: serverTimestamp(),
    reason: input.reason || '',
    data: input.data,
  });
  return ref.id;
}

// ============================================================
// LIST ARCHIVE
// ============================================================

export interface ArchiveFilters {
  type?: ArchiveType | 'all';
  action?: ArchiveAction | 'all';
  source?: ArchiveSource | 'all';
  daysBack?: number;
  limitCount?: number;
}

export async function listArchive(filters: ArchiveFilters = {}): Promise<ArchiveEntry[]> {
  const constraints: Parameters<typeof query>[1][] = [];

  if (filters.type && filters.type !== 'all') {
    constraints.push(where('type', '==', filters.type));
  }
  if (filters.action && filters.action !== 'all') {
    constraints.push(where('action', '==', filters.action));
  }
  if (filters.source && filters.source !== 'all') {
    constraints.push(where('source', '==', filters.source));
  }

  const q = query(
    collection(db, 'archives'),
    ...constraints,
    orderBy('deletedAt', 'desc'),
    limit(filters.limitCount ?? 500),
  );

  const snap = await getDocs(q);
  let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ArchiveEntry));

  if (filters.daysBack && filters.daysBack > 0) {
    const cutoff = Date.now() - filters.daysBack * 86400000;
    rows = rows.filter((r) => {
      const v = r.deletedAt as { seconds?: number } | undefined;
      if (!v?.seconds) return true;
      return v.seconds * 1000 >= cutoff;
    });
  }

  return rows;
}

// ============================================================
// GET ONE
// ============================================================

export async function getArchiveEntry(id: string): Promise<ArchiveEntry | null> {
  const snap = await getDoc(doc(db, 'archives', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ArchiveEntry;
}

// ============================================================
// RESTORE
// ============================================================

export interface RestoreResult {
  success: boolean;
  error?: string;
  collectionPath?: string;
  documentId?: string;
}

function inferCollectionPath(entry: ArchiveEntry): { coll: string; id: string } | null {
  const data = entry.data;
  switch (entry.type) {
    case 'code':
      return { coll: 'subscriptionCodes', id: String(data.code || '') };
    case 'user':
      return { coll: 'users', id: String(data.uid || data.id || '') };
    case 'subscription':
      return {
        coll: 'organizationSubscriptions',
        id: String(data.organizationId || ''),
      };
    case 'organization':
      return { coll: 'organizations', id: String(data.id || '') };
    case 'ad':
      return { coll: 'ads', id: String(data.id || '') };
    default:
      return null;
  }
}

/**
 * Restore an archived item.
 * - Writes all data back with `setDoc(..., { merge: true })`.
 * - Firestore Timestamps are preserved as-is.
 * - Marks the archive entry as restored.
 */
export async function restoreArchiveEntry(
  id: string,
  restoredBy: string,
): Promise<RestoreResult> {
  const entry = await getArchiveEntry(id);
  if (!entry) return { success: false, error: 'NOT_FOUND' };
  if (entry.restoredAt) return { success: false, error: 'ALREADY_RESTORED' };

  const target = inferCollectionPath(entry);
  if (!target || !target.id) return { success: false, error: 'CANNOT_INFER_TARGET' };

  try {
    // Clone data, strip only the internal 'id' helper if present
    const cleanData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(entry.data)) {
      if (key === 'id') continue; // helper only
      cleanData[key] = value;
    }

    await setDoc(doc(db, target.coll, target.id), cleanData, { merge: true });

    await updateDoc(doc(db, 'archives', id), {
      restoredAt: serverTimestamp(),
      restoredBy,
    });

    return { success: true, collectionPath: target.coll, documentId: target.id };
  } catch (e) {
    console.error('Restore error:', e);
    const msg = e instanceof Error ? e.message : 'UNKNOWN';
    return { success: false, error: msg };
  }
}

// ============================================================
// PERMANENT DELETE
// ============================================================

export async function permanentlyDeleteArchive(id: string): Promise<void> {
  await deleteDoc(doc(db, 'archives', id));
}