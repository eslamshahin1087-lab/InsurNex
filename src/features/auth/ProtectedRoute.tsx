import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';
import { isCurrentUserAdmin } from '../subscription/subscription.service';

export default function ProtectedRoute() {
  const { user, profile, loading } = useAuth();
  const loc = useLocation();
  const [adminState, setAdminState] = useState<'loading' | 'admin' | 'user'>(
    'loading',
  );

  useEffect(() => {
    if (loading) return;
    if (!user?.uid) {
      setAdminState('user');
      return;
    }
    let cancelled = false;
    void isCurrentUserAdmin(user.uid).then((isAdmin) => {
      if (cancelled) return;
      setAdminState(isAdmin ? 'admin' : 'user');
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid, loading]);

  if (loading || adminState === 'loading') {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  // Not authenticated → Landing page
  if (!user) {
    return <Navigate to="/welcome" replace />;
  }

  // Admin → bypass profile/setup requirement
  if (adminState === 'admin') {
    // If admin is on /setup, send to /admin-panel
    if (loc.pathname === '/setup') {
      return <Navigate to="/admin-panel" replace />;
    }
    // Admin can access everything (AdminGuard protects /admin-panel routes)
    return <Outlet />;
  }

  // Regular broker → requires profile, else /setup
  if (!profile && loc.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }

  return <Outlet />;
}

type OrganizationRoleRouteProps = {
  allowedRoles: readonly string[];
  redirectTo?: string;
};

/**
 * A role-aware UI route boundary. Firestore Rules and trusted endpoints
 * independently enforce the same authorization; this gate is not security.
 */
export function OrganizationRoleRoute({
  allowedRoles,
  redirectTo = '/',
}: OrganizationRoleRouteProps) {
  const { profile } = useAuth();

  // Platform Admin has a separate surface and is not a tenant-role substitute.
  if (!profile) return <Navigate to="/admin-panel" replace />;
  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
