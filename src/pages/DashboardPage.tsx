import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileText,
  ListTodo,
  MoreHorizontal,
  RefreshCcw,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import {
  loadDashboard,
  type DashboardData,
} from '../features/dashboard/dashboard.service';
import { setCurrentContext } from '../features/copilot/copilot-context.store';
import MiniDonutChart from '../components/charts/MiniDonutChart';
import MiniLineChart from '../components/charts/MiniLineChart';
import OnboardingChecklist from '../features/onboarding/OnboardingChecklist';
import AdsSlideshow from '../features/admin/AdsSlideshow';
import { usePlatformSettings } from '../features/admin/PlatformSettingsProvider';
import type { PlatformFeatureKey } from '../features/admin/platform-settings.service';
import { usePlanFeatures } from '../features/subscription/PlanFeaturesProvider';

const empty: DashboardData = {
  clients: 0,
  activePolicies: 0,
  openClaims: 0,
  renewals: [],
  tasks: [],
  notificationCount: 0,
};

const priorityLabels: Record<string, string> = {
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'عالية',
  urgent: 'عاجلة',
};

const priorityTone: Record<string, string> = {
  low: 'tone-success',
  medium: 'tone-primary',
  high: 'tone-warning',
  urgent: 'tone-danger',
};

const shortcuts: { to: string; label: string; Icon: LucideIcon; tone: string; feature: PlatformFeatureKey | null }[] = [
  { to: '/clients', label: 'العملاء', Icon: Users, tone: '', feature: 'clients' },
  { to: '/policies', label: 'الوثائق', Icon: FileText, tone: 'tone-cyan', feature: 'policies' },
  { to: '/claims', label: 'المطالبات', Icon: AlertTriangle, tone: 'tone-warning', feature: 'claims' },
  { to: '/renewals', label: 'التجديدات', Icon: RefreshCcw, tone: 'tone-primary', feature: 'renewals' },
  { to: '/tasks', label: 'المهام', Icon: CheckCircle2, tone: 'tone-success', feature: 'tasks' },
  { to: '/insurers', label: 'الشركات', Icon: Building2, tone: 'tone-cyan', feature: 'insurers' },
  { to: '/finance', label: 'المالية', Icon: Wallet, tone: 'tone-success', feature: 'finance' },
  { to: '/more', label: 'المزيد', Icon: MoreHorizontal, tone: 'tone-purple', feature: null },
];

