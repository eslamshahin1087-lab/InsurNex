import { Bell, Home, LogOut, Moon, MoreHorizontal, ShieldCheck, Sparkles, Sun, Users } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { signOut } from '../features/auth/auth.service';
import { useAuth } from '../features/auth/auth-context';
import { useTheme } from '../theme/ThemeProvider';

const navigation = [
  ['/', 'الرئيسية', Home],
  ['/clients', 'CRM', Users],
  ['/policies', 'الوثائق', ShieldCheck],
  ['/copilot', 'الذكاء', Sparkles],
] as const;

export default function AppLayout() {
  const { profile } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const firstName = profile?.displayName?.trim().split(/\s+/)[0] || 'مستخدم';

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
          <button
            type="button"
            className="circle-button s8-theme-button"
            onClick={toggleTheme}
            aria-label="تبديل السمة"
            title="تبديل السمة"
          >
            {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
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

      <nav className="app-tabbar s8-tabbar" aria-label="التنقل الرئيسي">
        {navigation.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} end={to === '/'}>
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
        <NavLink to="/more">
          <MoreHorizontal size={23} />
          <span>المزيد</span>
        </NavLink>
      </nav>
    </div>
  );
}