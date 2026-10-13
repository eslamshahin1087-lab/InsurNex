import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { signIn, signOut } from '../features/auth/auth.service';
import { useTheme } from '../theme/ThemeProvider';
import { isCurrentUserAdmin } from '../features/subscription/subscription.service';

export default function AdminLoginPage() {
  const { user, loading } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Handle already-logged-in users
  useEffect(() => {
    if (loading) return;

    if (!user?.uid) {
      setChecking(false);
      return;
    }

    (async () => {
      const isAdmin = await isCurrentUserAdmin(user.uid);
      if (isAdmin) {
        navigate('/admin-panel', { replace: true });
        return;
      }
      // Logged in as broker → sign out silently so they can log in as admin
      await signOut();
      setChecking(false);
    })();
  }, [user?.uid, loading, navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const cred = await signIn(email.trim(), password);
      const uid = cred.user.uid;
      const isAdmin = await isCurrentUserAdmin(uid);
      if (!isAdmin) {
        await signOut();
        setError('هذا الحساب لا يملك صلاحيات الأدمن.');
        setBusy(false);
        return;
      }
      navigate('/admin-panel', { replace: true });
    } catch {
      setError('تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور.');
    } finally {
      setBusy(false);
    }
  }

  const wrapperStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid var(--inx-border)',
    borderRadius: 'var(--inx-radius, 14px)',
    padding: '0 12px',
    background: 'var(--inx-surface)',
  } as const;

  const inputStyle = {
    flex: 1,
    border: 0,
    outline: 0,
    padding: '12px 0',
    background: 'transparent',
    color: 'var(--inx-text)',
    fontSize: 14,
  } as const;

  if (checking) {
    return (
      <main className="admin-loading" dir="rtl">
        <div className="admin-loading-card">
          <div className="admin-spinner" />
          <b>جاري التحقق...</b>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background:
          'radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.12), transparent 40%), radial-gradient(circle at 20% 80%, rgba(58, 107, 159, 0.08), transparent 32%), var(--inx-bg)',
      }}
    >
      <div
        className="inx-card inx-card-lg"
        style={{
          width: 'min(440px, 100%)',
          padding: 28,
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 22,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              className="inx-icon-circle inx-icon-circle-lg"
              style={{ background: '#ede9fe', color: '#8b5cf6' }}
            >
              <ShieldCheck size={22} />
            </span>
            <div>
              <strong
                style={{ display: 'block', fontSize: 15, color: 'var(--inx-text)' }}
              >
                لوحة تحكم المنصة
              </strong>
              <small style={{ color: 'var(--inx-muted)', fontSize: 11 }}>
                Admin Access Only
              </small>
            </div>
          </div>

          <button
            type="button"
            className="inx-icon-btn"
            onClick={toggleTheme}
            title={resolvedTheme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
          >
            {resolvedTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>

        {/* TITLE */}
        <div style={{ marginBottom: 22 }}>
          <span className="eyebrow">منطقة محمية</span>
          <h1
            style={{
              margin: '8px 0 8px',
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--inx-text)',
            }}
          >
            دخول المسؤول
          </h1>
          <p
            style={{
              margin: 0,
              color: 'var(--inx-muted)',
              fontSize: 13.5,
              lineHeight: 1.75,
            }}
          >
            هذه الصفحة مخصصة لمشرفي المنصة فقط. سيُرفض أي حساب لا يملك صلاحيات
            الأدمن.
          </p>
        </div>

        {/* FORM */}
        <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span
              style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--inx-text)' }}
            >
              البريد الإلكتروني
            </span>
            <div style={wrapperStyle}>
              <Mail size={18} style={{ color: 'var(--inx-muted)' }} />
              <input
                autoComplete="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@insurnex.com"
                style={inputStyle}
              />
            </div>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span
              style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--inx-text)' }}
            >
              كلمة المرور
            </span>
            <div style={wrapperStyle}>
              <LockKeyhole size={18} style={{ color: 'var(--inx-muted)' }} />
              <input
                autoComplete="current-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة المرور"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => setShowPassword((x) => !x)}
                style={{
                  border: 0,
                  background: 'transparent',
                  color: 'var(--inx-muted)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'grid',
                  placeItems: 'center',
                }}
                aria-label="إظهار/إخفاء كلمة المرور"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>

          {error && (
            <div
              role="alert"
              style={{
                background: 'var(--inx-danger-bg)',
                color: 'var(--inx-danger)',
                border: '1px solid var(--inx-danger)',
                padding: '10px 12px',
                borderRadius: 'var(--inx-radius-sm, 10px)',
                fontSize: 12.5,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="inx-btn inx-btn-primary inx-btn-block"
            disabled={busy}
            style={{
              padding: '13px 16px',
              fontSize: 14.5,
              background: 'linear-gradient(135deg, #4c1d95 0%, #8b5cf6 100%)',
            }}
          >
            {busy ? 'جاري التحقق...' : 'دخول لوحة التحكم'}
            <ArrowLeft size={16} />
          </button>
        </form>

        {/* BACK */}
        <div
          style={{
            marginTop: 20,
            paddingTop: 18,
            borderTop: '1px solid var(--inx-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ color: 'var(--inx-muted)', fontSize: 13 }}>
            لست أدمن؟
          </span>
          <Link
            to="/login"
            style={{
              color: 'var(--inx-blue)',
              fontWeight: 700,
              textDecoration: 'none',
              padding: '6px 14px',
              borderRadius: 'var(--inx-radius-sm, 10px)',
              background: 'var(--inx-info-bg)',
              fontSize: 13,
            }}
          >
            دخول الوسطاء
          </Link>
        </div>
      </div>
    </main>
  );
}