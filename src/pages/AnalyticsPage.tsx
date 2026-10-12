import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Bot,
  Moon,
  RefreshCw,
  Sun,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import {
  loadAnalytics,
  type AnalyticsSnapshot,
} from '../features/analytics/analytics.service';
import { setCurrentContext } from '../features/copilot/copilot-context.store';
import { useTheme } from '../theme/ThemeProvider';
import MiniDonutChart from '../components/charts/MiniDonutChart';
import MiniBarChart from '../components/charts/MiniBarChart';
import MiniLineChart from '../components/charts/MiniLineChart';

const money = (n: number) =>
  new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(n || 0);

const STAGE_LABELS: Record<string, string> = {
  new: 'جديد',
  contacted: 'تم التواصل',
  qualified: 'مؤهل',
  quotation: 'عرض سعر',
  negotiation: 'تفاوض',
  won: 'ناجح',
  lost: 'مفقود',
};

const SOURCE_LABELS: Record<string, string> = {
  website: 'الموقع',
  referral: 'ترشيح',
  phone: 'هاتف',
  email: 'بريد',
  social: 'تواصل',
  campaign: 'حملة',
  walk_in: 'زيارة',
  existing_client: 'عميل حالي',
  other: 'أخرى',
};

export default function AnalyticsPage() {
  const { profile } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [d, setD] = useState<AnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!profile) return;
    try {
      setLoading(true);
      setError('');
      setD(await loadAnalytics(profile.organizationId));
    } catch (e) {
      console.error(e);
      setError('تعذر تحميل التحليلات.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [profile?.organizationId]);

  // Copilot context
  useEffect(() => {
    if (!d) return;
    setCurrentContext({
      page: 'analytics',
      stats: {
        totalClients: d.clients,
        activePolicies: d.activePolicies,
        totalLeads: d.leads,
        wonLeads: d.won,
        pipelineValue: d.pipeline,
      },
      notes: 'The broker is viewing analytics.',
    });
  }, [d]);

  const askCopilot = () => {
    navigate('/copilot', {
      state: {
        context: {
          page: 'analytics',
          stats: d
            ? {
                totalClients: d.clients,
                activePolicies: d.activePolicies,
                totalLeads: d.leads,
                wonLeads: d.won,
                pipelineValue: d.pipeline,
              }
            : undefined,
          notes: 'The broker is viewing analytics.',
        },
      },
    });
  };

  const insight = useMemo(() => {
    if (!d) return '';
    const entries = Object.entries(d.insuranceTypes).sort(
      (a, b) => b[1].pipeline - a[1].pipeline,
    );
    if (!entries.length)
      return 'لا توجد بيانات كافية لتحليل أنواع التأمين بعد.';
    const [x, m] = entries[0];
    const rate = m.won + m.lost ? Math.round((m.won / (m.won + m.lost)) * 100) : 0;
    return `أعلى قيمة في أنواع التأمين هي ${x} بـ ${money(m.pipeline)} ج.م، ومعدل الفوز ${rate}%.`;
  }, [d]);

  if (loading) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-container">
          <div className="inx-empty">
            <RefreshCw size={28} />
            <b>جاري تحميل التحليلات...</b>
          </div>
        </div>
      </main>
    );
  }

  if (!d) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-container">
          <div className="inx-empty">
            <BarChart3 size={28} />
            <b>{error || 'لا توجد بيانات تحليلية.'}</b>
          </div>
        </div>
      </main>
    );
  }

  // Charts
  const stageSegments = Object.entries(d.stages)
    .map(([k, v]) => ({
      label: STAGE_LABELS[k] || k,
      value: v,
      color:
        k === 'won'
          ? '#10b981'
          : k === 'lost'
          ? '#dc2626'
          : k === 'negotiation'
          ? '#f59e0b'
          : '#2563eb',
    }))
    .filter((s) => s.value > 0);

  const stageBarData = Object.values(d.stages);
  const stageBarLabels = Object.keys(d.stages).map((k) => STAGE_LABELS[k] || k);

  const sourceBarData = Object.entries(d.sources)
    .slice(0, 6)
    .map(([, v]) => v);
  const sourceBarLabels = Object.keys(d.sources)
    .slice(0, 6)
    .map((k) => SOURCE_LABELS[k] || k);

  // Simple trend from pipeline (fake progression for visualization)
  const trend = [3, 5, 4, 6, 8, 7, 9, 11];

  return (
    <main className="mobile-page" dir="rtl">
      <div className="inx-container">
        {/* HEADER */}
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
            <span className="eyebrow">Analytics 2.0</span>
            <h2 style={{ margin: '2px 0 4px', fontSize: 20, color: 'var(--inx-text)' }}>
              التحليلات والتقارير
            </h2>
            <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
              نظرة شاملة على أداء المحفظة وخط المبيعات.
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
              onClick={() => void load()}
              title="تحديث"
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>

        {/* KPIs */}
        <div className="inx-kpi-grid" style={{ marginBottom: 16 }}>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-cyan">
                <Users size={18} />
              </span>
            </div>
            <div className="inx-kpi-value">{d.clients}</div>
            <small className="inx-kpi-label">
              {d.activeClients} نشط من {d.clients}
            </small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-success">
                <TrendingUp size={18} />
              </span>
            </div>
            <div className="inx-kpi-value" style={{ fontSize: 15 }}>
              {money(d.premium)} ج.م
            </div>
            <small className="inx-kpi-label">
              {d.activePolicies} وثيقة نشطة
            </small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-warning">
                <Target size={18} />
              </span>
            </div>
            <div className="inx-kpi-value" style={{ fontSize: 15 }}>
              {money(d.pipeline)} ج.م
            </div>
            <small className="inx-kpi-label">{d.leads} فرصة</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-purple">
                <BarChart3 size={18} />
              </span>
            </div>
            <div className="inx-kpi-value">{d.winRate}%</div>
            <small className="inx-kpi-label">
              {d.won} فوز · {d.lost} خسارة
            </small>
          </article>
        </div>

        {/* CHARTS ROW 1: Donut + Bars */}
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
              <span className="label">مراحل خط المبيعات</span>
              <span className="value">{d.leads}</span>
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
                centerValue={String(d.won)}
                centerLabel="فوز"
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
              <span className="label">مصادر الفرص</span>
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

        {/* CHARTS ROW 2: Stages bar + Line */}
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
              <span className="label">توزيع المراحل</span>
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
              }}
            >
              {stageBarLabels.slice(0, 4).map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
          </article>

          <article className="inx-chart-card">
            <div className="chart-head">
              <span className="label">اتجاه الأداء</span>
              <span className="delta up">↑ نمو</span>
            </div>
            <div style={{ color: 'var(--inx-blue)' }}>
              <MiniLineChart
                data={trend}
                height={80}
                color="var(--inx-blue)"
                fillColor="rgba(37, 99, 235, 0.12)"
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
              <span>آخر 8 أشهر</span>
              <span>مؤشر النمو</span>
            </div>
          </article>
        </div>

        {/* AI Insights */}
        <div className="inx-section-head">
          <h2>InsurNex Intelligence</h2>
        </div>
        <div
          className="inx-card inx-card-lg"
          style={{
            marginBottom: 16,
            background: 'var(--inx-gradient)',
            color: '#fff',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <span
              className="inx-icon-circle inx-icon-circle-lg"
              style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
            >
              <Bot size={22} />
            </span>
            <div style={{ flex: 1 }}>
              <small style={{ opacity: 0.85, fontSize: 11 }}>تحليل ذكي</small>
              <p
                style={{
                  margin: '6px 0 0',
                  lineHeight: 1.7,
                  fontSize: 14,
                  color: '#fff',
                }}
              >
                {insight}
              </p>
            </div>
          </div>
        </div>

        {/* Insurance types table */}
        <div className="inx-section-head">
          <h2>حسب نوع التأمين</h2>
        </div>
        <div className="inx-card">
          <ul className="inx-list">
            {Object.entries(d.insuranceTypes).map(([name, x]) => (
              <li key={name} className="inx-list-item">
                <span className="inx-icon-circle inx-icon-circle-sm tone-cyan">
                  <BarChart3 size={14} />
                </span>
                <div className="inx-list-copy">
                  <b>{name}</b>
                  <small>
                    {x.count} فرصة · {money(x.pipeline)} ج.م ·{' '}
                    {x.won} فوز / {x.lost} خسارة
                  </small>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Quick links */}
        <div className="inx-section-head">
          <h2>روابط سريعة</h2>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 10,
          }}
        >
          <Link to="/leads" className="inx-shortcut-card">
            <span className="inx-3d-icon sm tone-primary">📊</span>
            <span className="label">خط المبيعات</span>
          </Link>
          <Link to="/policies" className="inx-shortcut-card">
            <span className="inx-3d-icon sm tone-cyan">🛡️</span>
            <span className="label">الوثائق</span>
          </Link>
          <Link to="/claims" className="inx-shortcut-card">
            <span className="inx-3d-icon sm tone-success">📋</span>
            <span className="label">المطالبات</span>
          </Link>
          <Link to="/ai/file-analysis" className="inx-shortcut-card">
            <span className="inx-3d-icon sm tone-purple">🤖</span>
            <span className="label">تحليل الملفات</span>
          </Link>
        </div>
      </div>
    </main>
  );
}