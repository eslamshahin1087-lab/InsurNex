import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase/config';

const COUNTERS = 'clientCounters';

/**
 * Generate a unique client code scoped per organization.
 * Format: CLI-YYYY-NNNN
 * Example: CLI-2026-0001
 *
 * Uses Firestore transaction to guarantee atomic increment.
 * Counter document: clientCounters/{orgId}-{year}
 */
export async function generateClientCode(
  organizationId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const counterId = `${organizationId}-${year}`;
  const counterRef = doc(db, COUNTERS, counterId);

  const sequence = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);

    if (!snap.exists()) {
      tx.set(counterRef, {
        organizationId,
        year,
        count: 1,
        updatedAt: serverTimestamp(),
      });
      return 1;
    }

    const current = (snap.data() as { count?: number }).count ?? 0;
    const next = current + 1;

    tx.update(counterRef, {
      count: next,
      updatedAt: serverTimestamp(),
    });

    return next;
  });

  const padded = String(sequence).padStart(4, '0');
  return `CLI-${year}-${padded}`;
}

/**
 * Peek at the next code without incrementing (for preview).
 * Not transactional — may be stale.
 */
export async function peekNextClientCode(
  organizationId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const counterId = `${organizationId}-${year}`;
  const snap = await getDoc(doc(db, COUNTERS, counterId));
  const current = snap.exists()
    ? (snap.data() as { count?: number }).count ?? 0
    : 0;
  const next = current + 1;
  const padded = String(next).padStart(4, '0');
  return `CLI-${year}-${padded}`;
}