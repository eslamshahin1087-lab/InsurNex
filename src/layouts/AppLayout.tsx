import {
  Bell,
  Home,
  LogOut,
  MoreHorizontal,
  RefreshCcw,
  ShieldCheck,
  Users,
} from 'lucide-react';

import {
  Link,
  NavLink,
  Outlet,
} from 'react-router-dom';

import { signOut } from '../features/auth/auth.service';
import { useAuth } from '../features/auth/auth-context';

const navigation = [
  ['/', 'الرئيسية', Home],
  ['/clients', 'CRM', Users],
  ['/policies', 'الوثائق', ShieldCheck],
  ['/renewals', 'التجديدات', RefreshCcw],
] as const;

export default function AppLayout() {
  const { profile } = useAuth();

  return (
    <div
      className="mobile-shell"
      dir="rtl"
    >
      {/* Mobile Application Header */}

      <header className="app-header">

        /branding/insurnex-brand.png

        <div className="app-user">
          <strong>
            {profile?.displayName || 'InsurNex'}
          </strong>

          <small>
            {profile?.role === 'owner'
              ? 'مالك المؤسسة'
              : profile?.role || 'Workspace'}
          </small>
        </div>

        {/* Notifications */}

        <Link
          className="circle-button notification-button"
          to="/notifications"
          aria-label="الإشعارات"
          title="الإشعارات"
        >
          <Bell size={18} />
        </Link>

        {/* Logout */}

        <button
          type="button"
          className="circle-button"
          onClick={() => void signOut()}
          aria-label="تسجيل الخروج"
          title="تسجيل الخروج"
        >
          <LogOut size={18} />
        </button>

      </header>

      {/* Route Content */}

      <main className="app-body">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation */}

      <nav
        className="app-tabbar"
        aria-label="التنقل الرئيسي"
      >

        {navigation.map(
          ([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
            >
              <Icon size={22} />

              <span>
                {label}
              </span>
            </NavLink>
          ),
        )}

        <NavLink to="/more">
          <MoreHorizontal size={23} />

          <span>
            المزيد
          </span>
        </NavLink>

      </nav>

    </div>
  );
}