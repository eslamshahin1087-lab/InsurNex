import { collection,getDocs,limit,query,where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { AppTask } from '../../types/task';
import type { Claim } from '../../types/claim';
import { listRenewals, type RenewalItem } from '../renewals/renewal.service';
export type AppNotification={id:string;type:'task'|'claim'|'renewal';title:string;body:string;severity:'info'|'warning'|'urgent';href:string};
export async function buildNotifications(org:string):Promise<AppNotification[]>{
 const [taskSnap,claimSnap,renewals]=await Promise.all([
  getDocs(query(collection(db,'tasks'),where('organizationId','==',org),limit(100))),
  getDocs(query(collection(db,'claims'),where('organizationId','==',org),limit(100))),
  listRenewals(org)
 ]);
 const today=new Date().toISOString().slice(0,10);
 const tasks=taskSnap.docs.map(d=>({id:d.id,...d.data()} as AppTask));
 const claims=claimSnap.docs.map(d=>({id:d.id,...d.data()} as Claim));
 const taskNotes=tasks.filter(t=>t.status!=='completed'&&t.dueDate<=today).map(t=>({id:`task-${t.id}`,type:'task' as const,title:t.dueDate<today?'مهمة متأخرة':'مهمة مستحقة اليوم',body:t.title,severity:(t.priority==='urgent'?'urgent':'warning') as 'urgent'|'warning',href:'/tasks'}));
 const claimNotes=claims.filter(c=>['new','documents','additional_documents','review'].includes(c.status)).map(c=>({id:`claim-${c.id}`,type:'claim' as const,title:'مطالبة تحتاج متابعة',body:`${c.claimNumber} · ${c.clientName}`,severity:(c.status==='additional_documents'?'urgent':'info') as 'urgent'|'info',href:`/claims/${c.id}`}));
 const renewalNotes=(renewals as RenewalItem[]).filter(r=>r.daysLeft>=0&&r.daysLeft<=30).map(r=>({id:`renewal-${r.id}`,type:'renewal' as const,title:'تجديد قريب',body:`${r.policyNumber} · متبقي ${r.daysLeft} يوم`,severity:(r.daysLeft<=7?'urgent':'warning') as 'urgent'|'warning',href:'/renewals'}));
 return [...taskNotes,...claimNotes,...renewalNotes].slice(0,30);
}
