import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import ClaimForm from '../features/claims/ClaimForm';
import { listClaims } from '../features/claims/claim.service';
import type { Claim } from '../types/claim';

const labels: Record<string,string>={new:'جديدة',documents:'جمع المستندات',submitted:'تم الإرسال',review:'قيد المراجعة',additional_documents:'مستندات إضافية',approved:'مقبولة',rejected:'مرفوضة',settlement:'التسوية',closed:'مغلقة'};
export default function ClaimsPage(){
 const {profile}=useAuth(); const [items,setItems]=useState<Claim[]>([]); const [show,setShow]=useState(false); const [term,setTerm]=useState(''); const [loading,setLoading]=useState(true);
 const load=useCallback(async()=>{if(!profile)return;setLoading(true);try{setItems(await listClaims(profile.organizationId));}finally{setLoading(false)}},[profile]); useEffect(()=>{void load()},[load]);
 const shown=items.filter(x=>[x.claimNumber,x.clientName,x.policyNumber,x.insurerName].join(' ').toLowerCase().includes(term.toLowerCase()));
 return <main className="mobile-page"><header className="mobile-page-heading claims-heading"><div><span className="eyebrow">Claims Management</span><h1>المطالبات</h1><p>تابع المطالبات من الإخطار حتى التسوية والإغلاق.</p></div><button className="floating-add" onClick={()=>setShow(true)} aria-label="إضافة مطالبة"><Plus size={22}/></button></header><section className="panel"><div className="toolbar"><div className="search"><Search size={18}/><input value={term} onChange={e=>setTerm(e.target.value)} placeholder="بحث في المطالبات"/></div><span>{shown.length} مطالبة</span></div>{loading?<div className="empty">جارٍ تحميل المطالبات...</div>:shown.length===0?<div className="empty">لا توجد مطالبات بعد.</div>:<div className="claim-cards">{shown.map(c=><Link to={`/claims/${c.id}`} className="claim-card" key={c.id}><span className="claim-icon"><ClipboardCheck size={21}/></span><span className="claim-copy"><b>{c.claimNumber}</b><small>{c.clientName}</small><small>{c.policyNumber} · {c.insurerName}</small></span><span className={`claim-status status-${c.status}`}>{labels[c.status]}</span></Link>)}</div>}</section>{show&&<ClaimForm onCancel={()=>setShow(false)} onDone={()=>{setShow(false);void load()}}/>}</main>;
}
