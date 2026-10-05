import { collection,getDocs,limit,query,where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { AppTask } from '../../types/task';
import type { Claim } from '../../types/claim';
import { listRenewals, type RenewalItem } from '../renewals/renewal.service';
export type AppNotification={id:string;type:'task'|'claim'|'renewal'|'lead';title:string;body:string;severity:'info'|'warning'|'urgent';href:string};
export async function buildNotifications(org:string):Promise<AppNotification[]>{
 const [taskSnap,claimSnap,renewals]=await Promise.all([getDocs(query(collection(db,'tasks'),where('organizationId','==',org),limit(100))),getDocs(query(collection(db,'claims'),where('organizationId','==',org),limit(100))),listRenewals(org)]);
 const today=new Date().toISOString().slice(0,10); const tasks=taskSnap.docs.map(d=>({id:d.id,...d.data()} as AppTask)); const claims=claimSnap.docs.map(d=>({id:d.id,...d.data()} as Claim));
 const taskNotes:AppNotification[]=tasks.filter(t=>t.status!=='completed'&&t.dueDate<=today).map(t=>({id:`task-${t.id}`,type:t.relatedType==='lead'?'lead':'task',title:t.dueDate<today?'Ù…Ù‡Ù…Ø© Ù…ØªØ£Ø®Ø±Ø©':'Ù…Ù‡Ù…Ø© Ù…Ø³ØªØ­Ù‚Ø© Ø§Ù„ÙŠÙˆÙ…',body:t.title,severity:t.priority==='urgent'?'urgent':'warning',href:t.relatedType==='lead'&&t.relatedId?`/leads/${t.relatedId}`:'/tasks'}));
 const claimNotes:AppNotification[]=claims.filter(c=>['new','documents','additional_documents','review'].includes(c.status)).map(c=>({id:`claim-${c.id}`,type:'claim',title:'Ù…Ø·Ø§Ù„Ø¨Ø© ØªØ­ØªØ§Ø¬ Ù…ØªØ§Ø¨Ø¹Ø©',body:`${c.claimNumber} Â· ${c.clientName}`,severity:c.status==='additional_documents'?'urgent':'info',href:`/claims/${c.id}`}));
 const renewalNotes:AppNotification[]=(renewals as RenewalItem[]).filter(r=>r.daysLeft>=0&&r.daysLeft<=30).map(r=>({id:`renewal-${r.id}`,type:'renewal',title:'ØªØ¬Ø¯ÙŠØ¯ Ù‚Ø±ÙŠØ¨',body:`${r.policyNumber} Â· Ù…ØªØ¨Ù‚ÙŠ ${r.daysLeft} ÙŠÙˆÙ…`,severity:r.daysLeft<=7?'urgent':'warning',href:'/renewals'}));
 return [...taskNotes,...claimNotes,...renewalNotes].slice(0,30);
}