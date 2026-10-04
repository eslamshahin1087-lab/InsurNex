import { addDoc, collection, getDoc, getDocs, doc, limit, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Claim, ClaimInput } from '../../types/claim';
import type { Policy } from '../../types/insurance';

export async function listClaims(organizationId: string) {
  const q = query(collection(db, 'claims'), where('organizationId', '==', organizationId), orderBy('createdAt', 'desc'), limit(100));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Claim));
}

export async function getClaim(id: string) {
  const snap = await getDoc(doc(db, 'claims', id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Claim) : null;
}

export async function createClaim(input: ClaimInput, organizationId: string, uid: string, policy: Policy) {
  const ref = await addDoc(collection(db, 'claims'), {
    ...input,
    organizationId,
    clientName: policy.clientName,
    policyNumber: policy.policyNumber,
    insurerId: policy.insurerId,
    insurerName: policy.insurerName,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}
