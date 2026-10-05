param(
  [switch]$Rollback
)

$ErrorActionPreference = "Stop"
$Project = (Get-Location).Path
$Backup = Join-Path $Project ".insurnex-leads2-backup"

$files = @(
  "src\types\task.ts",
  "src\features\tasks\task-relation.ts",
  "src\features\leads\lead.service.ts",
  "src\features\notifications\notification.service.ts",
  "src\pages\LeadDetailsPage.tsx",
  "firestore.indexes.json"
)

function Assert-Project {
  if (-not (Test-Path (Join-Path $Project "package.json"))) { throw "Run this script from the InsurNex project root." }
  if (-not (Test-Path (Join-Path $Project "src\App.tsx"))) { throw "src\\App.tsx not found." }
}
function Write-Utf8([string]$Path, [string]$Text) {
  $dir = Split-Path -Parent $Path
  if ($dir -and -not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  [IO.File]::WriteAllText($Path, $Text, [Text.UTF8Encoding]::new($false))
}
function Backup-Files {
  if (Test-Path $Backup) { throw "Backup already exists: $Backup . Roll back or remove it only after verification." }
  New-Item -ItemType Directory -Force -Path $Backup | Out-Null
  foreach ($rel in $files) {
    $src = Join-Path $Project $rel
    if (Test-Path $src) {
      $dst = Join-Path $Backup $rel
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dst) | Out-Null
      Copy-Item $src $dst -Force
    }
  }
  Write-Utf8 (Join-Path $Backup "manifest.txt") (($files -join [Environment]::NewLine) + [Environment]::NewLine)
}
function Restore-Files {
  if (-not (Test-Path $Backup)) { throw "Backup not found: $Backup" }
  foreach ($rel in $files) {
    $src = Join-Path $Backup $rel
    $dst = Join-Path $Project $rel
    if (Test-Path $src) {
      New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dst) | Out-Null
      Copy-Item $src $dst -Force
    }
  }
  Write-Host "Rollback complete." -ForegroundColor Green
}

Assert-Project
if ($Rollback) { Restore-Files; exit 0 }
Backup-Files

Write-Utf8 (Join-Path $Project "src\types\task.ts") @'
export type TaskPriority='low'|'medium'|'high'|'urgent';
export type TaskStatus='open'|'in_progress'|'completed';
export type TaskRelatedType='general'|'client'|'policy'|'renewal'|'claim'|'lead';
export interface AppTask {id:string;organizationId:string;title:string;description:string;priority:TaskPriority;status:TaskStatus;dueDate:string;assignedTo:string;relatedType:TaskRelatedType;relatedId:string;createdBy:string;createdAt?:unknown;updatedAt?:unknown;}
export type TaskInput=Omit<AppTask,'id'|'organizationId'|'createdBy'|'createdAt'|'updatedAt'>;
'@

Write-Utf8 (Join-Path $Project "src\features\tasks\task-relation.ts") @'
export type TaskRelationType = 'client' | 'claim' | 'policy' | 'renewal' | 'lead' | 'general';
export type TaskRelation = { type: TaskRelationType; id: string; label: string; href: string };

export function resolveTaskRelation(relatedType?: string, relatedId?: string): TaskRelation {
  const type = (relatedType || 'general') as TaskRelationType;
  const id = relatedId || '';
  if (type === 'client' && id) return { type, id, label: 'ملف العميل', href: `/clients/${id}` };
  if (type === 'claim' && id) return { type, id, label: 'المطالبة', href: `/claims/${id}` };
  if (type === 'lead' && id) return { type, id, label: 'فرصة البيع', href: `/leads/${id}` };
  if (type === 'policy') return { type, id, label: 'الوثيقة', href: '/policies' };
  if (type === 'renewal') return { type, id, label: 'التجديد', href: '/renewals' };
  return { type: 'general', id: '', label: 'مهمة عامة', href: '/tasks' };
}

export function taskRelationKey(relatedType?: string, relatedId?: string) {
  const relation = resolveTaskRelation(relatedType, relatedId);
  return `${relation.type}:${relation.id || 'general'}`;
}
'@

