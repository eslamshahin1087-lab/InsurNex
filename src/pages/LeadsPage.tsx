import {
  ArrowLeft,
  Bot,
  Building2,
  Mail,
  Moon,
  Phone,
  Plus,
  Search,
  Sun,
  Target,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { createLead, listLeads } from '../features/leads/lead.service';
import { listInsurers } from '../features/insurers/insurer.service';
import type { Insurer } from '../types/insurance';
import type {
  Lead,
  LeadInput,
  LeadPriority,
  LeadSource,
  LeadStage,
} from '../types/lead';
import {
  LEAD_PRIORITY_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_STAGE_LABELS,
} from '../types/lead';
import { setCurrentContext } from '../features/copilot/copilot-context.store';
import { useTheme } from '../theme/ThemeProvider';
import MiniDonutChart from '../components/charts/MiniDonutChart';
import MiniBarChart from '../components/charts/MiniBarChart';

const stageOptions: LeadStage[] = [
  'new',
  'contacted',
  'qualified',
  'quotation',
  'negotiation',
  'won',
  'lost',
];
const sourceOptions: LeadSource[] = [
  'website',
  'referral',
  'phone',
  'email',
  'social',
  'campaign',
  'walk_in',
  'existing_client',
  'other',
];
const priorityOptions: LeadPriority[] = ['low', 'medium', 'high'];

const normalize = (v: string) => v.trim().toLocaleLowerCase('ar');
const money = (v: number) =>
  new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(v || 0);

const STAGE_TONES: Record<LeadStage, string> = {
  new: 'primary',
  contacted: 'warning',
  qualified: 'primary',
  quotation: 'warning',
  negotiation: 'warning',
  won: 'success',
  lost: 'danger',
};

export default function LeadsPage() {
  const { user, profile } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | LeadStage>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | LeadSource>('all');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState<LeadSource>('other');
  const [priority, setPriority] = useState<LeadPriority>('medium');
  const [insuranceType, setInsuranceType] = useState('');
  const [preferredInsurerId, setPreferredInsurerId] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [notes, setNotes] = useState('');

  async function load() {
    if (!profile?.organizationId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError('');
      const [l, i] = await Promise.all([
        listLeads(profile.organizationId),
        listInsurers(profile.organizationId),
      ]);
      setLeads(l);
      setInsurers(i);
    } catch (e) {
      console.error(e);
      setError('تعذر تحميل بيانات العملاء المحتملين.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [profile?.organizationId]);

  // Copilot context
  useEffect(() => {
    if (!leads.length) return;
    setCurrentContext({
      page: 'leads',
      leads: leads.slice(0, 15).map((l) => ({
        name: l.name,
        companyName: l.companyName,
        stage: l.stage,
        insuranceType: l.insuranceType,
        estimatedValue: l.estimatedValue,
      })),
      stats: {
        totalLeads: leads.length,
        wonLeads: leads.filter((l) => l.stage === 'won').length,
        pipelineValue: leads
          .filter((l) => !['won', 'lost'].includes(l.stage))
          .reduce((s, l) => s + (Number(l.estimatedValue) || 0), 0),
      },
      notes: 'The broker is viewing the sales pipeline',
    });
  }, [leads]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return leads.filter(
      (l) =>
        (stageFilter === 'all' || l.stage === stageFilter) &&
        (sourceFilter === 'all' || l.source === sourceFilter) &&
        (!q ||
          [
            l.name,
            l.companyName,
            l.phone,
            l.email,
            l.insuranceType,
            l.preferredInsurerName,
          ]
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase('ar')
            .includes(q)),
    );
  }, [leads, search, stageFilter, sourceFilter]);

  const stats = useMemo(() => {
    const active = leads.filter((l) => !['won', 'lost'].includes(l.stage));
    const won = leads.filter((l) => l.stage === 'won');
    return {
      total: leads.length,
      active: active.length,
      won: won.length,
      pipeline: active.reduce((t, l) => t + (Number(l.estimatedValue) || 0), 0),
      rate: leads.length ? Math.round((won.length / leads.length) * 100) : 0,
    };
  }, [leads]);

  function reset() {
    setName('');
    setCompanyName('');
    setPhone('');
    setEmail('');
    setSource('other');
    setPriority('medium');
    setInsuranceType('');
    setPreferredInsurerId('');
    setEstimatedValue('');
    setNotes('');
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !profile) {
      setError('تعذر التحقق من الحساب.');
      return;
    }
    if (!name.trim() || !phone.trim() || !insuranceType.trim()) {
      setError('يرجى ملء الحقول المطلوبة.');
      return;
    }
    const insurer = insurers.find((i) => i.id === preferredInsurerId);
    const input: LeadInput = {
      name: name.trim(),
      companyName: companyName.trim() || undefined,
      phone: phone.trim(),
      email: email.trim(),
      source,
      priority,
      stage: 'new',
      insuranceType: insuranceType.trim(),
      preferredInsurerId: insurer?.id,
      preferredInsurerName: insurer?.name,
      estimatedValue: Number(estimatedValue) || 0,
      assignedTo: user.uid,
      assignedToName: profile.displayName,
      notes: notes.trim() || undefined,
    };
    try {
      setSaving(true);
      setError('');
      const id = await createLead(input, profile.organizationId, user.uid);
      reset();
      setShowForm(false);
      await load();
      navigate(`/leads/${id}`);
    } catch (err) {
      console.error(err);
      setError('تعذر إنشاء العميل المحتمل.');
    } finally {
      setSaving(false);
    }
  }

  const askCopilot = () => {
    navigate('/copilot', {
      state: {
        context: {
          page: 'leads',
          leads: leads.slice(0, 15).map((l) => ({
            name: l.name,
            companyName: l.companyName,
            stage: l.stage,
            insuranceType: l.insuranceType,
            estimatedValue: l.estimatedValue,
          })),
          stats: {
            totalLeads: leads.length,
            wonLeads: leads.filter((l) => l.stage === 'won').length,
            pipelineValue: leads
              .filter((l) => !['won', 'lost'].includes(l.stage))
              .reduce((s, l) => s + (Number(l.estimatedValue) || 0), 0),
          },
          notes: 'The broker is viewing the sales pipeline',
        },
      },
    });
  };

  // Charts
  const stageSegments = stageOptions
    .map((s) => ({
      label: LEAD_STAGE_LABELS[s],
      value: leads.filter((l) => l.stage === s).length,
      color:
        s === 'won'
          ? '#10b981'
          : s === 'lost'
          ? '#dc2626'
          : s === 'negotiation'
          ? '#f59e0b'
          : '#2563eb',
    }))
    .filter((s) => s.value > 0);

  const sourceBarData = sourceOptions
    .slice(0, 6)
    .map((s) => leads.filter((l) => l.source === s).length);
  const sourceBarLabels = sourceOptions
    .slice(0, 6)
    .map((s) => LEAD_SOURCE_LABELS[s]);

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
            <span className="eyebrow">Sales Pipeline</span>
            <h2
              style={{ margin: '2px 0 4px', fontSize: 20, color: 'var(--inx-text)' }}
            >
              العملاء المحتملون
            </h2>
            <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
              إدارة دورة المبيعات من الفرصة حتى الإصدار.
            </small>
          </div>

          <div className="inx-header-circular">
            <button
              type="button"
              className="inx-circle-btn"
              onClick={toggleTheme}
              title={resolvedTheme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
            >
              {resolvedTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              type="button"
              className="inx-circle-btn filled"
              onClick={askCopilot}
              title="مساعد InsurNex"
            >
              <Bot size={17} />
            </button>
            <button
              type="button"
              className="inx-circle-btn"
              onClick={() => setShowForm((v) => !v)}
              title="إضافة عميل محتمل"
            >
              <Plus size={18} />
            </button>
          </div>
        </header>

        {/* ============ KPI GRID ============ */}
        <div className="inx-kpi-grid" style={{ marginBottom: 16 }}>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-cyan">📊</span>
            </div>
            <div className="inx-kpi-value">{stats.total}</div>
            <small className="inx-kpi-label">إجمالي العملاء</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-warning">🎯</span>
            </div>
            <div className="inx-kpi-value">{stats.active}</div>
            <small className="inx-kpi-label">فرص نشطة</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-success">💰</span>
            </div>
            <div className="inx-kpi-value" style={{ fontSize: 16 }}>
              {money(stats.pipeline)} ج.م
            </div>
            <small className="inx-kpi-label">قيمة الفرص</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-purple">🏆</span>
            </div>
            <div className="inx-kpi-value">{stats.won}</div>
            <small className="inx-kpi-label">صفقات مغلقة</small>
          </article>
        </div>

        {error && (
          <div
            className="inx-card"
            role="alert"
            style={{ marginBottom: 16, borderColor: 'var(--inx-danger)' }}
          >
            <span className="inx-badge inx-badge-danger">{error}</span>
          </div>
        )}

        {/* ============ CHARTS ROW ============ */}
        {leads.length > 0 && (
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
                <span className="label">توزيع الفرص بمراحل البيع</span>
                <span className="value">{stats.total}</span>
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
                  segments={
                    stageSegments.length
                      ? stageSegments
                      : [{ label: 'لا يوجد', value: 1, color: '#e3ebf5' }]
                  }
                  size={110}
                  thickness={14}
                  centerValue={String(stats.won)}
                  centerLabel="صفقات"
                />
                <div className="inx-donut-legend" style={{ flex: 1, minWidth: 120 }}>
                  {stageSegments.map((s) => (
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
                <span className="label">مصادر العملاء</span>
                <span className="delta up">↑ مباشر</span>
              </div>
              <div style={{ color: 'var(--inx-blue)' }}>
                <MiniBarChart
                  data={sourceBarData}
                  labels={sourceBarLabels}
                  height={80}
                  color="var(--inx-blue)"
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 10,
                  color: 'var(--inx-muted)',
                }}
              >
                {sourceBarLabels.slice(0, 4).map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </div>
            </article>
          </div>
        )}

        {/* ============ FORM ============ */}
        {showForm && (
          <div className="inx-card inx-card-lg" style={{ marginBottom: 16 }}>
            <div className="inx-card-head">
              <h3>إضافة عميل محتمل</h3>
            </div>
            <form
              onSubmit={submit}
              style={{
                display: 'grid',
                gap: 12,
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              }}
            >
              {(
                [
                  ['الاسم *', name, setName, 'text', true],
                  ['الشركة', companyName, setCompanyName, 'text', false],
                  ['الهاتف *', phone, setPhone, 'text', true],
                  ['البريد الإلكتروني', email, setEmail, 'email', false],
                ] as const
              ).map(([label, value, setter, type, required]) => (
                <label key={label} style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--inx-muted)' }}>
                    {label}
                  </span>
                  <input
                    type={type}
                    value={value}
                    onChange={(e) => setter(e.target.value as never)}
                    required={required}
                    style={{
                      padding: '9px 12px',
                      border: '1px solid var(--inx-border)',
                      borderRadius: 'var(--inx-radius-sm)',
                      background: 'var(--inx-surface)',
                      color: 'var(--inx-text)',
                    }}
                  />
                </label>
              ))}

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--inx-muted)' }}>
                  المصدر
                </span>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as LeadSource)}
                  style={{
                    padding: '9px 12px',
                    border: '1px solid var(--inx-border)',
                    borderRadius: 'var(--inx-radius-sm)',
                    background: 'var(--inx-surface)',
                    color: 'var(--inx-text)',
                  }}
                >
                  {sourceOptions.map((x) => (
                    <option key={x} value={x}>
                      {LEAD_SOURCE_LABELS[x]}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--inx-muted)' }}>
                  الأولوية
                </span>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as LeadPriority)}
                  style={{
                    padding: '9px 12px',
                    border: '1px solid var(--inx-border)',
                    borderRadius: 'var(--inx-radius-sm)',
                    background: 'var(--inx-surface)',
                    color: 'var(--inx-text)',
                  }}
                >
                  {priorityOptions.map((x) => (
                    <option key={x} value={x}>
                      {LEAD_PRIORITY_LABELS[x]}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--inx-muted)' }}>
                  نوع التأمين *
                </span>
                <input
                  value={insuranceType}
                  onChange={(e) => setInsuranceType(e.target.value)}
                  required
                  style={{
                    padding: '9px 12px',
                    border: '1px solid var(--inx-border)',
                    borderRadius: 'var(--inx-radius-sm)',
                    background: 'var(--inx-surface)',
                    color: 'var(--inx-text)',
                  }}
                />
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--inx-muted)' }}>
                  شركة التأمين المفضلة
                </span>
                <select
                  value={preferredInsurerId}
                  onChange={(e) => setPreferredInsurerId(e.target.value)}
                  style={{
                    padding: '9px 12px',
                    border: '1px solid var(--inx-border)',
                    borderRadius: 'var(--inx-radius-sm)',
                    background: 'var(--inx-surface)',
                    color: 'var(--inx-text)',
                  }}
                >
                  <option value="">غير محددة</option>
                  {insurers.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--inx-muted)' }}>
                  القيمة المتوقعة
                </span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={estimatedValue}
                  onChange={(e) => setEstimatedValue(e.target.value)}
                  style={{
                    padding: '9px 12px',
                    border: '1px solid var(--inx-border)',
                    borderRadius: 'var(--inx-radius-sm)',
                    background: 'var(--inx-surface)',
                    color: 'var(--inx-text)',
                  }}
                />
              </label>

              <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
                <span style={{ fontSize: 12, color: 'var(--inx-muted)' }}>
                  ملاحظات
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  style={{
                    padding: '9px 12px',
                    border: '1px solid var(--inx-border)',
                    borderRadius: 'var(--inx-radius-sm)',
                    background: 'var(--inx-surface)',
                    color: 'var(--inx-text)',
                    resize: 'vertical',
                  }}
                />
              </label>

              <div
                style={{ display: 'flex', gap: 8, gridColumn: '1 / -1' }}
              >
                <button
                  type="submit"
                  className="inx-btn inx-btn-primary"
                  disabled={saving}
                >
                  {saving ? 'جاري الحفظ...' : 'حفظ العميل المحتمل'}
                </button>
                <button
                  type="button"
                  className="inx-btn inx-btn-secondary"
                  disabled={saving}
                  onClick={() => {
                    reset();
                    setShowForm(false);
                  }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ============ SEARCH + FILTERS ============ */}
        <div className="inx-card" style={{ marginBottom: 16, padding: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid var(--inx-border)',
              borderRadius: 'var(--inx-radius)',
              padding: '8px 12px',
              background: 'var(--inx-bg)',
              marginBottom: 12,
            }}
          >
            <Search size={18} style={{ color: 'var(--inx-muted)' }} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالاسم، الشركة، الهاتف، النوع"
              style={{
                flex: 1,
                border: 0,
                outline: 0,
                background: 'transparent',
                color: 'var(--inx-text)',
                fontSize: 13.5,
              }}
            />
          </div>
          <div className="inx-chips">
            <button
              type="button"
              className={`inx-chip ${stageFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStageFilter('all')}
            >
              كل المراحل
            </button>
            {stageOptions.map((x) => (
              <button
                key={x}
                type="button"
                className={`inx-chip ${stageFilter === x ? 'active' : ''}`}
                onClick={() => setStageFilter(x)}
              >
                {LEAD_STAGE_LABELS[x]}
              </button>
            ))}
          </div>
          <div className="inx-chips" style={{ marginTop: 8 }}>
            <button
              type="button"
              className={`inx-chip ${sourceFilter === 'all' ? 'active' : ''}`}
              onClick={() => setSourceFilter('all')}
            >
              كل المصادر
            </button>
            {sourceOptions.map((x) => (
              <button
                key={x}
                type="button"
                className={`inx-chip ${sourceFilter === x ? 'active' : ''}`}
                onClick={() => setSourceFilter(x)}
              >
                {LEAD_SOURCE_LABELS[x]}
              </button>
            ))}
          </div>
        </div>

        {/* ============ LIST ============ */}
        <div className="inx-section-head">
          <h2>قائمة العملاء المحتملين</h2>
          <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
            {filtered.length} عميل
          </small>
        </div>

        {loading ? (
          <div className="inx-empty">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="inx-empty">
            <Target size={28} />
            <b>لا توجد نتائج</b>
            <small>ابدأ بإضافة عميل محتمل جديد.</small>
          </div>
        ) : (
          <ul className="inx-list">
            {filtered.map((l) => (
              <li key={l.id}>
                <Link to={`/leads/${l.id}`} className="inx-list-item">
                  <span className="inx-icon-circle tone-primary">
                    <UserRound size={18} />
                  </span>
                  <div className="inx-list-copy">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 3,
                      }}
                    >
                      <b style={{ marginBottom: 0 }}>{l.name}</b>
                      <span
                        className={`inx-badge inx-badge-${STAGE_TONES[l.stage]}`}
                      >
                        {LEAD_STAGE_LABELS[l.stage]}
                      </span>
                    </div>
                    {l.companyName && (
                      <small
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          marginBottom: 4,
                        }}
                      >
                        <Building2 size={12} />
                        {l.companyName}
                      </small>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        fontSize: 11.5,
                        color: 'var(--inx-muted)',
                      }}
                    >
                      {l.phone && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Phone size={11} />
                          {l.phone}
                        </span>
                      )}
                      {l.email && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Mail size={11} />
                          {l.email}
                        </span>
                      )}
                      <span>{l.insuranceType}</span>
                      <span>{money(l.estimatedValue)} ج.م</span>
                    </div>
                  </div>
                  <ArrowLeft size={16} className="inx-list-chevron" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}