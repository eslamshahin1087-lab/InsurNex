import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  ListTodo,
  Mail,
  MapPin,
  Pencil,
  Phone,
  RefreshCw,
  ShieldCheck,
  StickyNote,
  UserRound,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { getClient } from '../features/clients/client.service';
import ClientEditForm from '../features/clients/ClientEditForm';
import {
  getClientRelations,
  type ClientRelations,
  type RelatedClaim,
  type RelatedPolicy,
  type RelatedTask,
} from '../features/relationships/relationship.service';
import type { InsuranceClient } from '../types/client';

const EMPTY_RELATIONS: ClientRelations = { policies: [], claims: [], tasks: [] };

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'IN';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function clientTypeLabel(value: string) {
  return value === 'company' ? 'شركة' : 'فرد';
}

function clientStatusLabel(value: string) {
  if (value === 'active') return 'نشط';
  if (value === 'prospect') return 'محتمل';
  if (value === 'inactive') return 'غير نشط';
  return value || 'غير محدد';
}

function policyStatusLabel(value: string) {
  if (value === 'active') return 'سارية';
  if (value === 'expired') return 'منتهية';
  if (value === 'pending') return 'قيد الإصدار';
  if (value === 'cancelled' || value === 'canceled') return 'ملغاة';
  return value || 'غير محدد';
}

function claimStatusLabel(value: string) {
  if (value === 'open') return 'مفتوحة';
  if (value === 'pending') return 'قيد المتابعة';
  if (value === 'approved') return 'مقبولة';
  if (value === 'rejected') return 'مرفوضة';
  if (value === 'closed') return 'مغلقة';
  if (value === 'settled') return 'مسددة';
  return value || 'غير محدد';
}

function taskStatusLabel(value: string) {
  if (value === 'open') return 'مفتوحة';
  if (value === 'pending') return 'قيد التنفيذ';
  if (value === 'in_progress') return 'جارية';
  if (value === 'done' || value === 'completed') return 'مكتملة';
  if (value === 'cancelled' || value === 'canceled') return 'ملغاة';
  return value || 'غير محدد';
}

