import { addDoc, collection, doc, getDocs, limit, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import {updateRfqStatusV976} from '../rfq/rfq.service';

export type OperationKind = 'policy_issuance' | 'endorsement' | 'cancellation' | 'collection' | 'commission';
export type OperationPriority = 'low' | 'medium' | 'high' | 'urgent';
export type InsuranceLine = 'medical' | 'motor' | 'property' | 'marine' | 'life' | 'liability' | 'other';
export type OperationStatus = 'request' | 'data_collection' | 'market_submission' | 'quotation' | 'client_approval' | 'binding' | 'policy_issuance' | 'policy_checking' | 'review' | 'in_progress' | 'waiting' | 'completed' | 'cancelled';

export interface OperationWorkItem {
  id:string; organizationId:string; kind:OperationKind; title:string;
  insuranceLine?:InsuranceLine; responsibleEmail?:string;
  clientId?:string; clientName?:string; policyId?:string; policyNumber?:string; insurerName?:string; insurerId?:string; rfqId?:string; quoteId?:string; quoteDocumentId?:string; quoteDocumentName?:string; premium?:number; currency?:string; approvalReason?:string;
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

export async function createIssuanceOperationFromQuoteV953(input:{organizationId:string;uid:string;clientId:string;clientName:string;rfqId:string;quoteId:string;insurerId:string;insurerName:string;insuranceLine:InsuranceLine;premium:number;currency:string;documentId?:string;documentName?:string;reason:string}){
 const existing=await getDocs(query(collection(db,'operations'),where('organizationId','==',input.organizationId),where('clientId','==',input.clientId),limit(300)));
 const duplicate=existing.docs.find(d=>{const x=d.data() as Record<string,unknown>;return x.kind==='policy_issuance'&&x.rfqId===input.rfqId&&x.quoteId===input.quoteId});
 if(duplicate){await updateDoc(duplicate.ref,{quoteDocumentId:input.documentId||'',quoteDocumentName:input.documentName||'',insurerId:input.insurerId,premium:input.premium,currency:input.currency,approvalReason:input.reason,updatedAt:serverTimestamp()});return duplicate.id;}
 const ref=await addDoc(collection(db,'operations'),{organizationId:input.organizationId,kind:'policy_issuance',title:'إصدار وثيقة - '+input.clientName+' - '+input.insurerName,insuranceLine:input.insuranceLine,clientId:input.clientId,clientName:input.clientName,insurerName:input.insurerName,insurerId:input.insurerId,rfqId:input.rfqId,quoteId:input.quoteId,quoteDocumentId:input.documentId||'',quoteDocumentName:input.documentName||'',premium:input.premium,currency:input.currency,approvalReason:input.reason,priority:'high',status:'request',notes:'Approved quote handoff from Operations comparison',createdBy:input.uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
 await addOperationEvent(input.organizationId,ref.id,input.uid,'issuance_created','RFQ '+input.rfqId+' | Quote '+input.quoteId+' | '+input.insurerName);
 return ref.id;
}

export async function completeIssuanceOperationV971(id:string,organizationId:string,uid:string,input:{policyId:string;policyNumber:string;policyDocumentId:string}){
 await updateDoc(doc(db,'operations',id),{status:'completed',policyId:input.policyId,policyNumber:input.policyNumber,policyDocumentId:input.policyDocumentId,completedAt:new Date().toISOString(),updatedAt:serverTimestamp()});
 await addOperationEvent(organizationId,id,uid,'issuance_completed','Policy '+input.policyId+' | '+input.policyNumber);
}

export async function closeIssuedRfqV976(rfqId?:string){if(rfqId)await updateRfqStatusV976(rfqId,'closed');}
