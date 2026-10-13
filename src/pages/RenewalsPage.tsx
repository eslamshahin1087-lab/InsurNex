import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  CircleAlert,
  Clock3,
  FileText,
  ListTodo,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  UserRound,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import {
  listRenewals2,
  type Renewal2Item,
  type RenewalStage,
} from '../features/renewals/renewal2.service';
import { setCurrentContext } from '../features/copilot/copilot-context.store';
import { useTheme } from '../theme/ThemeProvider';
import MiniDonutChart from '../components/charts/MiniDonutChart';
import MiniBarChart from '../components/charts/MiniBarChart';

const STAGES: RenewalStage[] = ['overdue', 'urgent', 'due30', 'due60', 'due90', 'later'];

const STAGE_LABELS: Record<RenewalStage, string> = {
  overdue: 'متأخرة',
  urgent: 'خلال 7 أيام',
  due30: 'خلال 30 يوم',
  due60: 'خلال 60 يوم',
  due90: 'خلال 90 يوم',
  later: 'لاحقًا',
};

const LINE_LABELS: Record<string, string> = {
  medical: 'طبي',
  motor: 'سيارات',
  property: 'ممتلكات',
  marine: 'بحري',
  life: 'حياة',
  liability: 'مسؤولية',
  other: 'أخرى',
};

function lineLabel(v: string) {
  return LINE_LABELS[v] || v || 'نوع غير محدد';
}