function formatDate(value?: string) {
  if (!value) return 'غير محدد';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatMoney(value: number, currency?: string) {
  const amount = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat('ar-EG', {
      style: 'currency',
      currency: currency || 'EGP',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat('ar-EG').format(amount)} ${currency || ''}`.trim();
  }
}

function isOpenClaim(claim: RelatedClaim) {
  const status = (claim.status || '').trim().toLowerCase();
  return !['closed', 'settled', 'rejected', 'cancelled', 'canceled'].includes(status);
}

function isOpenTask(task: RelatedTask) {
  const status = (task.status || '').trim().toLowerCase();
  return !['done', 'completed', 'closed', 'cancelled', 'canceled'].includes(status);
}

function isUpcomingRenewal(policy: RelatedPolicy) {
  if (!policy.expiryDate) return false;
  const expiry = new Date(policy.expiryDate);
  if (Number.isNaN(expiry.getTime())) return false;
  const days = (expiry.getTime() - Date.now()) / 86400000;
  return days >= 0 && days <= 90;
}

export default function ClientDetailsPage() {
  const { id } = useParams();
  const { profile } = useAuth();
  const [client, setClient] = useState<InsuranceClient | null>(null);
  const [relations, setRelations] = useState<ClientRelations>(EMPTY_RELATIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEdit, setShowEdit] = useState(false);

  const loadClient = useCallback(async () => {
    if (!id || !profile) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await getClient(id);
      if (!data) {
        setClient(null);
        setRelations(EMPTY_RELATIONS);
        return;
      }

      if (data.organizationId !== profile.organizationId) {
        setClient(null);
        setRelations(EMPTY_RELATIONS);
        setError('لا يمكنك الوصول إلى بيانات هذا العميل.');
        return;
      }

      setClient(data);
      setRelations(await getClientRelations(profile.organizationId, id));
    } catch (err) {
      console.error('Failed to load client details', err);
      setError('تعذر تحميل ملف العميل. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }, [id, profile]);

  useEffect(() => {
    void loadClient();
  }, [loadClient]);

  const openClaims = useMemo(() => relations.claims.filter(isOpenClaim), [relations.claims]);
  const openTasks = useMemo(() => relations.tasks.filter(isOpenTask), [relations.tasks]);
  const renewals = useMemo(() => relations.policies.filter(isUpcomingRenewal), [relations.policies]);
  const totalPremium = useMemo(
    () => relations.policies.reduce((sum, policy) => sum + (policy.premium || 0), 0),
    [relations.policies],
  );
  const totalClaims = useMemo(
    () => relations.claims.reduce((sum, claim) => sum + (claim.claimAmount || 0), 0),
    [relations.claims],
  );

  if (loading) {
    return (
      <main className="page-shell" dir="rtl">
        <section className="empty">
          <RefreshCw size={26} />
          <h2>جاري تحميل ملف العميل...</h2>
          <p>يتم تحميل بيانات العميل والوثائق والمطالبات والمهام المرتبطة.</p>
        </section>
      </main>
    );
  }

  if (!client) {
    return (
      <main className="page-shell" dir="rtl">
        <section className="empty">
          <UserRound size={30} />
          <h2>لم يتم العثور على العميل</h2>
          <p>{error || 'العميل المطلوب غير موجود أو لم يعد متاحًا.'}</p>
          <Link to="/clients" className="secondary-button">
            <ArrowLeft size={18} />
            العودة إلى العملاء
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell client-360-page" dir="rtl">
      <header className="page-header">
        <div>
          <Link to="/clients" className="back-link">
            <ArrowLeft size={17} />
            العملاء
          </Link>
          <span className="eyebrow">Client 360</span>
          <h1>ملف العميل</h1>
          <p>نظرة متكاملة على العميل وملفه التأميني وعلاقاته الحالية.</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => setShowEdit(true)}>
          <Pencil size={17} />
          تعديل البيانات
        </button>
      </header>

      {error && (
        <section className="empty" role="alert">
          <p>{error}</p>
        </section>
      )}

      <section className="client-hero">
        <div className="client-hero-main">
          <div className="client-avatar">{initials(client.name)}</div>
          <div className="client-hero-copy">
            <span className="eyebrow">Insurance CRM</span>
            <h2>{client.name}</h2>
            <div className="client-meta-row">
              <span>
                {client.type === 'company' ? <Building2 size={15} /> : <UserRound size={15} />}
                {clientTypeLabel(client.type)}
              </span>
              <span className={`status-badge status-${client.status}`}>
                <CheckCircle2 size={14} />
                {clientStatusLabel(client.status)}
              </span>
            </div>
          </div>
        </div>

        <div className="client-quick-actions">
          {client.phone && (
            <a href={`tel:${client.phone}`} className="secondary-button">
              <Phone size={17} />
              اتصال
            </a>
          )}
          {client.email && (
            <a href={`mailto:${client.email}`} className="secondary-button">
              <Mail size={17} />
              بريد
            </a>
          )}
          <button type="button" className="primary-button" onClick={() => setShowEdit(true)}>
            <Pencil size={17} />
            تعديل
          </button>
        </div>
      </section>

      <section className="client-360-stats">
        <article className="stat-card">
          <span className="stat-icon"><ShieldCheck size={20} /></span>
          <div><small>الوثائق</small><strong>{relations.policies.length}</strong></div>
        </article>
        <article className="stat-card">
          <span className="stat-icon"><ClipboardCheck size={20} /></span>
          <div><small>المطالبات المفتوحة</small><strong>{openClaims.length}</strong></div>
        </article>
        <article className="stat-card">
          <span className="stat-icon"><CalendarDays size={20} /></span>
          <div><small>تجديدات خلال 90 يومًا</small><strong>{renewals.length}</strong></div>
        </article>
        <article className="stat-card">
          <span className="stat-icon"><ListTodo size={20} /></span>
          <div><small>مهام مفتوحة</small><strong>{openTasks.length}</strong></div>
        </article>
      </section>

      <section className="client-360-grid">
        <article className="panel">
          <header className="panel-header">
            <div><span className="eyebrow">Profile</span><h2>بيانات العميل</h2></div>
            <UserRound size={20} />
          </header>
          <div className="details-list">
            <div><span>نوع العميل</span><strong>{clientTypeLabel(client.type)}</strong></div>
            <div><span>الحالة</span><strong>{clientStatusLabel(client.status)}</strong></div>
            {client.industry && <div><span>النشاط</span><strong>{client.industry}</strong></div>}
            {client.nationalId && <div><span>الرقم القومي</span><strong>{client.nationalId}</strong></div>}
            {client.taxId && <div><span>الرقم الضريبي</span><strong>{client.taxId}</strong></div>}
          </div>
        </article>

        <article className="panel">
          <header className="panel-header">
            <div><span className="eyebrow">Contact</span><h2>بيانات الاتصال</h2></div>
            <Phone size={20} />
          </header>
          <div className="details-list">
            <div><span><Phone size={15} /> الهاتف</span><strong>{client.phone || 'غير مسجل'}</strong></div>
            <div><span><Mail size={15} /> البريد الإلكتروني</span><strong>{client.email || 'غير مسجل'}</strong></div>
            <div><span><MapPin size={15} /> المدينة</span><strong>{client.city || 'غير مسجلة'}</strong></div>
            <div><span><MapPin size={15} /> العنوان</span><strong>{client.address || 'غير مسجل'}</strong></div>
          </div>
        </article>
      </section>

      <section className="client-financial-summary">
        <article className="panel">
          <header className="panel-header">
            <div><span className="eyebrow">Portfolio</span><h2>ملخص المحفظة التأمينية</h2></div>
            <CircleDollarSign size={20} />
          </header>
          <div className="client-360-stats">
            <div className="stat-card"><small>إجمالي الوثائق</small><strong>{relations.policies.length}</strong></div>
            <div className="stat-card"><small>إجمالي الأقساط</small><strong>{formatMoney(totalPremium, relations.policies[0]?.currency)}</strong></div>
            <div className="stat-card"><small>إجمالي المطالبات</small><strong>{relations.claims.length}</strong></div>
            <div className="stat-card"><small>قيمة المطالبات</small><strong>{formatMoney(totalClaims, relations.claims[0]?.currency)}</strong></div>
          </div>
        </article>
      </section>

      <section className="client-section">
        <header className="section-heading">
          <div><span className="eyebrow">Policies</span><h2>الوثائق</h2><p>الوثائق التأمينية المرتبطة بالعميل.</p></div>
          <span className="section-count">{relations.policies.length}</span>
        </header>
        {relations.policies.length === 0 ? (
          <div className="empty"><ShieldCheck size={24} /><strong>لا توجد وثائق</strong><p>لا توجد وثائق مرتبطة بهذا العميل حتى الآن.</p></div>
        ) : (
          <div className="relation-list">
            {relations.policies.map((policy) => (
              <Link key={policy.id} to="/policies" className="relation-card">
                <div className="relation-icon"><ShieldCheck size={20} /></div>
                <div className="relation-main">
                  <div className="relation-title-row">
                    <div><strong>{policy.policyNumber || 'وثيقة تأمين'}</strong><span>{policy.insurerName || 'شركة التأمين غير محددة'}</span></div>
                    <span className={`status-badge status-${policy.status}`}>{policyStatusLabel(policy.status)}</span>
                  </div>
                  <div className="relation-meta">
                    <span>{policy.line || 'فرع تأميني غير محدد'}</span>
                    <span>ينتهي {formatDate(policy.expiryDate)}</span>
                    <span>{formatMoney(policy.premium, policy.currency)}</span>
                  </div>
                </div>
                <ChevronLeft size={18} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="client-section">
        <header className="section-heading">
          <div><span className="eyebrow">Claims</span><h2>المطالبات</h2><p>المطالبات المرتبطة بالملف التأميني للعميل.</p></div>
          <span className="section-count">{relations.claims.length}</span>
        </header>
        {relations.claims.length === 0 ? (
          <div className="empty"><ClipboardCheck size={24} /><strong>لا توجد مطالبات</strong><p>لا توجد مطالبات مرتبطة بهذا العميل.</p></div>
        ) : (
          <div className="relation-list">
            {relations.claims.map((claim) => (
              <Link key={claim.id} to={`/claims/${claim.id}`} className="relation-card">
                <div className="relation-icon"><ClipboardCheck size={20} /></div>
                <div className="relation-main">
                  <div className="relation-title-row">
                    <div><strong>{claim.claimNumber || 'مطالبة تأمينية'}</strong><span>{claim.insurerName || 'شركة التأمين غير محددة'}</span></div>
                    <span className={`status-badge status-${claim.status}`}>{claimStatusLabel(claim.status)}</span>
                  </div>
                  <div className="relation-meta">
                    <span>وثيقة: {claim.policyNumber || 'غير محددة'}</span>
                    <span>الحادث: {formatDate(claim.incidentDate)}</span>
                    <span>{formatMoney(claim.claimAmount, claim.currency)}</span>
                  </div>
                </div>
                <ChevronLeft size={18} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="client-section">
        <header className="section-heading">
          <div><span className="eyebrow">Tasks</span><h2>المهام</h2><p>المتابعات والإجراءات المطلوبة لهذا العميل.</p></div>
          <span className="section-count">{relations.tasks.length}</span>
        </header>
        {relations.tasks.length === 0 ? (
          <div className="empty"><ListTodo size={24} /><strong>لا توجد مهام</strong><p>لا توجد مهام مرتبطة بالعميل في الوقت الحالي.</p></div>
        ) : (
          <div className="relation-list">
            {relations.tasks.map((task) => (
              <Link key={task.id} to="/tasks" className="relation-card">
                <div className="relation-icon"><ListTodo size={20} /></div>
                <div className="relation-main">
                  <div className="relation-title-row">
                    <div><strong>{task.title || 'مهمة متابعة'}</strong><span>الأولوية: {task.priority || 'عادية'}</span></div>
                    <span className={`status-badge status-${task.status}`}>{taskStatusLabel(task.status)}</span>
                  </div>
                  <div className="relation-meta"><span><CalendarDays size={14} /> الاستحقاق: {formatDate(task.dueDate)}</span></div>
                </div>
                <ChevronLeft size={18} />
              </Link>
            ))}
          </div>
        )}
      </section>

      {renewals.length > 0 && (
        <section className="client-section">
          <header className="section-heading">
            <div><span className="eyebrow">Renewals</span><h2>التجديدات القادمة</h2><p>وثائق تنتهي خلال التسعين يومًا القادمة.</p></div>
            <span className="section-count">{renewals.length}</span>
          </header>
          <div className="relation-list">
            {renewals.map((policy) => (
              <Link key={policy.id} to="/renewals" className="relation-card">
                <div className="relation-icon"><CalendarDays size={20} /></div>
                <div className="relation-main">
                  <strong>{policy.policyNumber || 'وثيقة تأمين'}</strong>
                  <div className="relation-meta"><span>{policy.insurerName || 'شركة التأمين غير محددة'}</span><span>تاريخ الانتهاء: {formatDate(policy.expiryDate)}</span></div>
                </div>
                <ChevronLeft size={18} />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="client-section">
        <header className="section-heading">
          <div><span className="eyebrow">Notes</span><h2>الملاحظات</h2></div>
          <StickyNote size={20} />
        </header>
        <article className="panel">
          {client.notes ? (
            <p>{client.notes}</p>
          ) : (
            <div className="empty"><FileText size={22} /><strong>لا توجد ملاحظات</strong><p>يمكن إضافة الملاحظات من تعديل بيانات العميل.</p></div>
          )}
        </article>
      </section>

      {showEdit && profile && (
        <ClientEditForm
          client={client}
          organizationId={profile.organizationId}
          onCancel={() => setShowEdit(false)}
          onUpdated={() => {
            setShowEdit(false);
            void loadClient();
          }}
        />
      )}
    </main>
  );
}
