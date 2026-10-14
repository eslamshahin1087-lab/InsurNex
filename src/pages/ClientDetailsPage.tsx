import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bot,
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
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { getClient } from '../features/clients/client.service';
import ClientEditForm from '../features/clients/ClientEditForm';
import ClientDocumentsPanel from '../features/documents/ClientDocumentsPanel';
import ClientTimeline from '../features/clients/ClientTimeline';
import PolicyForm from '../features/policies/PolicyForm';
import {
  getClientRelations,
  type ClientRelations,
  type RelatedClaim,
  type RelatedPolicy,
  type RelatedTask,
} from '../features/relationships/relationship.service';
import type { InsuranceClient } from '../types/client';
import RfqWorkspace from '../features/rfq/RfqWorkspace';
import { setCurrentContext } from '../features/copilot/copilot-context.store';
import '../theme/rfq-v81.css';
import '../theme/client-timeline.css';

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

function clientStatusTone(value: string) {
  if (value === 'active') return 'success';
  if (value === 'prospect') return 'primary';
  if (value === 'inactive') return 'neutral';
  return 'neutral';
}

function policyStatusLabel(value: string) {
  if (value === 'active') return 'سارية';
  if (value === 'expired') return 'منتهية';
  if (value === 'pending') return 'قيد الانتظار';
  if (value === 'cancelled' || value === 'canceled') return 'ملغاة';
  return value || 'غير محدد';
}

function policyStatusTone(value: string) {
  if (value === 'active') return 'success';
  if (value === 'expired') return 'danger';
  if (value === 'pending') return 'warning';
  if (value === 'cancelled' || value === 'canceled') return 'neutral';
  return 'neutral';
}

function claimStatusLabel(value: string) {
  if (value === 'open') return 'مفتوحة';
  if (value === 'pending') return 'قيد المعالجة';
  if (value === 'approved') return 'مقبولة';
  if (value === 'rejected') return 'مرفوضة';
  if (value === 'closed') return 'مغلقة';
  if (value === 'settled') return 'مسوّاة';
  return value || 'غير محدد';
}

function claimStatusTone(value: string) {
  if (value === 'open') return 'primary';
  if (value === 'pending') return 'warning';
  if (value === 'approved' || value === 'settled') return 'success';
  if (value === 'rejected') return 'danger';
  if (value === 'closed') return 'neutral';
  return 'neutral';
}

function taskStatusLabel(value: string) {
  if (value === 'open') return 'مفتوحة';
  if (value === 'pending') return 'قيد الانتظار';
  if (value === 'in_progress') return 'جارية';
  if (value === 'done' || value === 'completed') return 'مكتملة';
  if (value === 'cancelled' || value === 'canceled') return 'ملغاة';
  return value || 'غير محدد';
}

