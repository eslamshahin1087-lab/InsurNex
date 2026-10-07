import { addDoc, collection, doc, getDocs, limit, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../../firebase/config';

export type OperationKind = 'policy_issuance' | 'endorsement' | 'cancellation' | 'collection' | 'commission';
export type OperationPriority = 'low' | 'medium' | 'high' | 'urgent';
export type InsuranceLine = 'medical' | 'motor' | 'property' | 'marine' | 'life' | 'liability' | 'other';
export type OperationStatus = 'request' | 'data_collection' | 'market_submission' | 'quotation' | 'client_approval' | 'binding' | 'policy_issuance' | 'policy_checking' | 'review' | 'in_progress' | 'waiting' | 'completed' | 'cancelled';

export interface OperationWorkItem {
  id:string; organizationId:string; kind:OperationKind; title:string;
  insuranceLine?:InsuranceLine; responsibleEmail?:string;
  clientId?:string; clientName?:string; policyId?:string; policyNumber?:string; insurerName?:string;
  priority:OperationPriority; status:OperationStatus; ownerId?:string; ownerName?:string;
  dueDate?:string; notes?:string; createdBy:string; createdAt?:unknown; updatedAt?:unknown;
}
export type CreateOperationInput = Omit<OperationWorkItem,'id'|'organizationId'|'createdBy'|'createdAt'|'updatedAt'>;
export type OperationEvent = {id:string;organizationId:string;operationId:string;action:string;note?:string;createdBy:string;createdAt?:unknown};

export const POLICY_ISSUANCE_STAGES:OperationStatus[]=['request','data_collection','market_submission','quotation','client_approval','binding','policy_issuance','policy_checking','completed'];

export async function createOperation(input:CreateOperationInput,organizationId:string,uid:string){
 const ref=await addDoc(collection(db,'operations'),{...input,organizationId,createdBy:uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
 await addOperationEvent(organizationId,ref.id,uid,'created',input.notes); return ref;
}
export async function updateOperationStatus(id:string,status:OperationStatus,organizationId?:string,uid?:string){
 await updateDoc(doc(db,'operations',id),{status,updatedAt:serverTimestamp()});
 if(organizationId&&uid) await addOperationEvent(organizationId,id,uid,`status:${status}`);
}
export async function advanceOperation(item:OperationWorkItem,uid:string){
 if(item.kind!=='policy_issuance') return;
 const index=POLICY_ISSUANCE_STAGES.indexOf(item.status);
 const next=POLICY_ISSUANCE_STAGES[Math.min(Math.max(index,0)+1,POLICY_ISSUANCE_STAGES.length-1)];
 await updateOperationStatus(item.id,next,item.organizationId,uid);
}
export async function addOperationEvent(organizationId:string,operationId:string,uid:string,action:string,note?:string){
 await addDoc(collection(db,'operationEvents'),{organizationId,operationId,action,note:note||'',createdBy:uid,createdAt:serverTimestamp()});
}
export async function listOperationEvents(organizationId:string){
 const s=await getDocs(query(collection(db,'operationEvents'),where('organizationId','==',organizationId),limit(300)));
 return s.docs.map(d=>({id:d.id,...d.data()} as OperationEvent));
}
