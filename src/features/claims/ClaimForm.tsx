import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/auth-context';
import { listPolicies } from '../policies/policy.service';
import { createClaim } from './claim.service';
import type { Policy } from '../../types/insurance';
import type { ClaimInput, ClaimStatus } from '../../types/claim';

const initial: ClaimInput = { claimNumber:'', clientId:'', policyId:'', incidentDate:'', notificationDate:'', claimAmount:0, approvedAmount:0, currency:'EGP', status:'new', description:'' };

export default function ClaimForm({ onDone, onCancel }: { onDone:()=>void; onCancel:()=>void }) {
  const { user, profile } = useAuth();
  const [form, setForm] = useState(initial);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(()=>{ if(profile) listPolicies(profile.organizationId).then(setPolicies); },[profile]);
  const set=(k:keyof ClaimInput,v:string|number)=>setForm(x=>({...x,[k]:v}));
  async function submit(e:FormEvent){
    e.preventDefault(); if(!user||!profile) return;
    const policy=policies.find(p=>p.id===form.policyId); if(!policy){setError('اختر الوثيقة المرتبطة بالمطالبة.');return;}
    setBusy(true);setError('');
    try{await createClaim({...form,clientId:policy.clientId},profile.organizationId,user.uid,policy);onDone();}
    catch{setError('تعذر حفظ المطالبة. تحقق من Firestore والفهارس.');}
    finally{setBusy(false);}
  }
  return <div className="modal-backdrop"><section className="modal" dir="rtl"><header><div><span className="eyebrow">Claims</span><h2>إضافة مطالبة</h2></div><button className="icon-button" onClick={onCancel}>×</button></header><form className="client-form" onSubmit={submit}><div className="form-grid">
    <label className="wide">الوثيقة *<select required value={form.policyId} onChange={e=>set('policyId',e.target.value)}><option value="">اختر الوثيقة</option>{policies.map(p=><option key={p.id} value={p.id}>{p.policyNumber} · {p.clientName} · {p.insurerName}</option>)}</select></label>
    <label>رقم المطالبة *<input required value={form.claimNumber} onChange={e=>set('claimNumber',e.target.value)}/></label>
    <label>الحالة<select value={form.status} onChange={e=>set('status',e.target.value as ClaimStatus)}><option value="new">جديدة</option><option value="documents">جمع المستندات</option><option value="submitted">تم الإرسال</option><option value="review">قيد المراجعة</option><option value="additional_documents">مستندات إضافية</option><option value="approved">مقبولة</option><option value="rejected">مرفوضة</option><option value="settlement">التسوية</option><option value="closed">مغلقة</option></select></label>
    <label>تاريخ الحادث *<input required type="date" value={form.incidentDate} onChange={e=>set('incidentDate',e.target.value)}/></label>
    <label>تاريخ الإخطار *<input required type="date" value={form.notificationDate} onChange={e=>set('notificationDate',e.target.value)}/></label>
    <label>قيمة المطالبة<input min="0" step="0.01" type="number" value={form.claimAmount} onChange={e=>set('claimAmount',Number(e.target.value))}/></label>
    <label>المبلغ المعتمد<input min="0" step="0.01" type="number" value={form.approvedAmount} onChange={e=>set('approvedAmount',Number(e.target.value))}/></label>
    <label>العملة<select value={form.currency} onChange={e=>set('currency',e.target.value)}><option>EGP</option><option>USD</option><option>EUR</option></select></label>
    <label className="wide">وصف المطالبة<textarea value={form.description} onChange={e=>set('description',e.target.value)}/></label>
  </div>{error&&<p className="form-error">{error}</p>}<footer><button type="button" className="secondary-button" onClick={onCancel}>إلغاء</button><button className="primary-button" disabled={busy}>{busy?'جارٍ الحفظ...':'حفظ المطالبة'}</button></footer></form></section></div>;
}