function taskStatusTone(value: string) {
  if (value === 'open') return 'primary';
  if (value === 'pending' || value === 'in_progress') return 'warning';
  if (value === 'done' || value === 'completed') return 'success';
  if (value === 'cancelled' || value === 'canceled') return 'neutral';
  return 'neutral';
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
  const navigate = useNavigate();
  const [client, setClient] = useState<InsuranceClient | null>(null);
  const [relations, setRelations] = useState<ClientRelations>(EMPTY_RELATIONS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [showPolicyForm, setShowPolicyForm] = useState(false);

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
        setError('لا يمكن عرض هذا العميل لأنه ينتمي إلى مؤسسة أخرى.');
        return;
      }
      setClient(data);
      setRelations(await getClientRelations(profile.organizationId, id));
    } catch (err) {
      console.error('Failed to load client details', err);
      setError('تعذر تحميل تفاصيل العميل. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }, [id, profile]);

  useEffect(() => {
    void loadClient();
  }, [loadClient]);

  // Set context for FAB
  useEffect(() => {
    if (!client) return;
    setCurrentContext({
      page: 'client-details',
      client: {
        id: client.id,
        name: client.name,
        type: client.type,
        status: client.status,
        phone: client.phone,
        email: client.email,
        city: client.city,
        notes: client.notes,
      },
      policies: relations.policies.slice(0, 20).map((p) => ({
        policyNumber: p.policyNumber,
        clientName: p.clientName,
        insurerName: p.insurerName,
        line: p.line,
        expiryDate: p.expiryDate,
        premium: p.premium,
        currency: p.currency,
        status: p.status,
      })),
      claims: relations.claims.slice(0, 15).map((c) => ({
        claimNumber: c.claimNumber,
        clientName: c.clientName,
        insurerName: c.insurerName,
        policyNumber: c.policyNumber,
        claimAmount: c.claimAmount,
        currency: c.currency,
        status: c.status,
        incidentDate: c.incidentDate,
      })),
      tasks: relations.tasks.slice(0, 15).map((t) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
      })),
      notes: `The broker is viewing Client 360 for: ${client.name}`,
    });
  }, [client, relations]);

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

  const askCopilot = () => {
    if (!client) return;
    navigate('/copilot', {
      state: {
        context: {
          page: 'client-details',
          client: {
            id: client.id,
            name: client.name,
            type: client.type,
            status: client.status,
            phone: client.phone,
            email: client.email,
            city: client.city,
            notes: client.notes,
          },
          policies: relations.policies.slice(0, 20).map((p) => ({
            policyNumber: p.policyNumber,
            clientName: p.clientName,
            insurerName: p.insurerName,
            line: p.line,
            expiryDate: p.expiryDate,
            premium: p.premium,
            currency: p.currency,
            status: p.status,
          })),
          claims: relations.claims.slice(0, 15).map((c) => ({
            claimNumber: c.claimNumber,
            clientName: c.clientName,
            insurerName: c.insurerName,
            policyNumber: c.policyNumber,
            claimAmount: c.claimAmount,
            currency: c.currency,
            status: c.status,
            incidentDate: c.incidentDate,
          })),
          tasks: relations.tasks.slice(0, 15).map((t) => ({
            title: t.title,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate,
          })),
          notes: `The broker is viewing Client 360 for: ${client.name}`,
        },
      },
    });
  };

  if (loading) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-container">
          <div className="inx-empty">
            <RefreshCw size={28} />
            <b>جاري تحميل تفاصيل العميل...</b>
          </div>
        </div>
      </main>
    );
  }

  if (!client) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-container">
          <div className="inx-empty">
            <UserRound size={32} />
            <b>لم يتم العثور على هذا العميل</b>
            <small>{error || 'قد يكون العميل غير موجود أو تم حذفه.'}</small>
            <Link to="/clients" className="inx-btn inx-btn-secondary" style={{ marginTop: 8 }}>
              <ArrowLeft size={16} /> العودة إلى العملاء
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mobile-page" dir="rtl">
      <div className="inx-container">
        <header className="inx-section-head" style={{ marginTop: 0 }}>
          <div>
            <Link
              to="/clients"
              className="inx-link"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6 }}
            >
              <ArrowLeft size={16} /> العملاء
            </Link>
            <span className="eyebrow">Client 360</span>
            <h2>{client.name}</h2>
            <small style={{ color: 'var(--inx-muted)' }}>
              عرض شامل لبيانات العميل ووثائقه ومطالباته ومهامه وتفاعلاته.
            </small>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="inx-btn inx-btn-primary"
              onClick={askCopilot}
            >
              <Bot size={16} /> اسأل المساعد
            </button>
            <button
              type="button"
              className="inx-btn inx-btn-secondary"
              onClick={() => setShowPolicyForm(true)}
            >
              <ShieldCheck size={16} /> إضافة وثيقة
            </button>
            <button
              type="button"
              className="inx-btn inx-btn-secondary"
              onClick={() => setShowEdit(true)}
            >
              <Pencil size={16} /> تعديل
            </button>
          </div>
        </header>

        {error && (
          <div className="inx-card" role="alert" style={{ marginBottom: 12, borderColor: 'var(--inx-danger)' }}>
            <span className="inx-badge inx-badge-danger">{error}</span>
          </div>
        )}

        <section className="inx-card inx-card-lg" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="inx-avatar" style={{ width: 64, height: 64, fontSize: 20, borderRadius: 16 }}>
              {initials(client.name)}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <span className="eyebrow">Insurance CRM</span>
              <h2 style={{ margin: '4px 0 8px', color: 'var(--inx-text)' }}>{client.name}</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="inx-badge inx-badge-neutral">
                  {client.type === 'company' ? <Building2 size={12} /> : <UserRound size={12} />}
                  {clientTypeLabel(client.type)}
                </span>
                <span className={`inx-badge inx-badge-${clientStatusTone(client.status)}`}>
                  <CheckCircle2 size={12} />
                  {clientStatusLabel(client.status)}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {client.phone && (
                <a href={`tel:${client.phone}`} className="inx-icon-btn" title="اتصال">
                  <Phone size={18} />
                </a>
              )}
              {client.email && (
                <a href={`mailto:${client.email}`} className="inx-icon-btn" title="بريد">
                  <Mail size={18} />
                </a>
              )}
            </div>
          </div>
        </section>

        <div className="inx-kpi-grid" style={{ marginBottom: 16 }}>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-icon-circle tone-cyan"><ShieldCheck size={18} /></span>
            </div>
            <div className="inx-kpi-value">{relations.policies.length}</div>
            <small className="inx-kpi-label">الوثائق</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-icon-circle tone-primary"><ClipboardCheck size={18} /></span>
            </div>
            <div className="inx-kpi-value">{openClaims.length}</div>
            <small className="inx-kpi-label">مطالبات مفتوحة</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-icon-circle tone-warning"><CalendarDays size={18} /></span>
            </div>
            <div className="inx-kpi-value">{renewals.length}</div>
            <small className="inx-kpi-label">تجديدات خلال 90 يوم</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-icon-circle tone-success"><ListTodo size={18} /></span>
            </div>
            <div className="inx-kpi-value">{openTasks.length}</div>
            <small className="inx-kpi-label">مهام مفتوحة</small>
          </article>
        </div>

        <div className="inx-section-head">
          <h2>بيانات العميل</h2>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          <article className="inx-card">
            <div className="inx-card-head">
              <h3>الملف الشخصي</h3>
              <UserRound size={18} style={{ color: 'var(--inx-muted)' }} />
            </div>
            <ul className="inx-list">
              <li className="inx-list-item">
                <div className="inx-list-copy">
                  <small>نوع العميل</small>
                  <b>{clientTypeLabel(client.type)}</b>
                </div>
              </li>
              <li className="inx-list-item">
                <div className="inx-list-copy">
                  <small>الحالة</small>
                  <b>{clientStatusLabel(client.status)}</b>
                </div>
              </li>
              {client.industry && (
                <li className="inx-list-item">
                  <div className="inx-list-copy">
                    <small>النشاط</small>
                    <b>{client.industry}</b>
                  </div>
                </li>
              )}
              {client.nationalId && (
                <li className="inx-list-item">
                  <div className="inx-list-copy">
                    <small>الرقم القومي</small>
                    <b>{client.nationalId}</b>
                  </div>
                </li>
              )}
              {client.taxId && (
                <li className="inx-list-item">
                  <div className="inx-list-copy">
                    <small>الرقم الضريبي</small>
                    <b>{client.taxId}</b>
                  </div>
                </li>
              )}
            </ul>
          </article>

          <article className="inx-card">
            <div className="inx-card-head">
              <h3>بيانات التواصل</h3>
              <Phone size={18} style={{ color: 'var(--inx-muted)' }} />
            </div>
            <ul className="inx-list">
              <li className="inx-list-item">
                <span className="inx-icon-circle inx-icon-circle-sm"><Phone size={14} /></span>
                <div className="inx-list-copy">
                  <small>الهاتف</small>
                  <b>{client.phone || 'غير متوفر'}</b>
                </div>
              </li>
              <li className="inx-list-item">
                <span className="inx-icon-circle inx-icon-circle-sm"><Mail size={14} /></span>
                <div className="inx-list-copy">
                  <small>البريد الإلكتروني</small>
                  <b>{client.email || 'غير متوفر'}</b>
                </div>
              </li>
              <li className="inx-list-item">
                <span className="inx-icon-circle inx-icon-circle-sm"><MapPin size={14} /></span>
                <div className="inx-list-copy">
                  <small>المدينة</small>
                  <b>{client.city || 'غير متوفرة'}</b>
                </div>
              </li>
              <li className="inx-list-item">
                <span className="inx-icon-circle inx-icon-circle-sm"><MapPin size={14} /></span>
                <div className="inx-list-copy">
                  <small>العنوان</small>
                  <b>{client.address || 'غير متوفر'}</b>
                </div>
              </li>
            </ul>
          </article>
        </div>

        <div className="inx-section-head">
          <h2>الملخص المالي</h2>
          <CircleDollarSign size={20} style={{ color: 'var(--inx-muted)' }} />
        </div>
        <div className="inx-kpi-grid" style={{ marginBottom: 16 }}>
          <article className="inx-kpi">
            <div className="inx-kpi-value">{relations.policies.length}</div>
            <small className="inx-kpi-label">إجمالي الوثائق</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-value" style={{ fontSize: 18 }}>
              {formatMoney(totalPremium, relations.policies[0]?.currency)}
            </div>
            <small className="inx-kpi-label">إجمالي الأقساط</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-value">{relations.claims.length}</div>
            <small className="inx-kpi-label">إجمالي المطالبات</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-value" style={{ fontSize: 18 }}>
              {formatMoney(totalClaims, relations.claims[0]?.currency)}
            </div>
            <small className="inx-kpi-label">قيمة المطالبات</small>
          </article>
        </div>

        <div className="inx-section-head">
          <h2>الوثائق</h2>
          <span className="inx-badge inx-badge-neutral">{relations.policies.length}</span>
        </div>
        {relations.policies.length === 0 ? (
          <div className="inx-empty">
            <ShieldCheck size={28} />
            <b>لا توجد وثائق</b>
            <small>لم يتم إضافة وثيقة لهذا العميل بعد.</small>
          </div>
        ) : (
          <ul className="inx-list">
            {relations.policies.map((policy) => (
              <li key={policy.id}>
                <Link to="/policies" className="inx-list-item">
                  <span className="inx-icon-circle tone-cyan"><ShieldCheck size={16} /></span>
                  <div className="inx-list-copy">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <b style={{ marginBottom: 0 }}>{policy.policyNumber || 'وثيقة'}</b>
                      <span className={`inx-badge inx-badge-${policyStatusTone(policy.status)}`}>
                        {policyStatusLabel(policy.status)}
                      </span>
                    </div>
                    <small>{policy.insurerName || 'شركة غير محددة'}</small>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11.5, color: 'var(--inx-muted)', marginTop: 4 }}>
                      <span>{policy.line || 'نوع غير محدد'}</span>
                      <span>·</span>
                      <span>ينتهي: {formatDate(policy.expiryDate)}</span>
                      <span>·</span>
                      <span>{formatMoney(policy.premium, policy.currency)}</span>
                    </div>
                  </div>
                  <ChevronLeft size={16} className="inx-list-chevron" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="inx-section-head">
          <h2>المطالبات</h2>
          <span className="inx-badge inx-badge-neutral">{relations.claims.length}</span>
        </div>
        {relations.claims.length === 0 ? (
          <div className="inx-empty">
            <ClipboardCheck size={28} />
            <b>لا توجد مطالبات</b>
            <small>لم يتم فتح مطالبة لهذا العميل بعد.</small>
          </div>
        ) : (
          <ul className="inx-list">
            {relations.claims.map((claim) => (
              <li key={claim.id}>
                <Link to={`/claims/${claim.id}`} className="inx-list-item">
                  <span className="inx-icon-circle tone-primary"><ClipboardCheck size={16} /></span>
                  <div className="inx-list-copy">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <b style={{ marginBottom: 0 }}>{claim.claimNumber || 'مطالبة'}</b>
                      <span className={`inx-badge inx-badge-${claimStatusTone(claim.status)}`}>
                        {claimStatusLabel(claim.status)}
                      </span>
                    </div>
                    <small>{claim.insurerName || 'شركة غير محددة'}</small>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11.5, color: 'var(--inx-muted)', marginTop: 4 }}>
                      <span>وثيقة: {claim.policyNumber || 'غير محددة'}</span>
                      <span>·</span>
                      <span>تاريخ الحادث: {formatDate(claim.incidentDate)}</span>
                      <span>·</span>
                      <span>{formatMoney(claim.claimAmount, claim.currency)}</span>
                    </div>
                  </div>
                  <ChevronLeft size={16} className="inx-list-chevron" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="inx-section-head">
          <h2>المهام</h2>
          <span className="inx-badge inx-badge-neutral">{relations.tasks.length}</span>
        </div>
        {relations.tasks.length === 0 ? (
          <div className="inx-empty">
            <ListTodo size={28} />
            <b>لا توجد مهام</b>
            <small>لم يتم إضافة مهام لهذا العميل بعد.</small>
          </div>
        ) : (
          <ul className="inx-list">
            {relations.tasks.map((task) => (
              <li key={task.id}>
                <Link to="/tasks" className="inx-list-item">
                  <span className="inx-icon-circle tone-success"><ListTodo size={16} /></span>
                  <div className="inx-list-copy">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <b style={{ marginBottom: 0 }}>{task.title || 'مهمة'}</b>
                      <span className={`inx-badge inx-badge-${taskStatusTone(task.status)}`}>
                        {taskStatusLabel(task.status)}
                      </span>
                    </div>
                    <small>الأولوية: {task.priority || 'عادية'}</small>
                    <div style={{ display: 'flex', gap: 8, fontSize: 11.5, color: 'var(--inx-muted)', marginTop: 4 }}>
                      <CalendarDays size={12} />
                      <span>تاريخ الاستحقاق: {formatDate(task.dueDate)}</span>
                    </div>
                  </div>
                  <ChevronLeft size={16} className="inx-list-chevron" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {renewals.length > 0 && (
          <>
            <div className="inx-section-head">
              <h2>التجديدات القريبة</h2>
              <span className="inx-badge inx-badge-warning">{renewals.length}</span>
            </div>
            <ul className="inx-list">
              {renewals.map((policy) => (
                <li key={policy.id}>
                  <Link to="/renewals" className="inx-list-item">
                    <span className="inx-icon-circle tone-warning">
                      <CalendarDays size={16} />
                    </span>
                    <div className="inx-list-copy">
                      <b>{policy.policyNumber || 'وثيقة'}</b>
                      <small>{policy.insurerName || 'شركة غير محددة'}</small>
                      <div style={{ fontSize: 11.5, color: 'var(--inx-muted)', marginTop: 4 }}>
                        تاريخ التجديد: {formatDate(policy.expiryDate)}
                      </div>
                    </div>
                    <ChevronLeft size={16} className="inx-list-chevron" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="inx-section-head">
          <h2>المستندات وطلبات العروض</h2>
        </div>
        {profile?.organizationId ? (
          <ClientDocumentsPanel clientId={client.id} organizationId={profile.organizationId} />
        ) : null}
        {profile?.organizationId ? (
          <ClientTimeline clientId={client.id} organizationId={profile.organizationId} />
        ) : null}
        {profile?.organizationId ? (
          <RfqWorkspace
            organizationId={profile.organizationId}
            clientId={client.id}
            clientName={client.name}
            uid={profile.uid ?? ''}
          />
        ) : null}

        <div className="inx-section-head">
          <h2>الملاحظات</h2>
          <StickyNote size={20} style={{ color: 'var(--inx-muted)' }} />
        </div>
        <article className="inx-card">
          {client.notes ? (
            <p style={{ margin: 0, color: 'var(--inx-text)', lineHeight: 1.7 }}>{client.notes}</p>
          ) : (
            <div className="inx-empty">
              <FileText size={24} />
              <b>لا توجد ملاحظات</b>
              <small>يمكنك إضافة ملاحظات من نافذة التعديل.</small>
            </div>
          )}
        </article>
      </div>

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

      {showPolicyForm && (
        <PolicyForm
          presetClientId={client.id}
          onDone={() => {
            setShowPolicyForm(false);
            void loadClient();
          }}
          onCancel={() => setShowPolicyForm(false)}
        />
      )}
    </main>
  );
}