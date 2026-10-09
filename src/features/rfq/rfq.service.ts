import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { CreateRfqInput, MarketSubmissionStatus, RfqRecord, RfqStatus } from './rfq-types';

const RFQ_COLLECTION = 'rfqs';

export async function createRfq(input: CreateRfqInput) {
  if (!input.organizationId || !input.clientId || !input.createdBy) throw new Error('RFQ_REQUIRED_CONTEXT');
  if (!input.insuranceType.trim()) throw new Error('RFQ_INSURANCE_TYPE_REQUIRED');
  if (!input.insurers.length) throw new Error('RFQ_INSURER_REQUIRED');
  const ref = await addDoc(collection(db, RFQ_COLLECTION), {
    ...input,
    status: 'draft',
    insurers: input.insurers.map((item) => ({ ...item, status: 'draft' })),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listClientRfqs(organizationId: string, clientId: string) {
  const snapshot = await getDocs(query(
    collection(db, RFQ_COLLECTION),
    where('organizationId', '==', organizationId),
    where('clientId', '==', clientId),
  ));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as RfqRecord));
}

export async function updateRfqStatus(id: string, status: RfqStatus) {
  await updateDoc(doc(db, RFQ_COLLECTION, id), { status, updatedAt: serverTimestamp() });
}

export async function updateSubmissionStatus(id: string, insurerId: string, status: MarketSubmissionStatus) {
  const ref = doc(db, RFQ_COLLECTION, id);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('RFQ_NOT_FOUND');
  const data = snapshot.data() as RfqRecord;
  const insurers = (data.insurers || []).map((item) => item.insurerId === insurerId
    ? { ...item, status, ...(status === 'sent' ? { sentAt: new Date().toISOString() } : {}) }
    : item);
  await updateDoc(ref, { insurers, updatedAt: serverTimestamp() });
}

export async function updateRfqDetails(id:string,input:{insuranceType:string;coverageSummary:string;documentIds:string[];insurers:Array<{insurerId:string;insurerName:string;status:MarketSubmissionStatus}>}){await updateDoc(doc(db,RFQ_COLLECTION,id),{...input,updatedAt:serverTimestamp()});}

export async function updateSubmissionMeta(id:string,insurerId:string,patch:Partial<{recipientEmail:string;sentAt:string;followUpAt:string;quoteReceivedAt:string;notes:string}>){const ref=doc(db,RFQ_COLLECTION,id);const snap=await getDoc(ref);if(!snap.exists())throw new Error('RFQ_NOT_FOUND');const data=snap.data() as RfqRecord;const insurers=(data.insurers||[]).map(x=>x.insurerId===insurerId?{...x,...patch}:x);await updateDoc(ref,{insurers,updatedAt:serverTimestamp()});}

export async function listOrganizationRfqs(organizationId:string){const snapshot=await getDocs(query(collection(db,RFQ_COLLECTION),where('organizationId','==',organizationId)));return snapshot.docs.map(item=>({id:item.id,...item.data()} as RfqRecord));}

export async function updateRfqStatusV976(id:string,status:'draft'|'ready'|'submitted'|'quotes_received'|'closed'){
 await updateDoc(doc(db,'rfqs',id),{status,updatedAt:serverTimestamp()});
}

export async function recordRepricingRequestV981(id:string,insurerId:string,input:{recipientEmail:string;reason:string}){
 const ref=doc(db,RFQ_COLLECTION,id);const snap=await getDoc(ref);if(!snap.exists())throw new Error('RFQ_NOT_FOUND');const data=snap.data() as RfqRecord;
 const insurers=(data.insurers||[]).map(x=>x.insurerId===insurerId?{...x,status:'follow_up' as const,recipientEmail:input.recipientEmail,followUpAt:new Date().toISOString(),notes:['REPRICING',input.reason].join(' | ')}:x);
 await updateDoc(ref,{status:'submitted',insurers,updatedAt:serverTimestamp()});
}