export default function DashboardPage() {
  const { profile } = useAuth();
  const { settings } = usePlatformSettings();
  const { features: planFeatures } = usePlanFeatures();
  const visibleShortcuts = shortcuts.filter((item) => !item.feature || (settings.features[item.feature] && planFeatures[item.feature]));
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    loadDashboard(profile.organizationId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [profile]);

  // Copilot context
  useEffect(() => {
    if (!profile) return;
    setCurrentContext({
      page: 'dashboard',
      stats: {
        totalClients: data.clients,
        activePolicies: data.activePolicies,
        openClaims: data.openClaims,
        upcomingRenewals: data.renewals.length,
      },
      tasks: data.tasks.slice(0, 15).map((t) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
      })),
      renewals: data.renewals.slice(0, 15).map((r) => ({
        policyNumber: r.policyNumber,
        clientName: r.clientName,
        insurerName: r.insurerName,
        line: r.line || '',
        expiryDate: r.expiryDate,
        premium: r.premium || 0,
        daysLeft: r.daysLeft,
        currency: r.currency || 'EGP',
      })),
      notes: 'The broker is on the main dashboard.',
    });
  }, [data, profile]);

  const clientsPct = Math.min(
    100,
    Math.max(15, (data.clients / Math.max(data.clients, 10)) * 100),
  );
  const policiesPct = Math.min(
    100,
    Math.max(15, (data.activePolicies / Math.max(data.activePolicies, 10)) * 100),
  );

  const nearestRenewalDays =
    data.renewals.length > 0
      ? Math.min(...data.renewals.map((r) => r.daysLeft))
      : null;

  const clientSegments = [
    { label: 'عملاء نشطون', value: data.clients > 0 ? Math.max(data.clients - 1, 0) : 0, color: '#10b981' },
    { label: 'عملاء جدد', value: data.clients > 0 ? 1 : 0, color: '#1E4272' },
  ];

  const renewalTrend =
    data.renewals.length > 0
      ? data.renewals.slice(0, 8).map((r) => Math.max(r.daysLeft, 0))
      : [4, 6, 5, 8, 7, 9, 11, 10];



  return (
    <main className="mobile-page" dir="rtl">
      <div className="inx-container">
        {/* PAGE HEADING — global account actions live in the application header. */}
        <header className="inx-dashboard-heading">
          <div>
            <span className="eyebrow">InsurNex Workspace</span>
            <h1>لوحة التحكم</h1>
            <p>نظرة موحدة على العملاء والوثائق والعمليات اليومية.</p>
          </div>
        </header>

        {/* Ads are enabled and placed from the admin control center. */}
        {settings.advertising.enabled && settings.advertising.dashboard && (
          <div style={{ marginBottom: 14 }}><AdsSlideshow /></div>
        )}

        {/* SCOPE ROW */}
        <div className="inx-scope-row" style={{ marginBottom: 14 }}>
          {(settings.features.notifications && planFeatures.notifications) && (
            <span className="inx-chip-emphasis">
              <Bell size={13} />
              {data.notificationCount > 0
                ? `${data.notificationCount} إشعارات`
                : 'لا إشعارات'}
            </span>
          )}
          {(settings.features.tasks && planFeatures.tasks) && <Link to="/tasks" className="inx-scope-pill"><ListTodo size={14} />{data.tasks.length} مهام</Link>}
        </div>

        {/* ONBOARDING CHECKLIST */}
        {((settings.features.clients && planFeatures.clients) || (settings.features.policies && planFeatures.policies)) && (
          <OnboardingChecklist
            clientsCount={(settings.features.clients && planFeatures.clients) ? data.clients : 0}
            policiesCount={(settings.features.policies && planFeatures.policies) ? data.activePolicies : 0}
          />
        )}

        {/* SHORTCUTS */}
        <div className="inx-shortcut-row inx-shortcut-carousel" style={{ marginBottom: 22 }}>
          <div className="inx-shortcut-track">
            <div className="inx-shortcut-sequence">
              {visibleShortcuts.map(({ to, label, Icon, tone }) => (
                <Link key={to} to={to} className="inx-shortcut-card">
                  <span className={`inx-3d-icon ${tone}`}>
                    <Icon size={19} strokeWidth={1.85} aria-hidden="true" />
                  </span>
                  <span className="label">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* HERO PANEL */}
        <section className="inx-hero-panel" style={{ marginBottom: 18 }}>
          <div className="hero-head">
            <div className="title-group">
              <span className="dot" />
              <span>لوحة الأداء</span>
            </div>
            <div className="actions">
              {(settings.features.policies && planFeatures.policies) && <Link to="/policies">الوثائق</Link>}
            </div>
          </div>

          <div className="hero-body" style={{ gridTemplateColumns: (settings.features.clients && planFeatures.clients) && (settings.features.policies && planFeatures.policies) ? "repeat(2, minmax(0, 1fr))" : "1fr" }}>
            {(settings.features.clients && planFeatures.clients) && (
              <div className="hero-column" style={{ textAlign: 'right' }}>
                <div className="metric">
                  {data.clients}
                  <small>عميل</small>
                </div>
                <div className="metric-label">إجمالي العملاء</div>
                <div className="hero-bar">
                  <span style={{ width: `${clientsPct}%` }} />
                </div>
                <div className="metric-delta">
                  {Math.round(clientsPct)}% من الهدف
                </div>
              </div>
            )}

            {(settings.features.policies && planFeatures.policies) && (
              <div className="hero-column" style={{ textAlign: 'right' }}>
                <div className="metric">
                  {data.activePolicies}
                  <small>وثيقة</small>
                </div>
                <div className="metric-label">وثائق نشطة</div>
                <div className="hero-bar">
                  <span style={{ width: `${policiesPct}%` }} />
                </div>
                <div className="metric-delta">
                  {Math.round(policiesPct)}% من الهدف
                </div>
              </div>
            )}
          </div>

          <div className="hero-foot">
            <span className="info">
              <CheckCircle2 size={13} />
              آخر تحديث: {loading ? 'جاري...' : 'الآن'}
            </span>
            {(settings.features.renewals && planFeatures.renewals) && (
              <span className="info">
                <CalendarDays size={13} />
                {nearestRenewalDays === null
                  ? 'لا تجديدات قريبة'
                  : nearestRenewalDays < 0
                  ? 'يوجد تجديد متأخر'
                  : `أقرب تجديد: ${nearestRenewalDays} يوم`}
              </span>
            )}
          </div>

          <div className="hero-foot" style={{ borderTop: 'none', paddingTop: 0 }}>
            {(settings.features.claims && planFeatures.claims) && (
              <span className="info">
                <TrendingUp size={13} />
                {data.openClaims} مطالبات مفتوحة
              </span>
            )}
            {(settings.features.finance && planFeatures.finance) && <Link to="/finance" className="hero-cta"><Wallet size={14} />المالية<span>←</span></Link>}
          </div>
        </section>

        {/* CHARTS ROW */}
        {((settings.features.clients && planFeatures.clients) || (settings.features.renewals && planFeatures.renewals)) && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 12,
              marginBottom: 18,
            }}
          >
            {(settings.features.clients && planFeatures.clients) && (
              <article className="inx-chart-card">
                <div className="chart-head">
                  <span className="label">توزيع العملاء</span>
                  <span className="value">{data.clients}</span>
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
                    segments={clientSegments}
                    size={110}
                    thickness={14}
                    centerValue={String(data.clients)}
                    centerLabel="إجمالي"
                  />
                  <div className="inx-donut-legend" style={{ flex: 1, minWidth: 120 }}>
                    {clientSegments.map((s) => (
                      <div className="legend-row" key={s.label}>
                        <span className="dot" style={{ background: s.color }} />
                        <span className="legend-label">{s.label}</span>
                        <span className="legend-value">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </article>
            )}

            {(settings.features.renewals && planFeatures.renewals) && (
              <article className="inx-chart-card">
                <div className="chart-head">
                  <span className="label">اتجاه التجديدات</span>
                  <span className="delta up">↗ صاعد</span>
                </div>
                <div style={{ color: 'var(--inx-blue)' }}>
                  <MiniLineChart
                    data={renewalTrend}
                    height={80}
                    color="var(--inx-blue)"
                    fillColor="rgba(30, 66, 114, 0.12)"
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
                  <span>آخر 8 وثائق</span>
                  <span>{data.renewals.length} عميل</span>
                </div>
              </article>
            )}
          </div>
        )}

        {(settings.features.tasks && planFeatures.tasks) && (
          <>
        {/* TASKS SECTION */}
        <div className="inx-section-head">
          <h2>المهام القادمة</h2>
          <Link to="/tasks" className="inx-section-link">
            عرض الكل ←
          </Link>
        </div>

        {loading ? (
          <div className="inx-empty">جاري التحميل...</div>
        ) : data.tasks.length === 0 ? (
          <div className="inx-empty">
            <ListTodo size={28} />
            <b>لا توجد مهام قادمة</b>
          </div>
        ) : (
          <ul className="inx-list" style={{ marginBottom: 18 }}>
            {data.tasks.slice(0, 5).map((t) => (
              <li key={t.id}>
                <Link to="/tasks" className="inx-list-item">
                  <span
                    className={`inx-icon-circle ${
                      priorityTone[t.priority] || 'tone-primary'
                    }`}
                  >
                    <ListTodo size={16} />
                  </span>
                  <div className="inx-list-copy">
                    <b>{t.title}</b>
                    <small>
                      {t.dueDate || 'بدون تاريخ'} ·{' '}
                      {priorityLabels[t.priority] || t.priority}
                    </small>
                  </div>
                  <span style={{ color: 'var(--inx-muted)', fontSize: 16 }}>←</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
          </>
        )}

        {(settings.features.renewals && planFeatures.renewals) && (
          <>
        {/* RENEWALS SECTION */}
        <div className="inx-section-head">
          <h2>أقرب التجديدات</h2>
          <Link to="/renewals" className="inx-section-link">
            عرض الكل ←
          </Link>
        </div>

        {loading ? (
          <div className="inx-empty">جاري التحميل...</div>
        ) : data.renewals.length === 0 ? (
          <div className="inx-empty">
            <RefreshCcw size={28} />
            <b>لا توجد تجديدات قريبة</b>
          </div>
        ) : (
          <ul className="inx-list" style={{ marginBottom: 18 }}>
            {data.renewals.slice(0, 5).map((r) => (
              <li key={r.id}>
                <Link to="/renewals" className="inx-list-item">
                  <span
                    className={`inx-icon-circle ${
                      r.daysLeft <= 7 ? 'tone-danger' : 'tone-warning'
                    }`}
                  >
                    <RefreshCcw size={16} />
                  </span>
                  <div className="inx-list-copy">
                    <b>{r.clientName}</b>
                    <small>
                      {r.policyNumber} ·{' '}
                      {r.daysLeft < 0
                        ? 'منتهية'
                        : `متبقي ${r.daysLeft} يوم`}
                    </small>
                  </div>
                  <span style={{ color: 'var(--inx-muted)', fontSize: 16 }}>←</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
          </>
        )}

        {((settings.features.clients && planFeatures.clients) || (settings.features.policies && planFeatures.policies) || (settings.features.claims && planFeatures.claims) || (settings.features.tasks && planFeatures.tasks)) && (
          <>
          {/* QUICK ACTIONS */}
          <div className="inx-section-head">
            <h2>إجراءات سريعة</h2>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 10,
            }}
          >
            {(settings.features.clients && planFeatures.clients) && <Link to="/clients" className="inx-shortcut-card"><span className="inx-3d-icon sm"><Users size={17} /></span><span className="label">إضافة عميل</span></Link>}
            {(settings.features.policies && planFeatures.policies) && <Link to="/policies" className="inx-shortcut-card"><span className="inx-3d-icon sm tone-cyan"><FileText size={17} /></span><span className="label">إضافة وثيقة</span></Link>}
            {(settings.features.claims && planFeatures.claims) && <Link to="/claims" className="inx-shortcut-card"><span className="inx-3d-icon sm tone-warning"><AlertTriangle size={17} /></span><span className="label">إضافة مطالبة</span></Link>}
            {(settings.features.tasks && planFeatures.tasks) && <Link to="/tasks" className="inx-shortcut-card"><span className="inx-3d-icon sm tone-success"><ListTodo size={17} /></span><span className="label">إضافة مهمة</span></Link>}
          </div>
          </>
        )}
      </div>
    </main>
  );
}