import { useState } from 'react';
import {
  Bell,
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
import { useAuth, canAccessClient360, canAccessOperations } from '../features/auth/auth-context';
import { useTheme } from '../theme/ThemeProvider';
import CopilotFloatingPanel from '../features/copilot/CopilotFloatingPanel';
import Logo from '../components/Logo';
import InsurNexRobot from '../components/InsurNexRobot';
import { usePlatformSettings } from '../features/admin/PlatformSettingsProvider';
import type { PlatformFeatureKey } from '../features/admin/platform-settings.service';
import type { LucideIcon } from 'lucide-react';
import { usePlanFeatures } from '../features/subscription/PlanFeaturesProvider';
import {
  resolveViewMode,
} from './view-mode-preference';

const navigation: { to: string; label: string; Icon: LucideIcon; feature?: PlatformFeatureKey }[] = [
  { to: '/', label: 'الرئيسية', Icon: Home },
  { to: '/clients', label: 'CRM', Icon: Users, feature: 'clients' },
  { to: '/policies', label: 'الوثائق', Icon: ShieldCheck, feature: 'policies' },
  { to: '/operations', label: 'العمليات', Icon: Settings2, feature: 'operations' },
  { to: '/copilot', label: 'الذكاء', Icon: Sparkles, feature: 'copilot' },
];

const INTERNAL_DISPLAY_NAMES = new Set([
  'admin',
  'broker',
  'claims',
  'client',
  'clients',
  'default',
  'finance',
  'lead',
  'leads',
  'owner',
  'platform-admin',
  'platform_admin',
  'sales',
  'staff',
  'unknown',
  'user',
  'users',
]);

function getGreetingName(displayName?: string | null): string {
  const firstName = displayName?.trim().split(/\s+/)[0];
  const normalized = firstName?.toLowerCase().replace(/\s+/g, '-');
  if (!firstName || !normalized || INTERNAL_DISPLAY_NAMES.has(normalized)) return 'بك';
  return firstName;
}

const roleLabels: Record<string, string> = {
  owner: 'مالك المؤسسة',
  admin: 'مسؤول المؤسسة',
  broker: 'وسيط تأمين',
  sales: 'فريق المبيعات',
  claims: 'فريق المطالبات',
  finance: 'الإدارة المالية',
  staff: 'عضو الفريق',
};

export default function AppLayout() {
  const { profile } = useAuth();
  const { settings } = usePlatformSettings();
  const { features: planFeatures } = usePlanFeatures();
  const visibleNavigation = navigation.filter(
    (item) =>
      (item.to !== '/clients' || canAccessClient360(profile?.role)) &&
      (item.to !== '/operations' || canAccessOperations(profile?.role)) &&
      (!item.feature ||
        (settings.features[item.feature] && planFeatures[item.feature])),
  );
  const { resolvedTheme, toggleTheme } = useTheme();
  const firstName = getGreetingName(profile?.displayName);
  const roleLabel = profile?.role ? roleLabels[profile.role] ?? 'مستخدم' : 'مستخدم';
  const location = useLocation();
  const [floatingOpen, setFloatingOpen] = useState(false);
  const viewMode = resolveViewMode(location.search, null);

  const isDashboardPage = location.pathname === '/';
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
          {!isDashboardPage && (
            <div className="s8-hello">
              <strong>أهلاً {firstName}</strong>
              <small>{roleLabel}</small>
            </div>
          )}
        </div>

        <div className="s8-actions">
          {!isDashboardPage && (
            <>
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
            </>
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
          <InsurNexRobot size={34} className="inx-robot-icon" />
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