Write-Utf8 (Join-Path $Project "src\features\leads\lead.service.ts") @'
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
 await activity(organizationId,ref.id,'created','تم إنشاء فرصة البيع',uid); return ref.id;
}
export async function listLeads(org:string){const q=query(collection(db,'leads'),where('organizationId','==',org),orderBy('createdAt','desc'),limit(200));const s=await getDocs(q);return s.docs.map(d=>({id:d.id,...d.data()} as Lead));}
export async function getLead(id:string,organizationId?:string){const s=await getDoc(doc(db,'leads',id));if(!s.exists())return null;const lead={id:s.id,...s.data()} as Lead;if(organizationId&&lead.organizationId!==organizationId)return null;return lead;}
export async function listLeadActivities(org:string,leadId:string){const q=query(collection(db,'leadActivities'),where('organizationId','==',org),where('leadId','==',leadId),orderBy('createdAt','desc'),limit(100));const s=await getDocs(q);return s.docs.map(d=>({id:d.id,...d.data()} as LeadActivity));}
export async function setLeadStage(id:string,current:LeadStage,next:LeadStage,org?:string,uid?:string,lostReason?:string){
 if(!canMoveLeadToStage(current,next))throw new Error('INVALID_STAGE_TRANSITION'); const ref=doc(db,'leads',id); const s=await getDoc(ref); if(!s.exists())throw new Error('LEAD_NOT_FOUND'); const data=s.data() as Lead; if(org&&data.organizationId!==org)throw new Error('LEAD_ORG_MISMATCH');
 const p:Record<string,unknown>={stage:next,updatedAt:serverTimestamp(),lastActivityAt:serverTimestamp()}; if(next==='won'){p.wonAt=serverTimestamp();p.lostReason='';} if(next==='lost'){const r=lostReason?.trim()||'';if(!r)throw new Error('LOST_REASON_REQUIRED');p.lostReason=r;p.lostAt=serverTimestamp();}
 await updateDoc(ref,p); if(org&&uid)await activity(org,id,'stage_changed',`تغيرت المرحلة من ${current} إلى ${next}`,uid);
}
export async function updateLeadNotes(id:string,notes:string,org?:string,uid?:string){const ref=doc(db,'leads',id);const s=await getDoc(ref);if(!s.exists())throw new Error('LEAD_NOT_FOUND');if(org&&s.data().organizationId!==org)throw new Error('LEAD_ORG_MISMATCH');await updateDoc(ref,{notes:notes.trim(),lastActivityAt:serverTimestamp(),updatedAt:serverTimestamp()});if(org&&uid)await activity(org,id,'notes_updated','تم تحديث ملاحظات فرصة البيع',uid);}
export async function convertWonLeadToClient(leadId:string,org:string,uid:string){
 const leadRef=doc(db,'leads',leadId); const clientRef=doc(collection(db,'clients'));
 const result=await runTransaction(db,async tx=>{const s=await tx.get(leadRef);if(!s.exists())throw new Error('LEAD_NOT_FOUND');const lead={id:s.id,...s.data()} as Lead;if(lead.organizationId!==org)throw new Error('LEAD_ORG_MISMATCH');if(lead.stage!=='won')throw new Error('LEAD_NOT_WON');if(lead.clientId)return {clientId:lead.clientId,created:false};tx.set(clientRef,{organizationId:org,type:lead.companyName?'company':'individual',status:'active',name:lead.name,email:lead.email||'',phone:lead.phone||'',notes:lead.notes||'',createdBy:uid,sourceLeadId:leadId,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});tx.update(leadRef,{clientId:clientRef.id,convertedAt:serverTimestamp(),lastActivityAt:serverTimestamp(),updatedAt:serverTimestamp()});return {clientId:clientRef.id,created:true};});
 if(result.created)await activity(org,leadId,'converted','تم تحويل فرصة البيع إلى عميل',uid);return result.clientId;
}
export async function recordLeadTaskActivity(org:string,leadId:string,uid:string,title:string){await activity(org,leadId,'task_created',`تم إنشاء مهمة: ${title}`,uid);}
'@

