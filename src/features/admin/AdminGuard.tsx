import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { isCurrentUserAdmin } from '../subscription/subscription.service';

export default function AdminGuard() {
  const { user, loading } = useAuth();
  const [state, setState] = useState<'loading' | 'admin' | 'denied'>('loading');

  useEffect(() => {
    if (loading) return;
    if (!user?.uid) {
      setState('denied');
      return;
    }
    let cancelled = false;
    void isCurrentUserAdmin(user.uid).then((isAdmin) => {
      if (cancelled) return;
      setState(isAdmin ? 'admin' : 'denied');
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid, loading]);

  if (loading || state === 'loading') {
    return (
      <main className="admin-loading" dir="rtl">
        <div className="admin-loading-card">
          <div className="admin-spinner" />
          <b>جاري التحقق من الصلاحيات...</b>
        </div>
      </main>
    );
  }

  if (state === 'denied') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}