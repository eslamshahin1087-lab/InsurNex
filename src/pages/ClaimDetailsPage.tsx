import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Activity, ArrowRight, CalendarDays, CheckCircle2, ClipboardCheck, FileText, ListTodo, MessageSquarePlus, Plus, ShieldCheck, UserRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../features/auth/auth-context';
import { getClaim } from '../features/claims/claim.service';
import { addClaimNote, createClaimTask, listClaimActivities, nextClaimStatuses, transitionClaimStatus, type ClaimActivity, type ClaimWorkflowStatus } from '../features/claims/claim-workflow.service';
import type { Claim } from '../types/claim';
import type { AppTask } from '../types/task';

const statusLabels: Record<string, string> = { new:'جديدة', documents:'استلام المستندات', submitted:'تم الإرسال', additional_documents:'مستندات إضافية', review:'مراجعة', approved:'معتمدة', settlement:'التسوية', rejected:'مرفوضة', closed:'مغلقة' };
const priorityLabels: Record<string, string> = { low:'منخفضة', medium:'متوسطة', high:'مرتفعة', urgent:'عاجلة' };
function money(value:number,currency:string){try{return new Intl.NumberFormat('ar-EG',{style:'currency',currency:currency||'EGP',maximumFractionDigits:0}).format(Number(value||0));}catch{return `${Number(value||0).toLocaleString('ar-EG')} ${currency||'EGP'}`;}}
function activityLabel(a:ClaimActivity){if(a.type==='status_change')return `تم تغيير الحالة إلى ${statusLabels[a.toStatus||'']||a.toStatus||''}`;if(a.type==='task_created')return `تم إنشاء مهمة: ${a.title}`;return a.title;}