Write-Utf8 (Join-Path $Project "src\features\notifications\notification.service.ts") @'
import { collection,getDocs,limit,query,where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { AppTask } from '../../types/task';
import type { Claim } from '../../types/claim';
import { listRenewals, type RenewalItem } from '../renewals/renewal.service';
export type AppNotification={id:string;type:'task'|'claim'|'renewal'|'lead';title:string;body:string;severity:'info'|'warning'|'urgent';href:string};
export async function buildNotifications(org:string):Promise<AppNotification[]>{
 const [taskSnap,claimSnap,renewals]=await Promise.all([getDocs(query(collection(db,'tasks'),where('organizationId','==',org),limit(100))),getDocs(query(collection(db,'claims'),where('organizationId','==',org),limit(100))),listRenewals(org)]);
 const today=new Date().toISOString().slice(0,10); const tasks=taskSnap.docs.map(d=>({id:d.id,...d.data()} as AppTask)); const claims=claimSnap.docs.map(d=>({id:d.id,...d.data()} as Claim));
 const taskNotes:AppNotification[]=tasks.filter(t=>t.status!=='completed'&&t.dueDate<=today).map(t=>({id:`task-${t.id}`,type:t.relatedType==='lead'?'lead':'task',title:t.dueDate<today?'مهمة متأخرة':'مهمة مستحقة اليوم',body:t.title,severity:t.priority==='urgent'?'urgent':'warning',href:t.relatedType==='lead'&&t.relatedId?`/leads/${t.relatedId}`:'/tasks'}));
 const claimNotes:AppNotification[]=claims.filter(c=>['new','documents','additional_documents','review'].includes(c.status)).map(c=>({id:`claim-${c.id}`,type:'claim',title:'مطالبة تحتاج متابعة',body:`${c.claimNumber} · ${c.clientName}`,severity:c.status==='additional_documents'?'urgent':'info',href:`/claims/${c.id}`}));
 const renewalNotes:AppNotification[]=(renewals as RenewalItem[]).filter(r=>r.daysLeft>=0&&r.daysLeft<=30).map(r=>({id:`renewal-${r.id}`,type:'renewal',title:'تجديد قريب',body:`${r.policyNumber} · متبقي ${r.daysLeft} يوم`,severity:r.daysLeft<=7?'urgent':'warning',href:'/renewals'}));
 return [...taskNotes,...claimNotes,...renewalNotes].slice(0,30);
}
'@

Write-Utf8 (Join-Path $Project "src\pages\LeadDetailsPage.tsx") @'
import { ArrowRight, CheckCircle2, Save, Target, XCircle } from 'lucide-react';
import { useEffect,useMemo,useState,type FormEvent } from 'react';
import { Link,useNavigate,useParams } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { createTask } from '../features/tasks/task.service';
import { convertWonLeadToClient,getAllowedLeadStages,getLead,listLeadActivities,recordLeadTaskActivity,setLeadStage,updateLeadNotes,type LeadActivity } from '../features/leads/lead.service';
import type { Lead,LeadStage } from '../types/lead';
import { LEAD_PRIORITY_LABELS,LEAD_SOURCE_LABELS,LEAD_STAGE_LABELS } from '../types/lead';

export default function LeadDetailsPage(){
 const {id}=useParams<{id:string}>(); const nav=useNavigate(); const {user,profile}=useAuth(); const [lead,setLead]=useState<Lead|null>(null); const [acts,setActs]=useState<LeadActivity[]>([]); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState(''); const [notes,setNotes]=useState(''); const [lostReason,setLostReason]=useState(''); const [taskTitle,setTaskTitle]=useState(''); const [taskDue,setTaskDue]=useState('');
 async function load(){if(!id||!profile?.organizationId){setLoading(false);return;}try{setLoading(true);setError('');const [l,a]=await Promise.all([getLead(id,profile.organizationId),listLeadActivities(profile.organizationId,id)]);setLead(l);setActs(a);if(l){setNotes(l.notes||'');setLostReason(l.lostReason||'');}}catch(e){console.error(e);setError('تعذر تحميل Lead 360.');}finally{setLoading(false);}}
 useEffect(()=>{void load();},[id,profile?.organizationId]); const allowed=useMemo(()=>lead?getAllowedLeadStages(lead.stage):[],[lead]);
 async function move(next:LeadStage){if(!lead||!profile||!user)return;if(next==='lost'&&!lostReason.trim()){setError('يرجى تسجيل سبب فقدان الفرصة.');return;}try{setSaving(true);setError('');await setLeadStage(lead.id,lead.stage,next,profile.organizationId,user.uid,next==='lost'?lostReason:undefined);await load();}catch(e){console.error(e);setError('تعذر تغيير المرحلة.');}finally{setSaving(false);}}
 async function saveNotes(){if(!lead||!profile||!user)return;try{setSaving(true);await updateLeadNotes(lead.id,notes,profile.organizationId,user.uid);await load();}catch(e){console.error(e);setError('تعذر حفظ الملاحظات.');}finally{setSaving(false);}}
 async function addTask(e:FormEvent){e.preventDefault();if(!lead||!profile||!user||!taskTitle.trim()||!taskDue)return;try{setSaving(true);await createTask({title:taskTitle.trim(),description:`متابعة فرصة البيع: ${lead.name}`,priority:'medium',status:'open',dueDate:taskDue,assignedTo:user.uid,relatedType:'lead',relatedId:lead.id},profile.organizationId,user.uid);await recordLeadTaskActivity(profile.organizationId,lead.id,user.uid,taskTitle.trim());setTaskTitle('');setTaskDue('');await load();}catch(err){console.error(err);setError('تعذر إنشاء المهمة.');}finally{setSaving(false);}}
 async function convert(){if(!lead||!profile||!user)return;try{setSaving(true);setError('');const clientId=await convertWonLeadToClient(lead.id,profile.organizationId,user.uid);nav(`/clients/${clientId}`);}catch(e){console.error(e);setError('تعذر تحويل الفرصة إلى عميل.');}finally{setSaving(false);}}
 if(loading)return <div dir="rtl">جارٍ تحميل Lead 360...</div>; if(!lead)return <section className="card" dir="rtl"><h2>العميل المحتمل غير موجود</h2><p>{error}</p><Link to="/leads">العودة للمبيعات</Link></section>;
 return <div dir="rtl" style={{display:'grid',gap:16}}>
  <section className="page-header"><div><Link to="/leads"><ArrowRight size={18}/> المبيعات</Link><h1><Target size={22}/> {lead.name}</h1><p>{LEAD_STAGE_LABELS[lead.stage]} · {LEAD_PRIORITY_LABELS[lead.priority]}</p></div></section>
  {error&&<div className="error-message">{error}</div>}
  <section className="card"><h2>بيانات الفرصة</h2><p><strong>التأمين:</strong> {lead.insuranceType}</p><p><strong>المصدر:</strong> {LEAD_SOURCE_LABELS[lead.source]}</p><p><strong>الهاتف:</strong> {lead.phone}</p><p><strong>البريد:</strong> {lead.email||'غير مسجل'}</p><p><strong>شركة التأمين:</strong> {lead.preferredInsurerName||'غير محددة'}</p><p><strong>القيمة المتوقعة:</strong> {Number(lead.estimatedValue||0).toLocaleString('ar-EG')} جنيه</p></section>
  {lead.stage!=='won'&&lead.stage!=='lost'&&<section className="card"><h2>الإجراءات المتاحة</h2>{allowed.includes('lost')&&<textarea value={lostReason} onChange={e=>setLostReason(e.target.value)} placeholder="سبب فقدان الفرصة"/>}<div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}>{allowed.map(s=><button key={s} disabled={saving} onClick={()=>void move(s)}>{s==='won'?<CheckCircle2 size={16}/>:s==='lost'?<XCircle size={16}/>:null} الانتقال إلى {LEAD_STAGE_LABELS[s]}</button>)}</div></section>}
  {lead.stage==='won'&&<section className="card"><h2>فرصة ناجحة</h2>{lead.clientId?<Link to={`/clients/${lead.clientId}`}>فتح Client 360</Link>:<button className="primary-button" disabled={saving} onClick={()=>void convert()}>تحويل إلى عميل</button>}</section>}
  <section className="card"><h2>مهمة متابعة</h2><form onSubmit={addTask} style={{display:'grid',gap:8}}><input value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="عنوان المهمة" required/><input type="date" value={taskDue} onChange={e=>setTaskDue(e.target.value)} required/><button disabled={saving}>إنشاء مهمة مرتبطة</button></form></section>
  <section className="card"><h2>الملاحظات</h2><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={5}/><button disabled={saving} onClick={()=>void saveNotes()}><Save size={16}/> حفظ الملاحظات</button></section>
  <section className="card"><h2>سجل النشاط</h2>{acts.length===0?<p>لا يوجد نشاط مسجل.</p>:<div style={{display:'grid',gap:8}}>{acts.map(a=><div key={a.id}><strong>{a.message}</strong></div>)}</div>}</section>
 </div>;
}
'@

