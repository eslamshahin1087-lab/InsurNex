import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, ClipboardCheck, FileText, ListTodo, Mail, MapPin, Pencil, Phone, ShieldCheck, StickyNote } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { getClient } from '../features/clients/client.service';
import ClientEditForm from '../features/clients/ClientEditForm';
import { getClientRelations, type ClientRelations } from '../features/relationships/relationship.service';
import type { InsuranceClient } from '../types/client';

const empty: ClientRelations = { policies: [], claims: [], tasks: [] };

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'IN';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

function typeLabel(value: string) {
  return value === 'company' ? 'شركة' : 'فرد';
}

function statusLabel(value: string) {
  if (value === 'active') return 'نشط';
  if (value === 'prospect') return 'محتمل';
  if (value === 'inactive') return 'غير نشط';
  return value;
}

export default function ClientDetailsPage() {
  const { id } = useParams();
  const { profile } = useAuth();
  const [client, setClient] = useState<InsuranceClient | null>(null);
  const [relations, setRelations] = useState<ClientRelations>(empty);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    if (!id || !profile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [clientData, relationsData] = await Promise.all([
        getClient(id),
        getClientRelations(profile.organizationId, id),
      ]);
      setClient(clientData);
      setRelations(relationsData);
    } finally {
      setLoading(false);
    }
  }, [id, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const contact = useMemo(() => ({
    phone: client?.phone || '',
    email: client?.email || '',
    address: client?.address || '',
    city: client?.city || '',
  }), [client]);

  const renewals = useMemo(() => relations.policies.filter(policy => {
    if (!policy.expiryDate) return false;
    const expiry = new Date(`${policy.expiryDate}T00:00:00`);
    if (Number.isNaN(expiry.getTime())) return false;
    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const days = Math.ceil((expiry.getTime() - startToday) / 86400000);
    return days >= 0 && days <= 90;
  }), [relations.policies]);

  const openClaims = relations.claims.filter(claim => !['closed', 'rejected'].includes(claim.status));
  const openTasks = relations.tasks.filter(task => task.status !== 'completed');

  if (loading) return <main className="mobile-page c360" dir="rtl"><div className="c360-empty">جارٍ تحميل ملف العميل...</div></main>;
  if (!client) return <main className="mobile-page c360" dir="rtl"><div className="c360-empty">لم يتم العثور على العميل.</div></main>;

  return (
    <main className="mobile-page c360" dir="rtl">
      <Link to="/clients" className="c360-back"><ArrowRight />العودة للعملاء</Link>

      <section className="c360-hero">
        <div className="c360-avatar">{initials(client.name)}</div>
        <div className="c360-id">
          <span className="eyebrow">Client 360</span>
          <h1>{client.name}</h1>
          <p>{typeLabel(client.type)} · {client.city || 'المدينة غير محددة'}</p>
          <em className={`c360-status st-${client.status}`}>{statusLabel(client.status)}</em>
        </div>
        <div className="c360-actions">
          {contact.phone ? <a href={`tel:${contact.phone}`}><Phone />اتصال</a> : <span><Phone />اتصال</span>}
          {contact.email ? <a href={`mailto:${contact.email}`}><Mail />بريد</a> : <span><Mail />بريد</span>}
          <Link to="/tasks"><ListTodo />المهام</Link>
          <button type="button" onClick={() => setEditing(true)}><Pencil />تعديل البيانات</button>
        </div>
      </section>

      <section className="c360-section">
        <header><h2>نظرة سريعة</h2></header>
        <div className="c360-kpis">
          <article><ShieldCheck /><small>الوثائق</small><b>{relations.policies.length}</b></article>
          <article><ClipboardCheck /><small>مطالبات مفتوحة</small><b>{openClaims.length}</b></article>
          <article><CalendarDays /><small>تجديدات ≤ 90 يوم</small><b>{renewals.length}</b></article>
          <article><ListTodo /><small>مهام مفتوحة</small><b>{openTasks.length}</b></article>
        </div>
      </section>

      <section className="c360-section">
        <header><h2>بيانات الاتصال</h2></header>
        <div className="c360-info">
          <article><Phone /><div><small>الهاتف</small><b>{contact.phone || 'غير مسجل'}</b></div></article>
          <article><Mail /><div><small>البريد الإلكتروني</small><b>{contact.email || 'غير مسجل'}</b></div></article>
          <article><MapPin /><div><small>العنوان</small><b>{contact.address || contact.city || 'غير مسجل'}</b></div></article>
        </div>
      </section>

      <section className="c360-section">
        <header><h2>الوثائق</h2><Link to="/policies">عرض الكل</Link></header>
        {relations.policies.length === 0 ? <div className="c360-empty small">لا توجد وثائق مرتبطة.</div> : <div className="c360-feed">{relations.policies.slice(0, 5).map(policy => <article key={policy.id}><span><ShieldCheck /></span><div><b>{policy.policyNumber}</b><small>{policy.insurerName || 'شركة غير محددة'} · {policy.expiryDate || 'بدون تاريخ انتهاء'}</small></div></article>)}</div>}
      </section>

      <section className="c360-section">
        <header><h2>المطالبات</h2><Link to="/claims">عرض الكل</Link></header>
        {relations.claims.length === 0 ? <div className="c360-empty small">لا توجد مطالبات مرتبطة.</div> : <div className="c360-feed">{relations.claims.slice(0, 5).map(claim => <Link to={`/claims/${claim.id}`} key={claim.id}><span><FileText /></span><div><b>{claim.claimNumber}</b><small>{claim.policyNumber || 'بدون رقم وثيقة'} · {claim.status}</small></div></Link>)}</div>}
      </section>

      <section className="c360-section">
        <header><h2>المهام</h2><Link to="/tasks">عرض الكل</Link></header>
        {relations.tasks.length === 0 ? <div className="c360-empty small">لا توجد مهام مرتبطة مباشرة بهذا العميل.</div> : <div className="c360-feed">{relations.tasks.slice(0, 5).map(task => <Link to="/tasks" key={task.id}><span><ListTodo /></span><div><b>{task.title}</b><small>{task.dueDate || 'بدون تاريخ'} · {task.priority}</small></div></Link>)}</div>}
      </section>

      <section className="c360-section c360-last">
        <header><h2>الملاحظات</h2></header>
        <div className="c360-notes"><StickyNote /><p>{client.notes || 'لا توجد ملاحظات مسجلة حتى الآن.'}</p></div>
      </section>

      {editing && profile && (
        <ClientEditForm
          client={client}
          organizationId={profile.organizationId}
          onCancel={() => setEditing(false)}
          onUpdated={() => {
            setEditing(false);
            void load();
          }}
        />
      )}
    </main>
  );
}