function formatDate(value: string) {
  if (!value) return 'غير محدد';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('ar-EG', {
      style: 'currency',
      currency: currency || 'EGP',
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  } catch {
    return `${new Intl.NumberFormat('ar-EG').format(Number(value || 0))} ${currency || 'EGP'}`;
  }
}

function daysLabel(days: number) {
  if (days === Number.MAX_SAFE_INTEGER) return 'تاريخ غير محدد';
  if (days < 0) return `متأخرة ${Math.abs(days)} يوم`;
  if (days === 0) return 'تستحق اليوم';
  if (days === 1) return 'باقي يوم واحد';
  return `باقي ${days} يوم`;
}

function stageTone(stage: RenewalStage) {
  if (stage === 'overdue') return 'danger';
  if (stage === 'urgent') return 'danger';
  if (stage === 'due30') return 'warning';
  if (stage === 'due60' || stage === 'due90') return 'primary';
  return 'neutral';
}

function stageIcon(stage: RenewalStage) {
  if (stage === 'overdue') return <CircleAlert size={18} />;
  if (stage === 'urgent') return <AlertTriangle size={18} />;
  if (stage === 'due30') return <Clock3 size={18} />;
  return <CalendarDays size={18} />;
}

export default function RenewalsPage() {
  const { profile } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [items, setItems] = useState<Renewal2Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<RenewalStage | 'all'>('all');

  const load = useCallback(async () => {
    if (!profile) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setItems(await listRenewals2(profile.organizationId));
    } catch (err) {
      console.error('Failed to load renewals', err);
      setError('تعذر تحميل التجديدات. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  // Copilot context
  useEffect(() => {
    if (!items.length) return;
    setCurrentContext({
      page: 'renewals',
      renewals: items.slice(0, 15).map((r) => ({
        policyNumber: r.policyNumber,
        clientName: r.clientName,
        insurerName: r.insurerName,
        line: r.line,
        expiryDate: r.expiryDate,
        premium: r.premium,
        daysLeft: r.daysLeft,
        currency: r.currency,
      })),
      notes: `The broker is viewing the renewals list (${items.length} total)`,
    });
  }, [items]);

  const counts = useMemo(() => {
    const next = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<
      RenewalStage,
      number
    >;
    items.forEach((i) => {
      next[i.stage] += 1;
    });
    return next;
  }, [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (stage !== 'all' && i.stage !== stage) return false;
      if (!q) return true;
      return [i.policyNumber, i.clientName, i.insurerName, i.line, lineLabel(i.line)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [items, search, stage]);

  const summary = useMemo(() => {
    const due90 = items.filter((i) => i.daysLeft >= 0 && i.daysLeft <= 90);
    const urgent = items.filter((i) => i.daysLeft >= 0 && i.daysLeft <= 7);
    const overdue = items.filter((i) => i.daysLeft < 0);
    const premiumAtRisk = [...overdue, ...due90].reduce(
      (s, i) => s + Number(i.premium || 0),
      0,
    );
    return {
      due90: due90.length,
      urgent: urgent.length,
      overdue: overdue.length,
      premiumAtRisk,
    };
  }, [items]);

  const currency = items[0]?.currency || 'EGP';

  const askCopilot = () => {
    navigate('/copilot', {
      state: {
        context: {
          page: 'renewals',
          renewals: items.slice(0, 15).map((r) => ({
            policyNumber: r.policyNumber,
            clientName: r.clientName,
            insurerName: r.insurerName,
            line: r.line,
            expiryDate: r.expiryDate,
            premium: r.premium,
            daysLeft: r.daysLeft,
            currency: r.currency,
          })),
          notes: `The broker is viewing the renewals list (${items.length} total)`,
        },
      },
    });
  };

  // Charts
  const stageSegments = STAGES.map((s) => {
    const colors: Record<RenewalStage, string> = {
      overdue: '#dc2626',
      urgent: '#ef4444',
      due30: '#f59e0b',
      due60: '#1E4272',
      due90: '#22b8e8',
      later: '#94a3b8',
    };
    return {
      label: STAGE_LABELS[s],
      value: counts[s],
      color: colors[s],
    };
  }).filter((s) => s.value > 0);

  const stageBarData = STAGES.map((s) => counts[s]);
  const stageBarLabels = STAGES.map((s) => STAGE_LABELS[s]);

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
            <span className="eyebrow">Renewal Operations</span>
            <h2
              style={{ margin: '2px 0 4px', fontSize: 20, color: 'var(--inx-text)' }}
            >
              التجديدات
            </h2>
            <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
              إدارة التجديدات القادمة وتنبيهات الاستحقاق.
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
            <Link to="/policies" className="inx-circle-btn" title="الوثائق">
              <ShieldCheck size={17} />
            </Link>
          </div>
        </header>

        {/* ============ KPI GRID ============ */}
        <div className="inx-kpi-grid" style={{ marginBottom: 16 }}>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-danger">🚨</span>
            </div>
            <div className="inx-kpi-value">{summary.overdue}</div>
            <small className="inx-kpi-label">متأخرة</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-warning">⏰</span>
            </div>
            <div className="inx-kpi-value">{summary.urgent}</div>
            <small className="inx-kpi-label">خلال 7 أيام</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-cyan">📅</span>
            </div>
            <div className="inx-kpi-value">{summary.due90}</div>
            <small className="inx-kpi-label">خلال 90 يوم</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-success">💰</span>
            </div>
            <div className="inx-kpi-value" style={{ fontSize: 15 }}>
              {formatMoney(summary.premiumAtRisk, currency)}
            </div>
            <small className="inx-kpi-label">أقساط معرضة للفقد</small>
          </article>
        </div>

        {/* ============ CHARTS ROW ============ */}
        {items.length > 0 && (
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
                <span className="label">توزيع التجديدات</span>
                <span className="value">{items.length}</span>
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
                  centerValue={String(items.length)}
                  centerLabel="وثيقة"
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
                <span className="label">مراحل التجديد</span>
                <span className="delta up">↑ مباشر</span>
              </div>
              <div style={{ color: 'var(--inx-blue)' }}>
                <MiniBarChart
                  data={stageBarData}
                  labels={stageBarLabels}
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
                  gap: 4,
                }}
              >
                <span>متأخرة</span>
                <span>7 أيام</span>
                <span>30</span>
                <span>60</span>
                <span>90</span>
                <span>لاحقًا</span>
              </div>
            </article>
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
              placeholder="ابحث برقم الوثيقة، العميل، الشركة"
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
              className={`inx-chip ${stage === 'all' ? 'active' : ''}`}
              onClick={() => setStage('all')}
            >
              الكل ({items.length})
            </button>
            {STAGES.map((s) => (
              <button
                key={s}
                type="button"
                className={`inx-chip ${stage === s ? 'active' : ''}`}
                onClick={() => setStage(s)}
              >
                {STAGE_LABELS[s]} ({counts[s]})
              </button>
            ))}
          </div>
        </div>

        {/* ============ LIST ============ */}
        <div className="inx-section-head">
          <h2>قائمة التجديدات</h2>
          <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
            {visible.length} وثيقة
          </small>
        </div>

        {error && (
          <div className="inx-empty">
            <AlertTriangle size={28} />
            <b>{error}</b>
            <button
              type="button"
              className="inx-btn inx-btn-secondary"
              onClick={() => void load()}
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        {!error && loading && (
          <div className="inx-empty">
            <CalendarClock size={28} />
            <b>جاري تحميل التجديدات...</b>
          </div>
        )}

        {!error && !loading && visible.length === 0 && (
          <div className="inx-empty">
            <CalendarDays size={28} />
            <b>
              {items.length === 0
                ? 'لا توجد وثائق قابلة للتجديد'
                : 'لا توجد نتائج مطابقة'}
            </b>
          </div>
        )}

        {!error && !loading && visible.length > 0 && (
          <ul className="inx-list">
            {visible.map((item) => (
              <li key={item.id}>
                <div
                  className="inx-list-item"
                  style={{
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`inx-icon-circle tone-${stageTone(item.stage)}`}>
                      {stageIcon(item.stage)}
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
                        <b style={{ marginBottom: 0 }}>
                          {item.policyNumber || 'وثيقة'}
                        </b>
                        <span
                          className={`inx-badge inx-badge-${stageTone(item.stage)}`}
                        >
                          {STAGE_LABELS[item.stage]}
                        </span>
                      </div>
                      <small
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <UserRound size={12} />
                        {item.clientName || 'عميل غير محدد'}
                      </small>
                    </div>
                    <b style={{ color: 'var(--inx-danger)', fontSize: 13 }}>
                      {daysLabel(item.daysLeft)}
                    </b>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 8,
                      fontSize: 11.5,
                      color: 'var(--inx-muted)',
                    }}
                  >
                    <span>{item.insurerName || 'شركة غير محددة'}</span>
                    <span>·</span>
                    <span>{lineLabel(item.line)}</span>
                    <span>·</span>
                    <span>ينتهي: {formatDate(item.expiryDate)}</span>
                    <span>·</span>
                    <span>{formatMoney(item.premium, item.currency)}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 6,
                      flexWrap: 'wrap',
                      marginTop: 4,
                    }}
                  >
                    {item.clientId && (
                      <Link
                        to={`/clients/${item.clientId}`}
                        className="inx-btn inx-btn-secondary inx-btn-sm"
                      >
                        <UserRound size={13} /> Client 360 <ChevronLeft size={13} />
                      </Link>
                    )}
                    <Link
                      to="/policies"
                      className="inx-btn inx-btn-secondary inx-btn-sm"
                    >
                      <FileText size={13} /> الوثيقة
                    </Link>
                    <Link
                      to="/tasks"
                      className="inx-btn inx-btn-ghost inx-btn-sm"
                    >
                      <ListTodo size={13} /> مهمة
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}