$indexPath = Join-Path $Project "firestore.indexes.json"
$indexes = Get-Content $indexPath -Raw | ConvertFrom-Json
$newIndexes = @($indexes.indexes)
function Has-Index([string]$group,[string[]]$paths) {
 foreach($idx in $newIndexes){ if($idx.collectionGroup -eq $group){ $p=@($idx.fields | ForEach-Object {$_.fieldPath}); if(($p -join '|') -eq ($paths -join '|')){return $true} } }; return $false
}
if(-not (Has-Index 'leads' @('organizationId','createdAt'))){$newIndexes += [pscustomobject]@{collectionGroup='leads';queryScope='COLLECTION';fields=@([pscustomobject]@{fieldPath='organizationId';order='ASCENDING'},[pscustomobject]@{fieldPath='createdAt';order='DESCENDING'})}}
if(-not (Has-Index 'leadActivities' @('organizationId','leadId','createdAt'))){$newIndexes += [pscustomobject]@{collectionGroup='leadActivities';queryScope='COLLECTION';fields=@([pscustomobject]@{fieldPath='organizationId';order='ASCENDING'},[pscustomobject]@{fieldPath='leadId';order='ASCENDING'},[pscustomobject]@{fieldPath='createdAt';order='DESCENDING'})}}
$out=[pscustomobject]@{indexes=$newIndexes;fieldOverrides=@($indexes.fieldOverrides)} | ConvertTo-Json -Depth 10
Write-Utf8 $indexPath $out

Write-Host "Patch applied. Backup: $Backup" -ForegroundColor Green
Write-Host "Next: npm run build" -ForegroundColor Cyan
Write-Host "Then: firebase deploy --only firestore:indexes" -ForegroundColor Cyan
Write-Host "Rollback: powershell -ExecutionPolicy Bypass -File .\apply-leads2-integration.ps1 -Rollback" -ForegroundColor Yellow
