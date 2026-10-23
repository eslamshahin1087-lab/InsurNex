import { useState } from 'react';
import {
  Bell,
  Bot,
  Home,
  LogOut,
  Moon,
  MoreHorizontal,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { signOut } from '../features/auth/auth.service';
import { useAuth } from '../features/auth/auth-context';
import { useTheme } from '../theme/ThemeProvider';
import CopilotFloatingPanel from '../features/copilot/CopilotFloatingPanel';
import Logo from '../components/Logo';
import { usePlatformSettings } from '../features/admin/PlatformSettingsProvider';
import type { PlatformFeatureKey } from '../features/admin/platform-settings.service';
import type { LucideIcon } from 'lucide-react';

const navigation: { to: string; label: string; Icon: LucideIcon; feature?: PlatformFeatureKey }[] = [
  { to: '/', label: 'الرئيسية', Icon: Home },
  { to: '/clients', label: 'CRM', Icon: Users, feature: 'clients' },
  { to: '/policies', label: 'الوثائق', Icon: ShieldCheck, feature: 'policies' },
  { to: '/operations', label: 'العمليات', Icon: Settings2, feature: 'operations' },
  { to: '/copilot', label: 'الذكاء', Icon: Sparkles, feature: 'copilot' },
];

export default function AppLayout() {
  const { profile } = useAuth();
  const { settings } = usePlatformSettings();
  const visibleNavigation = navigation.filter((item) => !item.feature || settings.features[item.feature]);
  const { resolvedTheme, toggleTheme } = useTheme();
  const firstName = profile?.displayName?.trim().split(/\s+/)[0] || 'مستخدم';
  const location = useLocation();
  const [floatingOpen, setFloatingOpen] = useState(false);

  const isCopilotPage = location.pathname === '/copilot';
  const isAuthPage =
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/register');
  const showFab = settings.features.copilot && !isCopilotPage && !isAuthPage;

  return (
    <div className="mobile-shell" dir="rtl">
      <header className="app-header s8-header">
        <div className="s8-brand">
          <Logo alt="InsurNex"/>
          <div className="s8-hello">
            <strong>أهلاً {firstName}</strong>
            <small>
              {profile?.role === 'owner'
                ? 'مالك المؤسسة'
                : profile?.role || 'مستخدم'}
            </small>
          </div>
        </div>
        <div className="s8-actions">
          <button
            type="button"
            className="circle-button"
            onClick={toggleTheme}
            aria-label="تبديل السمة"
            title={resolvedTheme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
          >
            {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {settings.features.notifications && (
            <Link
              className="circle-button notification-button"
              to="/notifications"
              aria-label="الإشعارات"
              title="الإشعارات"
            >
              <Bell size={18} />
            </Link>
          )}
          <button
            type="button"
            className="circle-button"
            onClick={() => void signOut()}
            aria-label="تسجيل الخروج"
            title="تسجيل الخروج"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="app-body">
        <Outlet />
      </main>

      {showFab && !floatingOpen && (
        <button
          type="button"
          className="copilot-fab"
          onClick={() => setFloatingOpen(true)}
          aria-label="مساعد InsurNex الذكي"
          title="مساعد InsurNex الذكي"
        >
          <Bot size={22} />
        </button>
      )}

      {floatingOpen && (
        <CopilotFloatingPanel onClose={() => setFloatingOpen(false)} />
      )}

      <nav
        className="app-tabbar s8-tabbar inx-tabbar-6"
        aria-label="التنقل الرئيسي"
      >
        {visibleNavigation.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}>
            <Icon size={21} />
            <span>{label}</span>
          </NavLink>
        ))}
        <NavLink to="/more">
          <MoreHorizontal size={22} />
          <span>المزيد</span>
        </NavLink>
      </nav>
    </div>
  );
}