import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronLeft,
  FileCheck2,
  FolderOpen,
  Inbox,
  Mail,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
  CalendarDays,
  Zap,
  Target
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { listClients } from '../features/clients/client.service';
import { listDocuments } from '../features/documents/document.service';
import type { InsuranceClient, ClientType } from '../types/client';
import type { DocumentRecord } from '../types/document';
import {
  loadOperationsSnapshot,
  type OperationsSnapshot,
} from '../features/operations/operations.service';
import {
  addOperationsEmail,
  listOperationsEmails,
  removeOperationsEmail,
  type OperationsEmailContact,
} from '../features/operations/operations-directory.service';
import {
  onboardOperationsClient,
  type ClientOnboardingDocument,
  type ClientOnboardingInput,
} from '../features/operations/operations-v80-foundation.service';
import { listOrganizationRfqs } from '../features/rfq/rfq.service';
import type { RfqRecord } from '../features/rfq/rfq-types';
import ClientRfqOperationsWorkspace from '../features/operations/ClientRfqOperationsWorkspace';
import IssuanceWorkspace from '../features/operations/IssuanceWorkspace';
import type { OperationWorkItem } from '../features/operations/operations-workflow.service';
import MiniDonutChart from '../components/charts/MiniDonutChart';
import MiniBarChart from '../components/charts/MiniBarChart';
import '../theme/operations-v80.css';
import AdsSlideshow from '../features/admin/AdsSlideshow';
import { usePlatformSettings } from '../features/admin/PlatformSettingsProvider';

type View = 'overview' | 'inbox' | 'new-business' | 'accounts' | 'smart' | 'emails';

const EMPTY: OperationsSnapshot = {
  tasks: [],
  claims: [],
  renewals: [],
  workItems: [],
};

const WORKFLOW_STEPS = [
  { title: 'إنشاء العميل', description: 'تسجيل بيانات العميل ووسائل التواصل وتحديد نوع التأمين المطلوب.' },
  { title: 'طلب عرض سعر', description: 'تجهيز بيانات الطلب وإرسالها إلى شركات التأمين المناسبة.' },
  { title: 'استلام العروض', description: 'جمع عروض الأسعار والتغطيات والشروط الواردة من الشركات.' },
  { title: 'المقارنة', description: 'مقارنة الأقساط وحدود التغطية والاستثناءات والتحملات.' },
  { title: 'موافقة العميل', description: 'توثيق اختيار العميل وموافقته على العرض والشروط.' },
  { title: 'طلب الإصدار', description: 'إرسال طلب الإصدار والمستندات المطلوبة ومتابعة حالته.' },
  { title: 'استلام الوثيقة', description: 'مراجعة الوثيقة الصادرة والتأكد من البيانات والتغطيات والتواريخ.' },
  { title: 'تفعيل الحساب', description: 'ربط الوثيقة بملف العميل وجدولة التجديد والمتابعة.' },
];

function OperationsRobot() {
  return (
    <svg
      className="inx-ops-robot-mark"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path className="inx-ops-robot-antenna" d="M32 12V7" />
      <circle className="inx-ops-robot-antenna-tip" cx="32" cy="5.5" r="3.5" />
      <path className="inx-ops-robot-side" d="M9 29H5v12h5M55 29h4v12h-4" />
      <rect className="inx-ops-robot-shell" x="10" y="15" width="44" height="40" rx="13" />
      <rect className="inx-ops-robot-screen" x="16" y="22" width="32" height="20" rx="8" />
      <circle className="inx-ops-robot-eye" cx="24" cy="32" r="3.2" />
      <circle className="inx-ops-robot-eye" cx="40" cy="32" r="3.2" />
      <path className="inx-ops-robot-mouth" d="M23 46c2.6 3.2 5.6 4.7 9 4.7s6.4-1.5 9-4.7" />
      <path className="inx-ops-robot-detail" d="M27 18.5h10" />
      <path className="inx-ops-robot-spark" d="M50 9l1.8 3.8L56 14.5l-4.2 1.7L50 20l-1.7-3.8-4.3-1.7 4.3-1.7L50 9z" />
    </svg>
  );
}

