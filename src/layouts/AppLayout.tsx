import { useState } from 'react';
import {
  Bell,
  Bot,
  Home,
  LogOut,
  Moon,
  MoreHorizontal,
  Monitor,
  Settings2,
  ShieldCheck,
  Sparkles,
  Smartphone,
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
import { usePlanFeatures } from '../features/subscription/PlanFeaturesProvider';

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
  const { features: planFeatures } = usePlanFeatures();
  const visibleNavigation = navigation.filter(
    (item) =>
      !item.feature ||
      (settings.features[item.feature] && planFeatures[item.feature]),
  );
  const { resolvedTheme, toggleTheme } = useTheme();
  const firstName = profile?.displayName?.trim().split(/\s+/)[0] || 'مستخدم';
  const location = useLocation();
  const [floatingOpen, setFloatingOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>(() => {
    if (typeof window === 'undefined') return 'mobile';
    return window.matchMedia('(min-width: 760px)').matches ? 'desktop' : 'mobile';
  });

  const toggleViewMode = () => {
    setViewMode((current) => (current === 'mobile' ? 'desktop' : 'mobile'));
  };

  const isCopilotPage = location.pathname === '/copilot';
  const isAuthPage =
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/register');
  const showFab =
    settings.features.copilot && planFeatures.copilot && !isCopilotPage && !isAuthPage;

  return (
    <div className={`mobile-shell view-mode-${viewMode}`} dir="rtl">
      <header className="app-header s8-header">
        <div className="s8-brand">
          <Logo alt="InsurNex" />
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
            className="view-mode-toggle"
            onClick={toggleViewMode}
            aria-label={
              viewMode === 'mobile'
                ? 'التبديل إلى عرض سطح المكتب'
                : 'التبديل إلى عرض الهاتف'
            }
            title={viewMode === 'mobile' ? 'عرض سطح المكتب' : 'عرض الهاتف'}
          >
            {viewMode === 'mobile' ? (
              <Monitor size={16} aria-hidden="true" />
            ) : (
              <Smartphone size={16} aria-hidden="true" />
            )}
            <span>{viewMode === 'mobile' ? 'سطح المكتب' : 'عرض الهاتف'}</span>
          </button>

          <button
            type="button"
            className="circle-button"
            onClick={toggleTheme}
            aria-label="تبديل السمة"
            title={resolvedTheme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
          >
            {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {settings.features.notifications && planFeatures.notifications && (
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
        className="app-tabbar s8-tabbar inx-tabbar-primary inx-tabbar-6"
        aria-label="التنقل الرئيسي"
      >
        {visibleNavigation.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={to === '/copilot' ? 'nav-copilot' : undefined}
          >
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
