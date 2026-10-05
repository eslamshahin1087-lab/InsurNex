import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Lead, LeadInput, LeadStage } from '../../types/lead';

export type LeadActivityType = 'created'|'stage_changed'|'notes_updated'|'task_created'|'converted';
export type LeadActivity = { id:string; organizationId:string; leadId:string; type:LeadActivityType; message:string; createdBy:string; createdAt?:unknown };
const allowed:Record<LeadStage,LeadStage[]>={new:['contacted','lost'],contacted:['qualified','lost'],qualified:['quotation','lost'],quotation:['negotiation','won','lost'],negotiation:['won','lost'],won:[],lost:[]};
export const canMoveLeadToStage=(a:LeadStage,b:LeadStage)=>a===b||allowed[a].includes(b);
export const getAllowedLeadStages=(s:LeadStage)=>allowed[s];

async function activity(organizationId:string,leadId:string,type:LeadActivityType,message:string,uid:string){
 await addDoc(collection(db,'leadActivities'),{organizationId,leadId,type,message,createdBy:uid,createdAt:serverTimestamp()});
}
export async function createLead(input:LeadInput,organizationId:string,uid:string){
 const ref=await addDoc(collection(db,'leads'),{...input,name:input.name.trim(),companyName:input.companyName?.trim()||'',phone:input.phone.trim(),email:input.email.trim(),insuranceType:input.insuranceType.trim(),preferredInsurerId:input.preferredInsurerId?.trim()||'',preferredInsurerName:input.preferredInsurerName?.trim()||'',notes:input.notes?.trim()||'',lostReason:input.lostReason?.trim()||'',estimatedValue:Number(input.estimatedValue)||0,organizationId,createdBy:uid,lastActivityAt:serverTimestamp(),createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
 await activity(organizationId,ref.id,'created','ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ ÙØ±ØµØ© Ø§Ù„Ø¨ÙŠØ¹',uid); return ref.id;
}
export async function listLeads(org:string){const q=query(collection(db,'leads'),where('organizationId','==',org),orderBy('createdAt','desc'),limit(200));const s=await getDocs(q);return s.docs.map(d=>({id:d.id,...d.data()} as Lead));}
export async function getLead(id:string,organizationId?:string){const s=await getDoc(doc(db,'leads',id));if(!s.exists())return null;const lead={id:s.id,...s.data()} as Lead;if(organizationId&&lead.organizationId!==organizationId)return null;return lead;}
export async function listLeadActivities(org:string,leadId:string){const q=query(collection(db,'leadActivities'),where('organizationId','==',org),where('leadId','==',leadId),orderBy('createdAt','desc'),limit(100));const s=await getDocs(q);return s.docs.map(d=>({id:d.id,...d.data()} as LeadActivity));}
export async function setLeadStage(id:string,current:LeadStage,next:LeadStage,org?:string,uid?:string,lostReason?:string){
 if(!canMoveLeadToStage(current,next))throw new Error('INVALID_STAGE_TRANSITION'); const ref=doc(db,'leads',id); const s=await getDoc(ref); if(!s.exists())throw new Error('LEAD_NOT_FOUND'); const data=s.data() as Lead; if(org&&data.organizationId!==org)throw new Error('LEAD_ORG_MISMATCH');
 const p:Record<string,unknown>={stage:next,updatedAt:serverTimestamp(),lastActivityAt:serverTimestamp()}; if(next==='won'){p.wonAt=serverTimestamp();p.lostReason='';} if(next==='lost'){const r=lostReason?.trim()||'';if(!r)throw new Error('LOST_REASON_REQUIRED');p.lostReason=r;p.lostAt=serverTimestamp();}
 await updateDoc(ref,p); if(org&&uid)await activity(org,id,'stage_changed',`ØªØºÙŠØ±Øª Ø§Ù„Ù…Ø±Ø­Ù„Ø© Ù…Ù† ${current} Ø¥Ù„Ù‰ ${next}`,uid);
}
export async function updateLeadNotes(id:string,notes:string,org?:string,uid?:string){const ref=doc(db,'leads',id);const s=await getDoc(ref);if(!s.exists())throw new Error('LEAD_NOT_FOUND');if(org&&s.data().organizationId!==org)throw new Error('LEAD_ORG_MISMATCH');await updateDoc(ref,{notes:notes.trim(),lastActivityAt:serverTimestamp(),updatedAt:serverTimestamp()});if(org&&uid)await activity(org,id,'notes_updated','ØªÙ… ØªØ­Ø¯ÙŠØ« Ù…Ù„Ø§Ø­Ø¸Ø§Øª ÙØ±ØµØ© Ø§Ù„Ø¨ÙŠØ¹',uid);}
export async function convertWonLeadToClient(leadId:string,org:string,uid:string){
 const leadRef=doc(db,'leads',leadId); const clientRef=doc(collection(db,'clients'));
 const result=await runTransaction(db,async tx=>{const s=await tx.get(leadRef);if(!s.exists())throw new Error('LEAD_NOT_FOUND');const lead={id:s.id,...s.data()} as Lead;if(lead.organizationId!==org)throw new Error('LEAD_ORG_MISMATCH');if(lead.stage!=='won')throw new Error('LEAD_NOT_WON');if(lead.clientId)return {clientId:lead.clientId,created:false};tx.set(clientRef,{organizationId:org,type:lead.companyName?'company':'individual',status:'active',name:lead.name,email:lead.email||'',phone:lead.phone||'',notes:lead.notes||'',createdBy:uid,sourceLeadId:leadId,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});tx.update(leadRef,{clientId:clientRef.id,convertedAt:serverTimestamp(),lastActivityAt:serverTimestamp(),updatedAt:serverTimestamp()});return {clientId:clientRef.id,created:true};});
 if(result.created)await activity(org,leadId,'converted','ØªÙ… ØªØ­ÙˆÙŠÙ„ ÙØ±ØµØ© Ø§Ù„Ø¨ÙŠØ¹ Ø¥Ù„Ù‰ Ø¹Ù…ÙŠÙ„',uid);return result.clientId;
}
export async function recordLeadTaskActivity(org:string,leadId:string,uid:string,title:string){await activity(org,leadId,'task_created',`ØªÙ… Ø¥Ù†Ø´Ø§Ø¡ Ù…Ù‡Ù…Ø©: ${title}`,uid);}