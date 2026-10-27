import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CalendarDays,
  CircleDollarSign,
  Moon,
  Plus,
  Search,
  ShieldCheck,
  Sun,
  UserRound,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import PolicyForm from '../features/policies/PolicyForm';
import {
  listPoliciesForOrganization,
  type RelatedPolicy,
} from '../features/relationships/relationship.service';
import { setCurrentContext } from '../features/copilot/copilot-context.store';
import { useTheme } from '../theme/ThemeProvider';
import MiniDonutChart from '../components/charts/MiniDonutChart';
import MiniBarChart from '../components/charts/MiniBarChart';

type Filter = 'all' | 'active' | 'pending' | 'expired' | 'cancelled';
const FILTERS: Filter[] = ['all', 'active', 'pending', 'expired', 'cancelled'];

const FILTER_LABELS: Record<Filter, string> = {
  all: 'الكل',
  active: 'سارية',
  pending: 'قيد الانتظار',
  expired: 'منتهية',
  cancelled: 'ملغاة',
};

const LINE_LABELS: Record<string, string> = {
  medical: 'طبي',
  motor: 'سيارات',
  property: 'ممتلكات',
  marine: 'بحري',
  life: 'حياة',
  liability: 'مسؤوليات',
  other: 'أخرى',
};

function formatMoney(value: number, currency: string) {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat('ar-EG', {
      style: 'currency',
      currency: currency || 'EGP',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(amount)} ${currency || 'EGP'}`;
  }
}

function statusLabel(status: string) {
  if (status === 'cancelled' || status === 'canceled') return 'ملغاة';
  return FILTER_LABELS[status as Filter] || status || 'غير محدد';
}

function statusTone(status: string) {
  if (status === 'active') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'expired') return 'danger';
  if (status === 'cancelled' || status === 'canceled') return 'neutral';
  return 'neutral';
}

function lineLabel(line: string) {
  return LINE_LABELS[line] || line || 'غير محدد';
}

function formatDate(value: string) {
  if (!value) return 'غير محدد';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export default function PoliciesPage() {
  const { profile } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [items, setItems] = useState<RelatedPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const loadPolicies = useCallback(async () => {
    if (!profile) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setItems(await listPoliciesForOrganization(profile.organizationId));
    } catch (err) {
      console.error('Failed to load policies', err);
      setError('تعذر تحميل الوثائق. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void loadPolicies();
  }, [loadPolicies]);

  // Copilot context
  useEffect(() => {
    if (!items.length) return;
    setCurrentContext({
      page: 'policies',
      policies: items.slice(0, 20).map((p) => ({
        policyNumber: p.policyNumber,
        clientName: p.clientName,
        insurerName: p.insurerName,
        line: p.line,
        expiryDate: p.expiryDate,
        premium: p.premium,
        currency: p.currency,
        status: p.status,
      })),
      notes: `The broker is viewing the policies list (${items.length} total)`,
    });
  }, [items]);

  const stats = useMemo(
    () => ({
      total: items.length,
      active: items.filter((i) => i.status === 'active').length,
      pending: items.filter((i) => i.status === 'pending').length,
      expired: items.filter((i) => i.status === 'expired').length,
      totalPremium: items.reduce((s, i) => s + Number(i.premium || 0), 0),
    }),
    [items],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      const ok =
        filter === 'all' ||
        i.status === filter ||
        (filter === 'cancelled' && i.status === 'canceled');
      if (!ok) return false;
      if (!q) return true;
      return [i.policyNumber, i.clientName, i.insurerName, lineLabel(i.line), i.line]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [items, search, filter]);

  const currency = items[0]?.currency || 'EGP';

  const askCopilot = () => {
    navigate('/copilot', {
      state: {
        context: {
          page: 'policies',
          policies: items.slice(0, 20).map((p) => ({
            policyNumber: p.policyNumber,
            clientName: p.clientName,
            insurerName: p.insurerName,
            line: p.line,
            expiryDate: p.expiryDate,
            premium: p.premium,
            currency: p.currency,
            status: p.status,
          })),
          notes: `The broker is viewing the policies list (${items.length} total)`,
        },
      },
    });
  };

  // Charts
  const statusSegments = [
    { label: 'سارية', value: stats.active, color: '#10b981' },
    { label: 'قيد الانتظار', value: stats.pending, color: '#f59e0b' },
    { label: 'منتهية', value: stats.expired, color: '#dc2626' },
  ].filter((s) => s.value > 0);

  const lineBarData = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((p) => {
      counts[p.line || 'other'] = (counts[p.line || 'other'] || 0) + 1;
    });
    return [
      counts.medical || 0,
      counts.motor || 0,
      counts.property || 0,
      counts.life || 0,
      counts.other || 0,
    ];
  }, [items]);

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
            <span className="eyebrow">Policy Management</span>
            <h2
              style={{ margin: '2px 0 4px', fontSize: 20, color: 'var(--inx-text)' }}
            >
              الوثائق
            </h2>
            <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
              إدارة محفظة الوثائق التأمينية وتتبع حالتها.
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
              onClick={() => setShowCreate(true)}
              title="إضافة وثيقة"
            >
              <Plus size={18} />
            </button>
          </div>
        </header>

        {/* ============ KPI GRID ============ */}
        <div className="inx-kpi-grid" style={{ marginBottom: 16 }}>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-cyan">📋</span>
            </div>
            <div className="inx-kpi-value">{stats.total}</div>
            <small className="inx-kpi-label">إجمالي الوثائق</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-success">✅</span>
            </div>
            <div className="inx-kpi-value">{stats.active}</div>
            <small className="inx-kpi-label">سارية</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-warning">⏳</span>
            </div>
            <div className="inx-kpi-value">{stats.pending}</div>
            <small className="inx-kpi-label">قيد الانتظار</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-danger">⚠️</span>
            </div>
            <div className="inx-kpi-value">{stats.expired}</div>
            <small className="inx-kpi-label">منتهية</small>
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
                <span className="label">حالة الوثائق</span>
                <span className="value">
                  {formatMoney(stats.totalPremium, currency)}
                </span>
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
                    statusSegments.length
                      ? statusSegments
                      : [{ label: 'لا يوجد', value: 1, color: '#e3ebf5' }]
                  }
                  size={110}
                  thickness={14}
                  centerValue={String(stats.total)}
                  centerLabel="وثيقة"
                />
                <div className="inx-donut-legend" style={{ flex: 1, minWidth: 120 }}>
                  {statusSegments.map((s) => (
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
                <span className="label">توزيع خطوط التأمين</span>
                <span className="delta up">↑ مباشر</span>
              </div>
              <div style={{ color: 'var(--inx-blue)' }}>
                <MiniBarChart
                  data={lineBarData}
                  labels={['طبي', 'سيارات', 'ممتلكات', 'حياة', 'أخرى']}
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
                <span>طبي</span>
                <span>سيارات</span>
                <span>ممتلكات</span>
                <span>حياة</span>
                <span>أخرى</span>
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
              placeholder="ابحث برقم الوثيقة، العميل، الشركة، نوع التغطية"
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
            {FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                className={`inx-chip ${filter === item ? 'active' : ''}`}
                onClick={() => setFilter(item)}
              >
                {FILTER_LABELS[item]}
              </button>
            ))}
          </div>
        </div>

        {/* ============ LIST ============ */}
        <div className="inx-section-head">
          <h2>قائمة الوثائق</h2>
          <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
            {visible.length} وثيقة
          </small>
        </div>

        {error && (
          <div className="inx-empty">
            <ShieldCheck size={28} />
            <b>{error}</b>
            <button
              type="button"
              className="inx-btn inx-btn-secondary"
              onClick={() => void loadPolicies()}
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        {!error && loading && (
          <div className="inx-empty">
            <ShieldCheck size={28} />
            <b>جاري تحميل الوثائق...</b>
          </div>
        )}

        {!error && !loading && visible.length === 0 && (
          <div className="inx-empty">
            <ShieldCheck size={28} />
            <b>
              {items.length === 0
                ? 'لا توجد وثائق مسجلة بعد'
                : 'لا توجد نتائج مطابقة'}
            </b>
            {items.length === 0 && (
              <button
                type="button"
                className="inx-btn inx-btn-primary"
                onClick={() => setShowCreate(true)}
                style={{ marginTop: 8 }}
              >
                <Plus size={16} /> إضافة وثيقة
              </button>
            )}
          </div>
        )}

        {!error && !loading && visible.length > 0 && (
          <ul className="inx-list">
            {visible.map((policy) => (
              <li key={policy.id}>
                {/* ✅ العنصر الآن قابل للنقر — ينقل إلى صفحة التفاصيل */}
                <Link
                  to={`/policies/${policy.id}`}
                  className="inx-list-item"
                  style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
                >
                  <span className="inx-icon-circle tone-cyan">
                    <ShieldCheck size={18} />
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
                        {policy.policyNumber || 'وثيقة'}
                      </b>
                      <span
                        className={`inx-badge inx-badge-${statusTone(policy.status)}`}
                      >
                        {statusLabel(policy.status)}
                      </span>
                    </div>
                    <small style={{ marginBottom: 4 }}>
                      {policy.clientName || 'عميل غير محدد'} ·{' '}
                      {policy.insurerName || 'شركة غير محددة'} ·{' '}
                      {lineLabel(policy.line)}
                    </small>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        fontSize: 11.5,
                        color: 'var(--inx-muted)',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <UserRound size={12} />
                        {policy.clientName || 'غير محدد'}
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <CalendarDays size={12} />
                        {formatDate(policy.expiryDate)}
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <CircleDollarSign size={12} />
                        {formatMoney(policy.premium, policy.currency)}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showCreate && (
        <PolicyForm
          onCancel={() => setShowCreate(false)}
          onDone={() => {
            setShowCreate(false);
            void loadPolicies();
          }}
        />
      )}
    </main>
  );
}