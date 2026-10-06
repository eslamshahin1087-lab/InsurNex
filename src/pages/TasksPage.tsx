import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, ListTodo, Search, TriangleAlert } from 'lucide-react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../features/auth/auth-context';
import type { AppTask } from '../types/task';

type Filter='all'|'open'|'urgent'|'completed';
const priorityLabel:Record<string,string>={low:'منخفضة',medium:'متوسطة',high:'مرتفعة',urgent:'عاجلة'};
function dateLabel(v?:string){if(!v)return 'بدون تاريخ';const d=new Date(v+'T00:00:00');return Number.isNaN(d.getTime())?v:new Intl.DateTimeFormat('ar-EG',{year:'numeric',month:'short',day:'numeric'}).format(d);}
export default function TasksPage(){
 const {profile}=useAuth(); const [items,setItems]=useState<AppTask[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [search,setSearch]=useState(''); const [filter,setFilter]=useState<Filter>('all');
 const load=useCallback(async()=>{if(!profile){setLoading(false);return;}setLoading(true);setError('');try{const q=query(collection(db,'tasks'),where('organizationId','==',profile.organizationId),limit(300));const s=await getDocs(q);setItems(s.docs.map(d=>({id:d.id,...d.data()} as AppTask)));}catch{setError('تعذر تحميل المهام.');}finally{setLoading(false);}},[profile]);
 useEffect(()=>{void load();},[load]);
 const stats=useMemo(()=>({total:items.length,open:items.filter(x=>x.status!=='completed').length,urgent:items.filter(x=>x.status!=='completed'&&x.priority==='urgent').length,completed:items.filter(x=>x.status==='completed').length}),[items]);
 const visible=useMemo(()=>{const t=search.trim().toLowerCase();return items.filter(x=>{const ok=filter==='all'||(filter==='open'&&x.status!=='completed')||(filter==='urgent'&&x.status!=='completed'&&x.priority==='urgent')||(filter==='completed'&&x.status==='completed');return ok&&(!t||String(x.title||'').toLowerCase().includes(t));});},[items,search,filter]);
 return <main className="mobile-page tasks-v2" dir="rtl"><header className="page-header"><div><span className="eyebrow">Operations Center</span><h1>المهام</h1><p>متابعة الإجراءات التشغيلية والأولويات والاستحقاقات من مكان واحد.</p></div></header>
 <section className="ops-kpis"><article><ListTodo/><small>الإجمالي</small><strong>{stats.total}</strong></article><article><Clock3/><small>مفتوحة</small><strong>{stats.open}</strong></article><article><TriangleAlert/><small>عاجلة</small><strong>{stats.urgent}</strong></article><article><CheckCircle2/><small>مكتملة</small><strong>{stats.completed}</strong></article></section>
 <section className="ops-tools"><div className="ops-search"><Search/><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث في المهام"/></div><div className="ops-filters">{(['all','open','urgent','completed'] as Filter[]).map(f=><button type="button" key={f} className={filter===f?'active':''} onClick={()=>setFilter(f)}>{f==='all'?'الكل':f==='open'?'مفتوحة':f==='urgent'?'عاجلة':'مكتملة'}</button>)}</div></section>
 <section className="ops-list-section">{error?<div className="empty">{error}</div>:loading?<div className="empty">جارٍ تحميل المهام...</div>:visible.length===0?<div className="empty">لا توجد مهام مطابقة.</div>:<div className="ops-list">{visible.map(t=><article className="ops-card" key={t.id}><span className="ops-icon"><ListTodo/></span><div className="ops-copy"><div><strong>{t.title}</strong><em className={'priority p-'+t.priority}>{priorityLabel[t.priority]||t.priority}</em></div><small><CalendarDays/>{dateLabel(t.dueDate)}</small><small>{t.relatedType?`مرتبط بـ ${t.relatedType}`:'مهمة عامة'}</small></div></article>)}</div>}</section></main>;
}
