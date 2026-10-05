import { useCallback,useEffect,useMemo,useState } from 'react';
import { CalendarDays,Plus,Search,ShieldCheck,UserRound,WalletCards } from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import PolicyForm from '../features/policies/PolicyForm';
import { listPoliciesForOrganization,type RelatedPolicy } from '../features/relationships/relationship.service';

type Filter='all'|'active'|'pending'|'expired'|'cancelled';
const labels:Record<Filter,string>={all:'الكل',active:'نشطة',pending:'قيد الإصدار',expired:'منتهية',cancelled:'ملغاة'};
const lineLabels:Record<string,string>={medical:'طبي',motor:'سيارات',property:'ممتلكات',marine:'بحري',life:'حياة',liability:'مسؤوليات',other:'أخرى'};
function money(v:number,c:string){return new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(Number(v||0))+' '+(c||'EGP');}
function statusLabel(s:string){return labels[(s as Filter)]||s;}
export default function PoliciesPage(){
 const {profile}=useAuth(); const [items,setItems]=useState<RelatedPolicy[]>([]); const [loading,setLoading]=useState(true); const [show,setShow]=useState(false); const [search,setSearch]=useState(''); const [filter,setFilter]=useState<Filter>('all');
 const load=useCallback(async()=>{if(!profile)return;setLoading(true);try{setItems(await listPoliciesForOrganization(profile.organizationId));}finally{setLoading(false)}},[profile]);
 useEffect(()=>{void load()},[load]);
 const stats=useMemo(()=>({total:items.length,active:items.filter(x=>x.status==='active').length,pending:items.filter(x=>x.status==='pending').length,expired:items.filter(x=>x.status==='expired').length}),[items]);
 const visible=useMemo(()=>{const q=search.trim().toLowerCase();return items.filter(x=>(filter==='all'||x.status===filter)&&(!q||[x.policyNumber,x.clientName,x.insurerName,lineLabels[x.line]||x.line].filter(Boolean).join(' ').toLowerCase().includes(q)))},[items,search,filter]);
 return <main className="mobile-page p20-page" dir="rtl">
  <header className="p20-heading"><div><span className="eyebrow">Policy Management</span><h1>الوثائق</h1><p>إدارة المحفظة وربط العميل بشركة التأمين والتغطية.</p></div><button className="floating-add" type="button" onClick={()=>setShow(true)} aria-label="إضافة وثيقة"><Plus size={22}/></button></header>
  <section className="p20-stats"><article><span><WalletCards/></span><small>الإجمالي</small><b>{stats.total}</b></article><article><span><ShieldCheck/></span><small>نشطة</small><b>{stats.active}</b></article><article><span><CalendarDays/></span><small>قيد الإصدار</small><b>{stats.pending}</b></article><article><span><CalendarDays/></span><small>منتهية</small><b>{stats.expired}</b></article></section>
  <section className="p20-tools"><div className="p20-search"><Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث برقم الوثيقة أو العميل أو شركة التأمين"/></div><div className="p20-filters">{(['all','active','pending','expired','cancelled'] as Filter[]).map(x=><button key={x} type="button" className={filter===x?'active':''} onClick={()=>setFilter(x)}>{labels[x]}</button>)}</div></section>
  <section className="p20-list-section"><header><h2>المحفظة</h2><small>{visible.length} وثيقة</small></header>{loading?<div className="p20-empty">جارٍ تحميل الوثائق...</div>:visible.length===0?<div className="p20-empty">لا توجد وثائق مطابقة.</div>:<div className="p20-list">{visible.map(p=><article className="p20-card" key={p.id}><div className="p20-icon"><ShieldCheck/></div><div className="p20-copy"><div><b>{p.policyNumber}</b><span className={`p20-status st-${p.status}`}>{statusLabel(p.status)}</span></div><strong>{p.clientName||'عميل غير محدد'}</strong><small>{p.insurerName||'شركة غير محددة'} · {lineLabels[p.line]||p.line}</small><footer><span><UserRound/> {p.clientName||'غير محدد'}</span><span><CalendarDays/> {p.expiryDate||'غير محدد'}</span><span>{money(p.premium,p.currency)}</span></footer></div></article>)}</div>}</section>
  {show&&<PolicyForm onCancel={()=>setShow(false)} onDone={()=>{setShow(false);void load()}}/>}
 </main>;
}
