import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Building2, UserRound } from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { createOwnerWorkspace } from '../features/auth/onboarding.service';
import type { OrganizationType } from '../types/auth';
export default function SetupPage(){
 const {user,profile,loading}=useAuth()
 const [displayName,setDisplayName]=useState(user?.displayName ?? ''); const [organizationName,setOrganizationName]=useState(''); const [organizationType,setOrganizationType]=useState<OrganizationType>('office'); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
 if(!loading&&!user) return <Navigate to="/login" replace/>; if(!loading&&profile) return <Navigate to="/" replace/>;
 async function submit(e:FormEvent){e.preventDefault();if(!user)return;setBusy(true);setError('');try{await createOwnerWorkspace(user,{displayName,organizationName,organizationType});window.location.assign('/');}catch{setError('تعذر إنشاء مساحة العمل. تحقق من إعداد Firestore Security Rules ثم حاول مرة أخرى.');}finally{setBusy(false)}}
 return <main className="setup-page" dir="rtl"><section className="setup-card"><img src="/branding/insurnex-brand.png" className="setup-brand" alt="InsurNex"/><span className="eyebrow">تهيئة الحساب لأول مرة</span><h1>أنشئ مساحة عمل مؤسستك</h1><p>سيصبح الحساب الحالي مالك المؤسسة، وستُعزل بيانات المؤسسة عن أي مؤسسة أخرى.</p><form className="auth-form" onSubmit={submit}><label>اسم المستخدم<div className="input-wrap"><UserRound size={18}/><input required value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="الاسم الكامل"/></div></label><label>اسم المؤسسة<div className="input-wrap"><Building2 size={18}/><input required value={organizationName} onChange={e=>setOrganizationName(e.target.value)} placeholder="مثال: InsurNex Brokerage"/></div></label><label>نوع المؤسسة<select value={organizationType} onChange={e=>setOrganizationType(e.target.value as OrganizationType)}><option value="individual">وسيط فردي</option><option value="office">مكتب وساطة</option><option value="company">شركة وساطة</option></select></label>{error&&<p className="form-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy?'جارٍ إنشاء مساحة العمل...':'إنشاء مساحة العمل'}</button></form></section></main>
}
