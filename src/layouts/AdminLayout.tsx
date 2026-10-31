import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Archive,
  Banknote,
  BarChart3,
  Building2,
  CreditCard,
  DollarSign,
  ExternalLink,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Moon,
  Settings,
  Sun,
  Users,
} from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { signOut } from '../features/auth/auth.service';
import { useTheme } from '../theme/ThemeProvider';
import { NotificationBell } from '../features/notifications';
import '../theme/admin.css';
import Logo from '../components/Logo';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/admin-panel', label: 'لوحة التحكم', icon: LayoutDashboard, end: true },
  { to: '/admin-panel/subscriptions', label: 'الاشتراكات', icon: CreditCard },
  { to: '/admin-panel/codes', label: 'الأكواد', icon: KeyRound },
  { to: '/admin-panel/pricing', label: 'الأسعار', icon: DollarSign },
  { to: '/admin-panel/finance', label: 'الماليات', icon: Banknote },
  { to: '/admin-panel/users', label: 'المستخدمون', icon: Users },
  { to: '/admin-panel/ads', label: 'الإعلانات', icon: Megaphone },
  { to: '/admin-panel/analytics', label: 'التحليلات', icon: BarChart3 },
  { to: '/admin-panel/archive', label: 'الأرشيف', icon: Archive },
  { to: '/admin-panel/settings', label: 'إعدادات النظام', icon: Settings },
];

export default function AdminLayout() {
  const { profile } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayName = profile?.displayName?.trim() || 'Admin';

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <div className="admin-shell" dir="rtl">
      <aside className={`admin-sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="admin-sidebar-brand">
          <Logo alt="InsurNex" variant="mark" />
          <div>
            <strong>InsurNex</strong>
            <small>Admin Panel</small>
          </div>
        </div>

        <nav className="admin-sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <Link to="/" className="admin-sidebar-link">
            <ExternalLink size={16} />
            <span>العودة للتطبيق</span>
          </Link>
          <button
            type="button"
            className="admin-sidebar-link"
            onClick={toggleTheme}
          >
            {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{resolvedTheme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}</span>
          </button>
          <button
            type="button"
            className="admin-sidebar-link danger"
            onClick={() => void handleSignOut()}
          >
            <LogOut size={16} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="admin-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="admin-main">
        <header className="admin-header">
          <button
            type="button"
            className="admin-menu-btn"
            onClick={() => setMobileOpen(true)}
            aria-label="القائمة"
          >
            <Menu size={20} />
          </button>

          <div className="admin-header-title">
            <Building2 size={16} />
            <span>لوحة تحكم المنصة</span>
          </div>

          {/* ✅ جرس الإشعارات */}
          <NotificationBell onNavigate={(link) => navigate(link)} />

          <div className="admin-header-user">
            <span className="admin-header-badge">Admin</span>
            <strong>{displayName}</strong>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}