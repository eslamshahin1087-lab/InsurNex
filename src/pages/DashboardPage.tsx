import { useEffect, useState } from 'react';
import {
  Bell,
  ClipboardCheck,
  ListTodo,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Users,
  ArrowLeft,
  Building2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import {
  loadDashboard,
  type DashboardData,
} from '../features/dashboard/dashboard.service';

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
  low: 'primary',
  medium: 'primary',
  high: 'warning',
  urgent: 'danger',
};

const services = [
  { to: '/clients', label: 'العملاء', code: 'CRM', icon: Users, tone: '' },
  { to: '/policies', label: 'الوثائق', code: 'Policies', icon: ShieldCheck, tone: 'tone-cyan' },
  { to: '/renewals', label: 'التجديدات', code: 'Renewals', icon: RefreshCcw, tone: 'tone-warning' },
  { to: '/claims', label: 'المطالبات', code: 'Claims', icon: ClipboardCheck, tone: 'tone-success' },
  { to: '/tasks', label: 'المهام', code: 'Tasks', icon: ListTodo, tone: '' },
  { to: '/insurers', label: 'شركات التأمين', code: 'Insurers', icon: Building2, tone: 'tone-cyan' },
] as const;

export default function DashboardPage() {
  const { profile } = useAuth();
  const [data, setData] = useState(empty);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    loadDashboard(profile.organizationId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [profile]);

  const firstName = profile?.displayName?.split(' ')[0] || 'بك';
  const progressPct = Math.min(100, Math.max(12, data.activePolicies * 5));

  return (
    <main className="mobile-page" dir="rtl">
      <div className="inx-container">

        {/* ===== Welcome header ===== */}
        <header className="inx-section-head" style={{ marginTop: 0 }}>
          <div>
            <span className="eyebrow">InsurNex Workspace</span>
            <h2>مرحباً، {firstName}</h2>
            <small style={{ color: 'var(--inx-muted)' }}>
              إدارة أعمال الوساطة في مكان واحد.
            </small>
          </div>
          <Link
            to="/notifications"
            className="inx-icon-btn"
            aria-label="الإشعارات"
            style={{ position: 'relative' }}
          >
            <Bell size={18} />
            {data.notificationCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  left: -4,
                  background: 'var(--inx-danger)',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 999,
                  padding: '2px 6px',
                  minWidth: 18,
                  textAlign: 'center',
                }}
              >
                {Math.min(data.notificationCount, 99)}
              </span>
            )}
          </Link>
        </header>

        {/* ===== Services ===== */}
        <div className="inx-section-head">
          <h2>الخدمات</h2>
        </div>
        <div className="inx-kpi-grid">
          {services.map(({ to, label, code, icon: Icon, tone }) => (
            <Link
              key={to}
              to={to}
              className="inx-kpi inx-card-hover"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="inx-kpi-head">
                <span className={`inx-icon-circle ${tone}`}>
                  <Icon size={18} />
                </span>
              </div>
              <div className="inx-kpi-value" style={{ fontSize: 15 }}>
                {label}
              </div>
              <small className="inx-kpi-label">{code}</small>
            </Link>
          ))}
        </div>

        {/* ===== Portfolio summary ===== */}
        <div className="inx-section-head">
          <h2>محفظتك اليوم</h2>
          <Link to="/policies" className="inx-link">
            عرض المحفظة <ArrowLeft size={14} />
          </Link>
        </div>
        <div className="inx-card inx-card-lg">
          <div className="inx-kpi-grid">
            <article className="inx-kpi">
              <div className="inx-kpi-head">
                <span className="inx-icon-circle tone-cyan">
                  <ShieldCheck size={18} />
                </span>
              </div>
              <div className="inx-kpi-value">{data.activePolicies}</div>
              <small className="inx-kpi-label">وثائق نشطة</small>
            </article>

            <article className="inx-kpi">
              <div className="inx-kpi-head">
                <span className="inx-icon-circle">
                  <Users size={18} />
                </span>
              </div>
              <div className="inx-kpi-value">{data.clients}</div>
              <small className="inx-kpi-label">العملاء</small>
            </article>

            <article className="inx-kpi">
              <div className="inx-kpi-head">
                <span className="inx-icon-circle tone-warning">
                  <RefreshCcw size={18} />
                </span>
              </div>
              <div className="inx-kpi-value">{data.renewals.length}</div>
              <small className="inx-kpi-label">تجديدات قريبة</small>
            </article>

            <article className="inx-kpi">
              <div className="inx-kpi-head">
                <span className="inx-icon-circle tone-danger">
                  <ClipboardCheck size={18} />
                </span>
              </div>
              <div className="inx-kpi-value">{data.openClaims}</div>
              <small className="inx-kpi-label">مطالبات مفتوحة</small>
            </article>
          </div>

          <div className="inx-progress" style={{ marginTop: 14 }}>
            <span style={{ width: `${progressPct}%` }} />
          </div>
          <small
            style={{
              display: 'block',
              marginTop: 6,
              color: 'var(--inx-muted)',
              fontSize: 12,
            }}
          >
            {loading ? 'جاري التحميل...' : 'مؤشر أداء المحفظة'}
          </small>
        </div>

        {/* ===== Quick actions ===== */}
        <div className="inx-section-head">
          <h2>إجراءات سريعة</h2>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/clients" className="inx-btn inx-btn-primary">
            <Plus size={16} /> عميل
          </Link>
          <Link to="/policies" className="inx-btn inx-btn-secondary">
            <Plus size={16} /> وثيقة
          </Link>
          <Link to="/claims" className="inx-btn inx-btn-secondary">
            <Plus size={16} /> مطالبة
          </Link>
          <Link to="/tasks" className="inx-btn inx-btn-ghost">
            <Plus size={16} /> مهمة
          </Link>
        </div>

        {/* ===== Tasks feed ===== */}
        <div className="inx-section-head">
          <h2>مهامك القادمة</h2>
          <Link to="/tasks" className="inx-link">
            عرض الكل <ArrowLeft size={14} />
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
          <ul className="inx-list">
            {data.tasks.slice(0, 5).map((t) => (
              <li key={t.id}>
                <Link to="/tasks" className="inx-list-item">
                  <span
                    className={`inx-icon-circle tone-${priorityTone[t.priority] || 'primary'}`}
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
                  <ArrowLeft size={16} className="inx-list-chevron" />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* ===== Renewals feed ===== */}
        <div className="inx-section-head">
          <h2>أقرب التجديدات</h2>
          <Link to="/renewals" className="inx-link">
            عرض الكل <ArrowLeft size={14} />
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
          <ul className="inx-list">
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