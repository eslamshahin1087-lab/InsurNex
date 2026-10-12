import { useState } from 'react';
import {
  Bell,
  Bot,
  Home,
  LogOut,
  MoreHorizontal,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { signOut } from '../features/auth/auth.service';
import { useAuth } from '../features/auth/auth-context';
import CopilotFloatingPanel from '../features/copilot/CopilotFloatingPanel';

const navigation = [
  ['/', 'الرئيسية', Home],
  ['/clients', 'CRM', Users],
  ['/policies', 'الوثائق', ShieldCheck],
  ['/operations', 'العمليات', Settings2],
  ['/copilot', 'الذكاء', Sparkles],
] as const;

export default function AppLayout() {
  const { profile } = useAuth();
  const firstName = profile?.displayName?.trim().split(/\s+/)[0] || 'مستخدم';
  const location = useLocation();
  const [floatingOpen, setFloatingOpen] = useState(false);

  const isCopilotPage = location.pathname === '/copilot';
  const isAuthPage =
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/register');
  const showFab = !isCopilotPage && !isAuthPage;

  return (
    <div className="mobile-shell" dir="rtl">
      <header className="app-header s8-header">
        <div className="s8-brand">
          <img src="/branding/insurnex-brand.png" alt="InsurNex" />
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
          <Link
            className="circle-button notification-button"
            to="/notifications"
            aria-label="الإشعارات"
            title="الإشعارات"
          >
            <Bell size={18} />
          </Link>
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
        {navigation.map(([to, label, Icon]) => (
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