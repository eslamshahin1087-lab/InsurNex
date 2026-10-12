import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  Building2,
  KeyRound,
  LayoutDashboard,
  LogOut,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { signOut } from '../features/auth/auth.service';
import {
  isCurrentUserAdmin,
  listAllSubscriptions,
  listCodes,
} from '../features/subscription/subscription.service';
import type { OrganizationSubscription } from '../features/subscription/subscription.types';

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [subscriptions, setSubscriptions] = useState<OrganizationSubscription[]>([]);
  const [unusedCodes, setUnusedCodes] = useState<number>(0);
  const [usedCodes, setUsedCodes] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    void isCurrentUserAdmin(user.uid).then(setAllowed);
  }, [user?.uid]);

  useEffect(() => {
    if (allowed !== true) return;
    (async () => {
      try {
        const [subs, unused, used] = await Promise.all([
          listAllSubscriptions(200),
          listCodes({ status: 'unused', limitCount: 200 }),
          listCodes({ status: 'used', limitCount: 200 }),
        ]);
        setSubscriptions(subs);
        setUnusedCodes(unused.length);
        setUsedCodes(used.length);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [allowed]);

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  if (allowed === null) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-container">
          <div className="inx-empty">
            <b>جاري التحقق من الصلاحيات...</b>
          </div>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-container">
          <div className="inx-empty">
            <LayoutDashboard size={32} />
            <b>غير مصرح</b>
            <small>هذه الصفحة مخصصة لمالك المنصة فقط.</small>
            <Link
              to="/"
              className="inx-btn inx-btn-secondary"
              style={{ marginTop: 8 }}
            >
              <ArrowLeft size={16} /> العودة للرئيسية
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const now = new Date().toISOString().slice(0, 10);
  const active = subscriptions.filter(
    (s) => s.status === 'active' && s.endDate >= now,
  ).length;
  const trial = subscriptions.filter((s) => s.status === 'trial').length;
  const expired = subscriptions.filter(
    (s) => s.status === 'suspended' || s.endDate < now,
  ).length;

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src="/branding/logo-light.png"
              alt="InsurNex"
              style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 12 }}
            />
            <div>
              <span className="eyebrow">Admin Panel</span>
              <h2 style={{ margin: '2px 0 0', fontSize: 20, color: 'var(--inx-text)' }}>
                لوحة تحكم المالك
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="inx-icon-btn"
            onClick={() => void handleSignOut()}
            title="تسجيل الخروج"
          >
            <LogOut size={17} />
          </button>
        </header>

        {/* KPIs */}
        <div className="inx-kpi-grid" style={{ marginBottom: 16 }}>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-cyan">
                <Building2 size={18} />
              </span>
            </div>
            <div className="inx-kpi-value">{subscriptions.length}</div>
            <small className="inx-kpi-label">إجمالي المؤسسات</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-success">
                <TrendingUp size={18} />
              </span>
            </div>
            <div className="inx-kpi-value">{active}</div>
            <small className="inx-kpi-label">اشتراكات نشطة</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-warning">
                <Activity size={18} />
              </span>
            </div>
            <div className="inx-kpi-value">{trial}</div>
            <small className="inx-kpi-label">تجارب مجانية</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-danger">
                <Activity size={18} />
              </span>
            </div>
            <div className="inx-kpi-value">{expired}</div>
            <small className="inx-kpi-label">منتهية/موقوفة</small>
          </article>
        </div>

        {/* CODES KPIs */}
        <div className="inx-kpi-grid" style={{ marginBottom: 16 }}>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-primary">
                <KeyRound size={18} />
              </span>
            </div>
            <div className="inx-kpi-value">{unusedCodes}</div>
            <small className="inx-kpi-label">أكواد غير مستخدمة</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-success">
                <KeyRound size={18} />
              </span>
            </div>
            <div className="inx-kpi-value">{usedCodes}</div>
            <small className="inx-kpi-label">أكواد مستخدمة</small>
          </article>
        </div>

        {/* QUICK ACTIONS */}
        <div className="inx-section-head">
          <h2>الأقسام</h2>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 10,
          }}
        >
          <Link to="/admin/codes" className="inx-shortcut-card">
            <span className="inx-3d-icon tone-purple">🔑</span>
            <span className="label">إدارة الأكواد</span>
            <span className="sub">إنشاء وإلغاء</span>
          </Link>
          <Link to="/admin/subscriptions" className="inx-shortcut-card">
            <span className="inx-3d-icon tone-cyan">📊</span>
            <span className="label">الاشتراكات</span>
            <span className="sub">عرض وإدارة</span>
          </Link>
          <div className="inx-shortcut-card" style={{ opacity: 0.6 }}>
            <span className="inx-3d-icon tone-warning">📢</span>
            <span className="label">الإعلانات</span>
            <span className="sub">قريباً</span>
          </div>
          <div className="inx-shortcut-card" style={{ opacity: 0.6 }}>
            <span className="inx-3d-icon tone-success">
              <Users size={20} />
            </span>
            <span className="label">المستخدمون</span>
            <span className="sub">قريباً</span>
          </div>
        </div>

        {loading && (
          <div className="inx-empty" style={{ marginTop: 16 }}>
            جاري تحميل البيانات...
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <Link to="/" className="inx-btn inx-btn-secondary">
            <ArrowLeft size={16} /> العودة للتطبيق
          </Link>
        </div>
      </div>
    </main>
  );
}