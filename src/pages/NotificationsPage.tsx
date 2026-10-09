import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, CheckCircle2, Search } from 'lucide-react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../features/auth/auth-context';

type Notice={id:string;title?:string;message?:string;body?:string;type?:string;read?:boolean;isRead?:boolean;createdAt?:{toDate?:()=>Date}|null};
type Filter='all'|'unread'|'read';
function text(n:Notice){return n.message||n.body||'';}
function read(n:Notice){return Boolean(n.read||n.isRead);}
function when(n:Notice){const d=n.createdAt?.toDate?.();return d?new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium',timeStyle:'short'}).format(d):'';}
export default function NotificationsPage(){
 const {profile}=useAuth();const [items,setItems]=useState<Notice[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [search,setSearch]=useState('');const [filter,setFilter]=useState<Filter>('all');
 const load=useCallback(async()=>{if(!profile){setLoading(false);return;}setLoading(true);setError('');try{const q=query(collection(db,'notifications'),where('organizationId','==',profile.organizationId),limit(200));const s=await getDocs(q);setItems(s.docs.map(d=>({id:d.id,...d.data()} as Notice)));}catch{setError('تعذر تحميل الإشعارات.');}finally{setLoading(false);}},[profile]);
 useEffect(()=>{void load();},[load]);
 const unread=items.filter(n=>!read(n)).length;
 const visible=useMemo(()=>{const t=search.trim().toLowerCase();return items.filter(n=>(filter==='all'||(filter==='unread'&&!read(n))||(filter==='read'&&read(n)))&&(!t||`${n.title||''} ${text(n)}`.toLowerCase().includes(t)));},[items,search,filter]);
 return <main className="mobile-page notifications-v2" dir="rtl"><header className="page-header"><div><span className="eyebrow">Notification Center</span><h1>الإشعارات</h1><p>مركز موحد للتنبيهات التشغيلية والمتابعات المهمة.</p></div></header>
 <section className="ops-kpis"><article><Bell/><small>الإجمالي</small><strong>{items.length}</strong></article><article><BellRing/><small>غير مقروءة</small><strong>{unread}</strong></article><article><CheckCircle2/><small>مقروءة</small><strong>{items.length-unread}</strong></article></section>
 <section className="ops-tools"><div className="ops-search"><Search/><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث في الإشعارات"/></div><div className="ops-filters">{(['all','unread','read'] as Filter[]).map(f=><button type="button" key={f} className={filter===f?'active':''} onClick={()=>setFilter(f)}>{f==='all'?'الكل':f==='unread'?'غير مقروءة':'مقروءة'}</button>)}</div></section>
 <section className="ops-list-section">{error?<div className="empty">{error}</div>:loading?<div className="empty">جارٍ تحميل الإشعارات...</div>:visible.length===0?<div className="empty">لا توجد إشعارات مطابقة.</div>:<div className="ops-list">{visible.map(n=><article className={'ops-card notification-card '+(read(n)?'is-read':'is-unread')} key={n.id}><span className="ops-icon">{read(n)?<Bell/>:<BellRing/>}</span><div className="ops-copy"><div><strong>{n.title||'إشعار'}</strong>{!read(n)&&<em className="unread-dot">جديد</em>}</div><p>{text(n)}</p><small>{when(n)}</small></div></article>)}</div>}</section></main>;
}
