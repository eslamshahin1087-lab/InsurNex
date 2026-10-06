import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  ClipboardCheck,
  FileCheck2,
  FilePenLine,
  FileX2,
  ListTodo,
  RefreshCw,
  ShieldCheck,
  TimerReset,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import {
  loadOperationsSnapshot,
  type OperationsSnapshot,
} from '../features/operations/operations.service';
import '../theme/operations.css';

const EMPTY: OperationsSnapshot = { tasks: [], claims: [], renewals: [] };

function formatDate(value?: string) {
  if (!value) return 'بدون تاريخ';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(date);
}

function priorityLabel(value: string) {
  return ({ urgent: 'عاجلة', high: 'مرتفعة', medium: 'متوسطة', low: 'منخفضة' } as Record<string, string>)[value] || 'عادية';
}

export default function OperationsPage() {
  const { profile } = useAuth();
  const [data, setData] = useState<OperationsSnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!profile?.organizationId) { setLoading(false); return; }
    setLoading(true); setError('');
    try { setData(await loadOperationsSnapshot(profile.organizationId)); }
    catch (err) {
      console.error('Failed to load operations', err);
      setError('تعذر تحميل مركز العمليات الآن. يرجى إعادة المحاولة.');
    } finally { setLoading(false); }
  }, [profile?.organizationId]);

  useEffect(() => { void load(); }, [load]);

  const openTasks = useMemo(() => data.tasks.filter((t) => t.status !== 'completed'), [data.tasks]);
  const urgentTasks = useMemo(() => openTasks.filter((t) => t.priority === 'urgent'), [openTasks]);
  const openClaims = useMemo(() => data.claims.filter((c) => !['approved', 'rejected', 'closed'].includes(c.status)), [data.claims]);
  const renewals30 = useMemo(() => data.renewals.filter((r) => r.daysLeft >= 0 && r.daysLeft <= 30), [data.renewals]);
  const overdueRenewals = useMemo(() => data.renewals.filter((r) => r.daysLeft < 0), [data.renewals]);

  const workstreams = [
    { title: 'إصدار الوثائق', subtitle: 'طلبات الإصدار والربط والتفعيل', value: openTasks.filter((t) => t.relatedType === 'policy').length, icon: FileCheck2, href: '/policies', tone: 'blue' },
    { title: 'التعديلات', subtitle: 'Endorsements وإدارة تغييرات الوثائق', value: 0, icon: FilePenLine, href: '/policies', tone: 'cyan' },
    { title: 'الإلغاءات', subtitle: 'طلبات إلغاء الوثائق ومتابعتها', value: 0, icon: FileX2, href: '/policies', tone: 'red' },
    { title: 'المطالبات', subtitle: 'ملفات تحتاج متابعة تشغيلية', value: openClaims.length, icon: ClipboardCheck, href: '/claims', tone: 'orange' },
    { title: 'التجديدات', subtitle: 'تستحق خلال 30 يومًا', value: renewals30.length, icon: CalendarClock, href: '/renewals', tone: 'purple' },
    { title: 'تحصيل الأقساط', subtitle: 'التحصيل والمبالغ المستحقة', value: 0, icon: CircleDollarSign, href: '/policies', tone: 'green' },
    { title: 'تسوية العمولات', subtitle: 'العمولات والفروقات مع شركات التأمين', value: 0, icon: CircleDollarSign, href: '/insurers', tone: 'teal' },
  ];

  const alerts = useMemo(() => [
    ...urgentTasks.slice(0, 4).map((task) => ({ id: `task-${task.id}`, title: task.title, body: `${priorityLabel(task.priority)} • ${formatDate(task.dueDate)}`, href: task.relatedType === 'claim' && task.relatedId ? `/claims/${task.relatedId}` : '/tasks', urgent: true })),
    ...renewals30.filter((r) => r.daysLeft <= 7).slice(0, 4).map((r) => ({ id: `renewal-${r.id}`, title: `تجديد ${r.policyNumber}`, body: `متبقي ${r.daysLeft} يوم`, href: '/renewals', urgent: false })),
    ...overdueRenewals.slice(0, 3).map((r) => ({ id: `overdue-${r.id}`, title: `وثيقة متأخرة ${r.policyNumber}`, body: `انتهت منذ ${Math.abs(r.daysLeft)} يوم`, href: '/renewals', urgent: true })),
  ], [urgentTasks, renewals30, overdueRenewals]);

  if (loading) return <main className="mobile-page operations-page" dir="rtl"><section className="operations-empty"><RefreshCw className="operations-spin"/><strong>جارٍ تجهيز مركز العمليات...</strong><p>يتم تجميع المهام والمطالبات والتجديدات الحالية.</p></section></main>;

  return <main className="mobile-page operations-page" dir="rtl">
    <header className="operations-hero">
      <div><span className="eyebrow">Operations Center</span><h1>العمليات</h1><p>مركز موحد لإدارة الأعمال ومتابعة دورة حياة التأمين من مكان واحد.</p></div>
      <button type="button" className="operations-refresh" onClick={() => void load()}><RefreshCw size={18}/> تحديث</button>
    </header>

    {error && <section className="operations-error"><AlertTriangle size={20}/><span>{error}</span><button type="button" onClick={() => void load()}>إعادة المحاولة</button></section>}

    <section className="operations-kpis">
      <article className="operations-kpi blue"><ListTodo/><small>مهام مفتوحة</small><strong>{openTasks.length}</strong></article>
      <article className="operations-kpi red"><AlertTriangle/><small>عاجلة</small><strong>{urgentTasks.length}</strong></article>
      <article className="operations-kpi orange"><ClipboardCheck/><small>مطالبات مفتوحة</small><strong>{openClaims.length}</strong></article>
      <article className="operations-kpi purple"><CalendarClock/><small>تجديد خلال 30 يومًا</small><strong>{renewals30.length}</strong></article>
    </section>

    <section className="operations-section">
      <header className="operations-section-heading"><div><span className="eyebrow">Workstreams</span><h2>مسارات العمليات</h2><p>الوصول السريع إلى مراحل العمل التأميني الأساسية.</p></div><ShieldCheck size={22}/></header>
      <div className="operations-workstreams">
        {workstreams.map((item) => { const Icon = item.icon; return <Link key={item.title} to={item.href} className="operations-workstream"><span className={`operations-workstream-icon ${item.tone}`}><Icon/></span><div><strong>{item.title}</strong><small>{item.subtitle}</small></div><span className="operations-count">{item.value}<ChevronLeft size={17}/></span></Link>; })}
      </div>
    </section>

    <section className="operations-section">
      <header className="operations-section-heading"><div><span className="eyebrow">Action Center</span><h2>تحتاج تدخلًا</h2><p>العناصر ذات الأولوية الأعلى في دورة العمل الحالية.</p></div><TimerReset size={22}/></header>
      {alerts.length === 0 ? <div className="operations-empty"><CheckCircle2/><strong>لا توجد تنبيهات حرجة</strong><p>لا توجد حاليًا عناصر عاجلة تحتاج تدخلًا مباشرًا.</p></div> : <div className="operations-list">{alerts.slice(0, 8).map((a) => <Link key={a.id} to={a.href} className={`operations-row ${a.urgent ? 'urgent' : 'warning'}`}><AlertTriangle size={19}/><div><strong>{a.title}</strong><small>{a.body}</small></div><ChevronLeft size={18}/></Link>)}</div>}
    </section>

    <section className="operations-section">
      <header className="operations-section-heading"><div><span className="eyebrow">Operations Inbox</span><h2>قائمة العمل</h2><p>أحدث المهام المفتوحة المسجلة داخل النظام.</p></div><Building2 size={22}/></header>
      {openTasks.length === 0 ? <div className="operations-empty"><CheckCircle2/><strong>قائمة العمل محدثة</strong><p>لا توجد مهام تشغيلية مفتوحة حاليًا.</p></div> : <div className="operations-list">{openTasks.slice(0, 7).map((t) => <Link to="/tasks" className="operations-row" key={t.id}><span className={`priority-dot priority-${t.priority}`}/><div><strong>{t.title}</strong><small>{priorityLabel(t.priority)} • {formatDate(t.dueDate)}</small></div><ChevronLeft size={18}/></Link>)}</div>}
    </section>
  </main>;
}
