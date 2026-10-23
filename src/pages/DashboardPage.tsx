import { useEffect, useState } from 'react';
import {
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  ListTodo,
  Moon,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sun,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import {
  loadDashboard,
  type DashboardData,
} from '../features/dashboard/dashboard.service';
import { setCurrentContext } from '../features/copilot/copilot-context.store';
import { useTheme } from '../theme/ThemeProvider';
import MiniDonutChart from '../components/charts/MiniDonutChart';
import MiniLineChart from '../components/charts/MiniLineChart';
import OnboardingChecklist from '../features/onboarding/OnboardingChecklist';
import AdsSlideshow from '../features/admin/AdsSlideshow';
import { usePlatformSettings } from '../features/admin/PlatformSettingsProvider';
import type { PlatformFeatureKey } from '../features/admin/platform-settings.service';

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

const shortcuts: { to: string; label: string; emoji: string; tone: string; feature: PlatformFeatureKey | null }[] = [
  { to: '/clients', label: 'العملاء', emoji: '👥', tone: '', feature: 'clients' },
  { to: '/policies', label: 'الوثائق', emoji: '📄', tone: 'tone-cyan', feature: 'policies' },
  { to: '/claims', label: 'المطالبات', emoji: '⚠️', tone: 'tone-success', feature: 'claims' },
  { to: '/renewals', label: 'التجديدات', emoji: '🔄', tone: 'tone-warning', feature: 'renewals' },
  { to: '/tasks', label: 'المهام', emoji: '✅', tone: '', feature: 'tasks' },
  { to: '/insurers', label: 'الشركات', emoji: '🏢', tone: 'tone-cyan', feature: 'insurers' },
  { to: '/finance', label: 'المالية', emoji: '💰', tone: 'tone-success', feature: 'finance' },
  { to: '/more', label: 'المزيد', emoji: '⋯', tone: 'tone-purple', feature: null },
];

export default function DashboardPage() {
  const { profile } = useAuth();
  const { settings } = usePlatformSettings();
  const visibleShortcuts = shortcuts.filter((item) => !item.feature || settings.features[item.feature]);
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
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

  const firstName = profile?.displayName?.split(' ')[0] || 'أهلاً';
  const roleLabel =
    profile?.role === 'owner'
      ? 'مالك المؤسسة'
      : profile?.role === 'admin'
      ? 'أدمن'
      : profile?.role || 'مستخدم';

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
    { label: 'عملاء نشطون', value: Math.max(data.clients - 1, 0), color: '#10b981' },
    { label: 'عملاء جدد', value: 1, color: '#1E4272' },
  ];
  if (data.clients === 0) {
    clientSegments[0].value = 0;
    clientSegments[1].value = 0;
  }

  const renewalTrend =
    data.renewals.length > 0
      ? data.renewals.slice(0, 8).map((r) => Math.max(r.daysLeft, 0))
      : [4, 6, 5, 8, 7, 9, 11, 10];

  const askCopilot = () => {
    navigate('/copilot', {
      state: {
        context: {
          page: 'dashboard',
          stats: {
            totalClients: data.clients,
            activePolicies: data.activePolicies,
            openClaims: data.openClaims,
            upcomingRenewals: data.renewals.length,
          },
          notes: 'The broker is on the main dashboard.',
        },
      },
    });
  };

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
            <span className="eyebrow">InsurNex Workspace</span>
            <h2 style={{ margin: '2px 0 4px', fontSize: 20, color: 'var(--inx-text)' }}>
              أهلاً {firstName}
            </h2>
            <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
              {roleLabel}
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
            {settings.features.policies && (
              <Link to="/policies" className="inx-circle-btn" title="بحث سريع">
                <Search size={17} />
              </Link>
            )}
            {settings.features.copilot && (
              <button
                type="button"
                className="inx-circle-btn filled"
                onClick={askCopilot}
                title="اسأل InsurNex"
              >
                <Bot size={17} />
              </button>
            )}
            {settings.features.notifications && (
              <Link to="/notifications" className="inx-circle-btn" title="الإشعارات">
                <Bell size={17} />
                {data.notificationCount > 0 && (
                  <span className="badge">
                    {Math.min(data.notificationCount, 99)}
                  </span>
                )}
              </Link>
            )}
          </div>
        </header>

        {/* Ads are enabled and placed from the admin control center. */}
        {settings.advertising.enabled && settings.advertising.dashboard && (
          <div style={{ marginBottom: 14 }}><AdsSlideshow /></div>
        )}

        {/* SCOPE ROW */}
        <div className="inx-scope-row" style={{ marginBottom: 14 }}>
          <span className="inx-scope-pill">
            <ShieldCheck size={14} />
            {roleLabel}
          </span>
          <span className="inx-chip-emphasis">
            <Bell size={13} />
            {data.notificationCount > 0
              ? `${data.notificationCount} إشعارات`
              : 'لا إشعارات'}
          </span>
          {settings.features.tasks && <Link to="/tasks" className="inx-scope-pill"><ListTodo size={14} />{data.tasks.length} مهام</Link>}
        </div>

        {/* ONBOARDING CHECKLIST */}
        {(settings.features.clients || settings.features.policies) && (
          <OnboardingChecklist
            clientsCount={settings.features.clients ? data.clients : 0}
            policiesCount={settings.features.policies ? data.activePolicies : 0}
          />
        )}

        {/* SHORTCUTS */}
        <div className="inx-shortcut-row" style={{ marginBottom: 18 }}>
          {visibleShortcuts.map(({ to, label, emoji, tone }) => (
            <Link key={to} to={to} className="inx-shortcut-card">
              <span className={`inx-3d-icon ${tone}`}>{emoji}</span>
              <span className="label">{label}</span>
            </Link>
          ))}
        </div>

        {/* HERO PANEL */}
        <section className="inx-hero-panel" style={{ marginBottom: 18 }}>
          <div className="hero-head">
            <div className="title-group">
              <span className="dot" />
              <span>لوحة الأداء</span>
            </div>
            <div className="actions">
              {settings.features.policies && <Link to="/policies">الوثائق</Link>}
            </div>
          </div>

          <div className="hero-body" style={{ gridTemplateColumns: settings.features.clients && settings.features.policies ? "repeat(2, minmax(0, 1fr))" : "1fr" }}>
            {settings.features.clients && (
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

            {settings.features.policies && (
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
            <span className="info">
              <CalendarDays size={13} />
              {nearestRenewalDays === null
                ? 'لا تجديدات قريبة'
                : nearestRenewalDays < 0
                ? 'يوجد تجديد متأخر'
                : `أقرب تجديد: ${nearestRenewalDays} يوم`}
            </span>
          </div>

          <div className="hero-foot" style={{ borderTop: 'none', paddingTop: 0 }}>
            <span className="info">
              <TrendingUp size={13} />
              {data.openClaims} مطالبات مفتوحة
            </span>
            {settings.features.finance && <Link to="/finance" className="hero-cta"><Wallet size={14} />المالية<span>←</span></Link>}
          </div>
        </section>

        {/* CHARTS ROW */}
        {(settings.features.clients || settings.features.renewals) && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 12,
              marginBottom: 18,
            }}
          >
            {settings.features.clients && (
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

            {settings.features.renewals && (
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

        {settings.features.tasks && (
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

        {settings.features.renewals && (
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
          {settings.features.clients && <Link to="/clients" className="inx-shortcut-card"><span className="inx-3d-icon sm">👤</span><span className="label">إضافة عميل</span></Link>}
          {settings.features.policies && <Link to="/policies" className="inx-shortcut-card"><span className="inx-3d-icon sm tone-cyan">📄</span><span className="label">إضافة وثيقة</span></Link>}
          {settings.features.claims && <Link to="/claims" className="inx-shortcut-card"><span className="inx-3d-icon sm tone-success">⚠️</span><span className="label">إضافة مطالبة</span></Link>}
          {settings.features.tasks && <Link to="/tasks" className="inx-shortcut-card"><span className="inx-3d-icon sm tone-warning">✅</span><span className="label">إضافة مهمة</span></Link>}
        </div>
      </div>
    </main>
  );
}