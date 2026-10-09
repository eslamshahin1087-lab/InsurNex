import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../firebase/config'; import type { Policy, PolicyInput } from '../../types/insurance';
export async function createPolicy(input:PolicyInput,organizationId:string,uid:string,clientName:string,insurerName:string){const commissionAmount=Number((input.premium*(input.commissionRate/100)).toFixed(2));const ref=await addDoc(collection(db,'policies'),{...input,organizationId,createdBy:uid,clientName,insurerName,commissionAmount,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});return ref.id;}
export async function listPolicies(organizationId:string){const q=query(collection(db,'policies'),where('organizationId','==',organizationId),orderBy('createdAt','desc'),limit(100));const snap=await getDocs(q);return snap.docs.map(d=>({id:d.id,...d.data()} as Policy));}
export async function listClientPolicies(organizationId:string,clientId:string){const q=query(collection(db,'policies'),where('organizationId','==',organizationId),where('clientId','==',clientId),limit(50));const s=await getDocs(q);return s.docs.map(d=>({id:d.id,...d.data()} as Policy));}

export async function createIssuedPolicyV971(input:PolicyInput & {rfqId?:string;quoteId?:string;operationId?:string;documentId?:string},organizationId:string,uid:string,clientName:string,insurerName:string){
 const commissionAmount=Number((input.premium*(input.commissionRate/100)).toFixed(2));
 const ref=await addDoc(collection(db,'policies'),{...input,organizationId,createdBy:uid,clientName,insurerName,commissionAmount,rfqId:input.rfqId||'',quoteId:input.quoteId||'',operationId:input.operationId||'',documentId:input.documentId||'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
 return ref.id;
}