export default function ClaimDetailsPage(){
 const {id}=useParams(); const {user,profile}=useAuth();
 const [claim,setClaim]=useState<Claim|null>(null); const [activities,setActivities]=useState<ClaimActivity[]>([]); const [tasks,setTasks]=useState<AppTask[]>([]);
 const [loading,setLoading]=useState(true); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [note,setNote]=useState('');
 const [taskTitle,setTaskTitle]=useState(''); const [taskDue,setTaskDue]=useState(''); const [taskPriority,setTaskPriority]=useState<'low'|'medium'|'high'|'urgent'>('medium');
 const load=useCallback(async()=>{if(!id||!profile){setLoading(false);return;}setLoading(true);setError('');try{const tasksQ=query(collection(db,'tasks'),where('organizationId','==',profile.organizationId),where('relatedType','==','claim'),where('relatedId','==',id),limit(100));const [c,a,t]=await Promise.all([getClaim(id),listClaimActivities(profile.organizationId,id),getDocs(tasksQ)]);setClaim(c);setActivities(a);setTasks(t.docs.map(d=>({id:d.id,...d.data()} as AppTask)));}catch{setError('تعذر تحميل ملف المطالبة.');}finally{setLoading(false);}},[id,profile]);
 useEffect(()=>{void load();},[load]);
 const next=useMemo(()=>claim?nextClaimStatuses(claim.status):[],[claim]); const openTasks=tasks.filter(t=>t.status!=='completed');
 async function changeStatus(to:ClaimWorkflowStatus){if(!id||!profile||!user)return;setBusy(true);setError('');try{await transitionClaimStatus({claimId:id,organizationId:profile.organizationId,userId:user.uid,toStatus:to});await load();}catch(e){setError(e instanceof Error&&e.message==='INVALID_CLAIM_TRANSITION'?'انتقال الحالة غير مسموح من الحالة الحالية.':'تعذر تحديث حالة المطالبة.');}finally{setBusy(false);}}
 async function submitNote(e:FormEvent){e.preventDefault();if(!id||!profile||!user||!note.trim())return;setBusy(true);try{await addClaimNote({claimId:id,organizationId:profile.organizationId,userId:user.uid,note});setNote('');await load();}catch{setError('تعذر إضافة الملاحظة.');}finally{setBusy(false);}}
 async function submitTask(e:FormEvent){e.preventDefault();if(!id||!profile||!user||!taskTitle.trim()||!taskDue)return;setBusy(true);try{await createClaimTask({claimId:id,organizationId:profile.organizationId,userId:user.uid,title:taskTitle,dueDate:taskDue,priority:taskPriority});setTaskTitle('');setTaskDue('');setTaskPriority('medium');await load();}catch{setError('تعذر إنشاء المهمة.');}finally{setBusy(false);}}
 if(loading)return <main className="mobile-page" dir="rtl"><div className="empty">جارٍ تحميل المطالبة...</div></main>;
 if(!claim)return <main className="mobile-page" dir="rtl"><div className="empty">{error||'لم يتم العثور على المطالبة.'}</div></main>;
 return <main className="mobile-page cl360" dir="rtl">
  <Link to="/claims" className="cl360-back"><ArrowRight size={18}/>العودة للمطالبات</Link>
  <section className="cl360-hero"><div className="cl360-icon"><ClipboardCheck/></div><div><span className="eyebrow">Claim 360</span><h1>{claim.claimNumber}</h1><p>{claim.clientName} · {claim.policyNumber||'بدون رقم وثيقة'} · {claim.insurerName||'شركة غير محددة'}</p><em className={'cl360-status st-'+claim.status}>{statusLabels[claim.status]||claim.status}</em></div></section>
  <section className="cl360-kpis"><article><UserRound/><small>العميل</small><b>{claim.clientName}</b></article><article><ShieldCheck/><small>الوثيقة</small><b>{claim.policyNumber||'غير محددة'}</b></article><article><FileText/><small>المبلغ</small><b>{money(claim.claimAmount,claim.currency)}</b></article><article><CalendarDays/><small>تاريخ الحادث</small><b>{claim.incidentDate||'غير محدد'}</b></article></section>
  <section className="cl360-section"><header><div><span className="eyebrow">Workflow</span><h2>الإجراء التالي</h2></div></header>{next.length===0?<div className="empty">لا يوجد انتقال حالة متاح.</div>:<div className="cl360-transitions">{next.map(s=><button type="button" disabled={busy} key={s} onClick={()=>void changeStatus(s)}><CheckCircle2/>{statusLabels[s]||s}</button>)}</div>}{error&&<p className="cl360-error">{error}</p>}</section>
  <section className="cl360-section"><header><h2>التنقل المرتبط</h2></header><div className="cl360-links">{claim.clientId&&<Link to={'/clients/'+claim.clientId}><UserRound/>Client 360</Link>}<Link to="/policies"><ShieldCheck/>الوثائق</Link><Link to="/tasks"><ListTodo/>المهام</Link></div></section>
  <section className="cl360-section"><header><div><span className="eyebrow">Tasks</span><h2>مهام المطالبة</h2></div><small>{openTasks.length} مفتوحة</small></header><form className="cl360-task-form" onSubmit={submitTask}><input required value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="عنوان المهمة"/><input required type="date" value={taskDue} onChange={e=>setTaskDue(e.target.value)}/><select value={taskPriority} onChange={e=>setTaskPriority(e.target.value as typeof taskPriority)}><option value="low">منخفضة</option><option value="medium">متوسطة</option><option value="high">مرتفعة</option><option value="urgent">عاجلة</option></select><button disabled={busy}><Plus/>إضافة مهمة</button></form>{tasks.length===0?<div className="empty">لا توجد مهام مرتبطة.</div>:<div className="cl360-feed">{tasks.map(t=><Link to="/tasks" key={t.id}><span><ListTodo/></span><div><b>{t.title}</b><small>{t.dueDate||'بدون تاريخ'} · {priorityLabels[t.priority]||t.priority}</small></div></Link>)}</div>}</section>
  <section className="cl360-section"><header><div><span className="eyebrow">Notes</span><h2>إضافة ملاحظة</h2></div></header><form className="cl360-note-form" onSubmit={submitNote}><textarea required value={note} onChange={e=>setNote(e.target.value)} placeholder="اكتب ملاحظة على المطالبة..."/><button disabled={busy}><MessageSquarePlus/>حفظ الملاحظة</button></form></section>
  <section className="cl360-section cl360-last"><header><div><span className="eyebrow">Activity</span><h2>سجل النشاط</h2></div><small>{activities.length} نشاط</small></header>{activities.length===0?<div className="empty">لا يوجد نشاط مسجل بعد.</div>:<div className="cl360-timeline">{activities.map(a=><article key={a.id}><span><Activity/></span><div><b>{activityLabel(a)}</b><small>{a.type==='status_change'?'تغيير حالة':a.type==='task_created'?'مهمة':'ملاحظة'}</small></div></article>)}</div>}</section>
 </main>;
}