export default function OperationsPage() {
  const { profile, user } = useAuth();
  const { settings } = usePlatformSettings();
  const [view, setView] = useState<View>('overview');
  const [data, setData] = useState<OperationsSnapshot>(EMPTY);
  const [rfqs, setRfqs] = useState<RfqRecord[]>([]);
  const [clients, setClients] = useState<InsuranceClient[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [emails, setEmails] = useState<OperationsEmailContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRequest, setShowRequest] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedOperation, setSelectedOperation] = useState<OperationWorkItem | null>(null);
  const [workflowGuideOpen, setWorkflowGuideOpen] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.organizationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [snapshot, c, d, e, r] = await Promise.all([
        loadOperationsSnapshot(profile.organizationId),
        listClients(profile.organizationId),
        listDocuments(profile.organizationId),
        listOperationsEmails(profile.organizationId),
        listOrganizationRfqs(profile.organizationId),
      ]);
      setData(snapshot);
      setSelectedOperation((current) =>
        current ? snapshot.workItems.find((item) => item.id === current.id) || current : null,
      );
      setClients(c);
      setDocuments(d);
      setEmails(e);
      setRfqs(r);
    } catch (x) {
      console.error(x);
      setError('تعذر تحميل مركز العمليات.');
    } finally {
      setLoading(false);
    }
  }, [profile?.organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeOps = useMemo(
    () => data.workItems.filter((i) => !['completed', 'cancelled'].includes(i.status)),
    [data.workItems],
  );
  const overdue = useMemo(
    () => activeOps.filter((i) => i.dueDate && i.dueDate < new Date().toISOString().slice(0, 10)),
    [activeOps],
  );
  const today = useMemo(
    () => activeOps.filter((i) => i.dueDate === new Date().toISOString().slice(0, 10)),
    [activeOps],
  );
  const prospect = useMemo(() => clients.filter((c) => c.status === 'prospect'), [clients]);
  const completed = useMemo(
    () => data.workItems.filter((i) => i.status === 'completed'),
    [data.workItems],
  );

  function proceed(clientId: string) {
    setSelectedClientId(clientId);
    setShowRequest(false);
    setView('new-business');
  }

  if (loading) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-container">
          <div className="inx-empty">
            <RefreshCw size={28} />
            <b>جارٍ تجهيز مركز العمليات...</b>
          </div>
        </div>
      </main>
    );
  }

  const workflowSegments = [
    { label: 'نشطة', value: activeOps.length, color: '#1E4272' },
    { label: 'مكتملة', value: completed.length, color: '#10b981' },
    { label: 'متأخرة', value: overdue.length, color: '#dc2626' },
  ];

  const opsBarData = [
    activeOps.length,
    today.length,
    overdue.length,
    prospect.length,
    completed.length,
  ];
  const opsBarLabels = ['نشطة', 'اليوم', 'متأخرة', 'محتملون', 'مكتملة'];

  return (
    <main className="mobile-page" dir="rtl">
      <div className="inx-container">
        {/* ============ HEADER ============ */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            padding: '4px 0 14px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <span className="eyebrow">INSURNEX · OPERATIONS</span>
            <h2 style={{ margin: '2px 0 4px', fontSize: 20, color: 'var(--inx-text)' }}>
              مركز العمليات
            </h2>
            <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
              رحلة موحدة من العميل حتى الإصدار وإدارة الحساب.
            </small>
          </div>
          <button
            type="button"
            className="inx-btn inx-btn-primary"
            onClick={() => setShowRequest(true)}
          >
            <Plus size={16} /> طلب جديد
          </button>
        </header>

        {settings.advertising.enabled && settings.advertising.operations && (
          <div style={{ marginBottom: 14 }}><AdsSlideshow /></div>
        )}

        {error && (
          <div
            className="inx-card"
            role="alert"
            style={{ marginBottom: 12, borderColor: 'var(--inx-danger)' }}
          >
            <span className="inx-badge inx-badge-danger">{error}</span>
          </div>
        )}

        {/* ============ NAV TABS ============ */}
        <nav className="inx-chips" style={{ marginBottom: 16 }}>
          {(
            [
              ['overview', 'نظرة عامة', BriefcaseBusiness],
              ['inbox', 'صندوق العمليات', Inbox],
              ['new-business', 'أعمال جديدة', FileCheck2],
              ['accounts', 'العملاء الحاليون', Users],
              ['smart', 'Smart Operate', ShieldCheck],
              ['emails', 'E-mails', Mail],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              className={`inx-chip ${view === id ? 'active' : ''}`}
              onClick={() => setView(id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>

        {/* ============ OVERVIEW ============ */}
        {view === 'overview' && (
          <>
            <div className="inx-kpi-grid" style={{ marginBottom: 16 }}>
              <article className="inx-kpi">
                <div className="inx-kpi-head">
                  <span className="inx-3d-icon sm tone-cyan" data-insurnex-operations-icon="v16"><Zap size={18} strokeWidth={1.9} aria-hidden="true" /></span>
                </div>
                <div className="inx-kpi-value">{activeOps.length}</div>
                <small className="inx-kpi-label">عمليات نشطة</small>
              </article>
              <article className="inx-kpi">
                <div className="inx-kpi-head">
                  <span className="inx-3d-icon sm" data-insurnex-operations-icon="v16"><CalendarDays size={18} strokeWidth={1.9} aria-hidden="true" /></span>
                </div>
                <div className="inx-kpi-value">{today.length}</div>
                <small className="inx-kpi-label">مطلوب اليوم</small>
              </article>
              <article className="inx-kpi">
                <div className="inx-kpi-head">
                  <span className="inx-3d-icon sm tone-danger" data-insurnex-operations-icon="v16"><AlertTriangle size={18} strokeWidth={1.9} aria-hidden="true" />️</span>
                </div>
                <div className="inx-kpi-value">{overdue.length}</div>
                <small className="inx-kpi-label">متأخرة</small>
              </article>
              <article className="inx-kpi">
                <div className="inx-kpi-head">
                  <span className="inx-3d-icon sm tone-warning" data-insurnex-operations-icon="v16"><Target size={18} strokeWidth={1.9} aria-hidden="true" /></span>
                </div>
                <div className="inx-kpi-value">{prospect.length}</div>
                <small className="inx-kpi-label">عملاء محتملون</small>
              </article>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: 12,
                marginBottom: 16,
              }}
            >
              <article className="inx-chart-card">
                <div className="chart-head">
                  <span className="label">توزيع العمليات</span>
                  <span className="value">{data.workItems.length}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 14,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                  }}
                >
                  <MiniDonutChart
                    segments={workflowSegments}
                    size={110}
                    thickness={14}
                    centerValue={String(activeOps.length)}
                    centerLabel="نشطة"
                  />
                  <div className="inx-donut-legend" style={{ flex: 1, minWidth: 120 }}>
                    {workflowSegments.map((s) => (
                      <div className="legend-row" key={s.label}>
                        <span className="dot" style={{ background: s.color }} />
                        <span className="legend-label">{s.label}</span>
                        <span className="legend-value">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </article>

              <article className="inx-chart-card">
                <div className="chart-head">
                  <span className="label">نبض العمليات</span>
                  <span className="delta up">↑ مباشر</span>
                </div>
                <div style={{ color: 'var(--inx-blue)' }}>
                  <MiniBarChart
                    data={opsBarData}
                    labels={opsBarLabels}
                    height={80}
                    color="var(--inx-blue)"
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: 'var(--inx-muted)',
                  }}
                >
                  <span>نشطة</span>
                  <span>اليوم</span>
                  <span>متأخرة</span>
                  <span>محتملون</span>
                  <span>مكتملة</span>
                </div>
              </article>
            </div>
            {/* Workflow steps moved to the fixed robot guide. */}



            <div className="inx-section-head">
              <h2>ابدأ من هنا</h2>
              <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
                العميل هو محور كل ما سيأتي بعد ذلك.
              </small>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 10,
              }}
            >
              <button
                type="button"
                className="inx-shortcut-card"
                onClick={() => setShowRequest(true)}
                style={{ cursor: 'pointer' }}
              >
                <span className="inx-3d-icon tone-cyan">👤</span>
                <span className="label">طلب جديد</span>
                <span className="sub">عميل حالي أو جديد</span>
              </button>
              <button
                type="button"
                className="inx-shortcut-card"
                onClick={() => setView('new-business')}
                style={{ cursor: 'pointer' }}
              >
                <span className="inx-3d-icon tone-warning">📂</span>
                <span className="label">أعمال جديدة</span>
                <span className="sub">متابعة العملاء المحتملين</span>
              </button>
              <button
                type="button"
                className="inx-shortcut-card"
                onClick={() => setView('accounts')}
                style={{ cursor: 'pointer' }}
              >
                <span className="inx-3d-icon tone-success">👥</span>
                <span className="label">العملاء الحاليون</span>
                <span className="sub">بوابة Account Manager</span>
              </button>
              <button
                type="button"
                className="inx-shortcut-card"
                onClick={() => setView('emails')}
                style={{ cursor: 'pointer' }}
              >
                <span className="inx-3d-icon tone-purple">✉️</span>
                <span className="label">E-mails</span>
                <span className="sub">دليل بريد الشركات</span>
              </button>
            </div>
          </>
        )}

        {/* ============ INBOX ============ */}
        {view === 'inbox' && !selectedOperation && (
          <InboxView items={activeOps} onOpen={setSelectedOperation} />
        )}
        {view === 'inbox' && selectedOperation && profile && user && (
          <IssuanceWorkspace
            item={selectedOperation}
            organizationId={profile.organizationId}
            uid={user.uid}
            onClose={() => setSelectedOperation(null)}
            onChanged={async () => {
              await load();
            }}
          />
        )}

        {/* ============ NEW BUSINESS ============ */}
        {view === 'new-business' && (
          <ClientRfqOperationsWorkspace
            clients={clients}
            documents={documents}
            rfqs={rfqs}
            operations={data.workItems}
            selectedClientId={selectedClientId}
            onSelectClient={setSelectedClientId}
            organizationId={profile?.organizationId || ''}
            uid={user?.uid || ''}
            onChanged={load}
          />
        )}

        {/* ============ ACCOUNTS ============ */}
        {view === 'accounts' && <Accounts clients={clients} />}

        {/* ============ SMART ============ */}
        {view === 'smart' && <Smart clients={clients} docs={documents} />}

        {/* ============ EMAILS ============ */}
        {view === 'emails' && profile && user && (
          <EmailSettings
            items={emails}
            organizationId={profile.organizationId}
            uid={user.uid}
            onChanged={load}
          />
        )}
      </div>

      {/* ============ NEW REQUEST WIZARD ============ */}
      {showRequest && profile && user && (
        <NewRequestWizard
          clients={clients}
          organizationId={profile.organizationId}
          uid={user.uid}
          onClose={() => setShowRequest(false)}
          onReady={proceed}
          onChanged={load}
        />
      )}
        <aside className={`inx-workflow-assistant${workflowGuideOpen ? " is-open" : ""}`} dir="rtl">
          {workflowGuideOpen && (
            <section
              id="inx-workflow-assistant-panel"
              className="inx-workflow-assistant-panel"
              role="dialog"
              aria-label="مساعد مسار العمل"
            >
              <header className="inx-workflow-assistant-header">
                <span className="inx-workflow-assistant-brand"><OperationsRobot /></span>
                <span className="inx-workflow-assistant-heading">
                  <strong>مساعد مسار العمل</strong>
                  <small>رحلة العملية في 8 خطوات</small>
                </span>
                <button
                  type="button"
                  className="inx-workflow-assistant-close"
                  onClick={() => setWorkflowGuideOpen(false)}
                  aria-label="إغلاق دليل مسار العمل"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </header>
              <ol className="inx-workflow-assistant-steps">
                {WORKFLOW_STEPS.map((step, i) => (
                  <li key={step.title} className="inx-workflow-assistant-step">
                    <span className="inx-workflow-assistant-number">{i + 1}</span>
                    <span className="inx-workflow-assistant-copy">
                      <strong>{step.title}</strong>
                      <small>{step.description}</small>
                    </span>
                  </li>
                ))}
              </ol>
              <footer className="inx-workflow-assistant-footer">
                يمكنك الرجوع إلى هذا الدليل في أي وقت من أيقونة الروبوت.
              </footer>
            </section>
          )}
          <button
            type="button"
            className="inx-workflow-assistant-launcher"
            onClick={() => setWorkflowGuideOpen((open) => !open)}
            aria-expanded={workflowGuideOpen}
            aria-controls="inx-workflow-assistant-panel"
            aria-label={workflowGuideOpen ? 'إغلاق دليل مسار العمل' : 'فتح دليل مسار العمل'}
            title="دليل مسار العمل"
          >
            {workflowGuideOpen ? <X size={23} aria-hidden="true" /> : <OperationsRobot />}
          </button>
        </aside>
    </main>
  );
}

/* ============================================================
   Sub-components (kept functional)
   ============================================================ */

function Heading({ title, text }: { title: string; text: string }) {
  return (
    <header className="op80-heading">
      <div>
        <h2>{title}</h2>
        <p>{text}</p>
      </div>
    </header>
  );
}

function InboxView({
  items,
  onOpen,
}: {
  items: OperationWorkItem[];
  onOpen: (item: OperationWorkItem) => void;
}) {
  const [q, setQ] = useState('');
  const visible = items.filter((i) =>
    `${i.title} ${i.clientName || ''} ${i.insurerName || ''}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );

  return (
    <section className="op80-panel">
      <Heading
        title="صندوق العمليات"
        text="كل ما يحتاج تدخلًا بشريًا في قائمة واحدة."
      />
      <label className="op80-search">
        <Search />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث بالعميل أو العملية أو شركة التأمين"
        />
      </label>
      <div className="op80-list">
        {visible.map((i) => (
          <div className="op80-row" key={i.id}>
            <span className={`op80-dot ${i.priority || ''}`} />
            <div>
              <b>{i.title}</b>
              <small>
                {i.clientName || 'بدون عميل'} · {i.insurerName || 'بدون شركة'} ·{' '}
                {i.status}
              </small>
            </div>
            {i.kind === 'policy_issuance' ? (
              <button
                type="button"
                className="op96-open"
                onClick={() => onOpen(i)}
              >
                فتح عملية الإصدار <ChevronLeft />
              </button>
            ) : i.clientId ? (
              <Link to={`/clients/${i.clientId}`}>
                فتح العميل <ChevronLeft />
              </Link>
            ) : null}
          </div>
        ))}
        {!visible.length && (
          <div className="op80-empty">
            <CheckCircle2 />
            لا توجد عمليات مطابقة
          </div>
        )}
      </div>
    </section>
  );
}

function Accounts({ clients }: { clients: InsuranceClient[] }) {
  return (
    <section className="op80-panel">
      <Heading
        title="العملاء الحاليون"
        text="Foundation لواجهة Personal Account Manager القادمة."
      />
      <div className="op80-client-grid">
        {clients
          .filter((c) => c.status === 'active')
          .map((c) => (
            <article key={c.id}>
              <span className="op80-avatar">
                <Users />
              </span>
              <div>
                <b>{c.name}</b>
                <small>
                  {c.email || c.phone || 'بيانات الاتصال غير مكتملة'}
                </small>
              </div>
              <Link to={`/clients/${c.id}`}>
                فتح الحساب <ChevronLeft />
              </Link>
            </article>
          ))}
      </div>
    </section>
  );
}

function Smart({
  clients,
  docs,
}: {
  clients: InsuranceClient[];
  docs: DocumentRecord[];
}) {
  const missing = clients.filter(
    (c) =>
      docs.filter((d) => d.relatedType === 'client' && d.relatedId === c.id).length === 0,
  );
  return (
    <section className="op80-panel">
      <Heading
        title="Smart Operate"
        text="في V8.0 نؤسس File Health دون ادعاء وجود تحليل AI غير مبني بعد."
      />
      <div className="op80-metrics">
        <div>
          <b>{clients.length}</b>
          <span>ملفات عملاء</span>
        </div>
        <div className="danger">
          <b>{missing.length}</b>
          <span>بدون مستندات</span>
        </div>
      </div>
      <p className="op80-note">
        V8.4 ستضيف Risk Assessment والتحليلات المتخصصة حسب نوع التأمين.
      </p>
    </section>
  );
}

function NewRequestWizard({
  clients,
  organizationId,
  uid,
  onClose,
  onReady,
  onChanged,
}: {
  clients: InsuranceClient[];
  organizationId: string;
  uid: string;
  onClose: () => void;
  onReady: (id: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [mode, setMode] = useState<'choose' | 'existing' | 'new'>('choose');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [type, setType] = useState<ClientType>('company');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [taxId, setTaxId] = useState('');
  const [industry, setIndustry] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<ClientOnboardingDocument[]>([]);

  const filtered = clients.filter((c) =>
    `${c.name} ${c.phone} ${c.email}`.toLowerCase().includes(query.toLowerCase()),
  );

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((x) => [
      ...x,
      ...Array.from(list).map((file) => ({
        file,
        name: file.name,
        category: 'client' as const,
      })),
    ]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const input: ClientOnboardingInput = {
        type,
        name,
        email,
        phone,
        nationalId: nationalId || undefined,
        taxId: taxId || undefined,
        industry: industry || undefined,
        city: city || undefined,
        address: address || undefined,
        notes: notes || undefined,
      };
      const result = await onboardOperationsClient(input, files, organizationId, uid);
      await onChanged();
      onReady(result.clientId);
    } catch (x) {
      console.error(x);
      setError(
        'تعذر إنشاء العميل أو رفع أحد المستندات. تحقق من الأنواع والأحجام المسموحة.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="op80-modal">
      <section>
        <header>
          <div>
            <span>New Request</span>
            <h2>
              {mode === 'choose'
                ? 'بدء طلب جديد'
                : mode === 'existing'
                ? 'اختيار عميل حالي'
                : 'إنشاء عميل جديد'}
            </h2>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>

        {mode === 'choose' && (
          <div className="op80-choice">
            <button onClick={() => setMode('existing')}>
              <Users />
              <b>عميل حالي</b>
              <small>ربط الطلب بعميل مسجل بالفعل</small>
            </button>
            <button onClick={() => setMode('new')}>
              <Plus />
              <b>عميل جديد</b>
              <small>إنشاء ملف عميل ومستنداته</small>
            </button>
          </div>
        )}

        {mode === 'existing' && (
          <>
            <label className="op80-search">
              <Search />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="الاسم أو الهاتف أو البريد"
              />
            </label>
            <div className="op80-picker">
              {filtered.map((c) => (
                <button key={c.id} onClick={() => onReady(c.id)}>
                  <span>
                    {c.type === 'company' ? <Building2 /> : <UserRound />}
                  </span>
                  <div>
                    <b>{c.name}</b>
                    <small>
                      {c.phone} · {c.email}
                    </small>
                  </div>
                  <ChevronLeft />
                </button>
              ))}
            </div>
            <footer>
              <button onClick={() => setMode('choose')}>رجوع</button>
            </footer>
          </>
        )}

        {mode === 'new' && (
          <form onSubmit={submit}>
            <div className="op80-type">
              <button
                type="button"
                className={type === 'individual' ? 'active' : ''}
                onClick={() => setType('individual')}
              >
                <UserRound />
                فردي
              </button>
              <button
                type="button"
                className={type === 'company' ? 'active' : ''}
                onClick={() => setType('company')}
              >
                <Building2 />
                شركة / جماعي
              </button>
            </div>
            <div className="op80-form">
              <label>
                <span>{type === 'company' ? 'اسم الشركة *' : 'اسم العميل *'}</span>
                <input required value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label>
                <span>الهاتف *</span>
                <input required value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label>
                <span>البريد</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              {type === 'individual' ? (
                <label>
                  <span>الرقم القومي</span>
                  <input
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                  />
                </label>
              ) : (
                <>
                  <label>
                    <span>الرقم / البطاقة الضريبية</span>
                    <input value={taxId} onChange={(e) => setTaxId(e.target.value)} />
                  </label>
                  <label>
                    <span>النشاط</span>
                    <input
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                    />
                  </label>
                </>
              )}
              <label>
                <span>المدينة</span>
                <input value={city} onChange={(e) => setCity(e.target.value)} />
              </label>
              <label className="wide">
                <span>العنوان</span>
                <input value={address} onChange={(e) => setAddress(e.target.value)} />
              </label>
              <label className="wide">
                <span>ملاحظات</span>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
              <label className="wide op80-upload">
                <Paperclip />
                <span>مستندات العميل</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx"
                  onChange={(e) => addFiles(e.target.files)}
                />
                <small>
                  مثل السجل التجاري، البطاقة الضريبية، الهوية أو أي مستند داعم.
                  الحد الحالي 10MB وفق Document Service.
                </small>
              </label>
            </div>
            {files.length > 0 && (
              <div className="op80-files">
                {files.map((f, i) => (
                  <span key={`${f.file.name}-${i}`}>
                    <FolderOpen />
                    {f.file.name}
                    <button
                      type="button"
                      onClick={() => setFiles((x) => x.filter((_, n) => n !== i))}
                    >
                      <X />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {error && (
              <div className="op80-alert">
                <AlertTriangle />
                {error}
              </div>
            )}
            <footer>
              <button type="button" onClick={() => setMode('choose')}>
                رجوع
              </button>
              <button className="op80-primary" disabled={busy}>
                {busy ? 'جارٍ إنشاء الملف...' : 'إنشاء العميل والمتابعة'}
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}

function EmailSettings({
  items,
  organizationId,
  uid,
  onChanged,
}: {
  items: OperationsEmailContact[];
  organizationId: string;
  uid: string;
  onChanged: () => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!email.includes('@')) return;
    setBusy(true);
    try {
      await addOperationsEmail(organizationId, email, label, uid);
      setEmail('');
      setLabel('');
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="op80-panel">
      <Heading
        title="E-mails"
        text="Foundation لدليل بريد شركات التأمين. V8.1 ستضيف الربط المنظم Company + Insurance Line."
      />
      <div className="op80-email-add">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="underwriting@insurer.com"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="الشركة / القسم"
        />
        <button className="op80-primary" disabled={busy} onClick={() => void add()}>
          إضافة
        </button>
      </div>
      <div className="op80-email-list">
        {items.map((i) => (
          <div key={i.id}>
            <Mail />
            <div>
              <b>{i.email}</b>
              <small>{i.label || 'Operations'}</small>
            </div>
            <button
              onClick={async () => {
                await removeOperationsEmail(i.id);
                await onChanged();
              }}
            >
              حذف
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}