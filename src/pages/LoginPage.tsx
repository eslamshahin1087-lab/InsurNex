import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, Moon, Sun } from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { signIn } from '../features/auth/auth.service';
import { useTheme } from '../theme/ThemeProvider';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(email.trim(), password);
      navigate('/');
    } catch {
      setError('تعذر تسجيل الدخول. تحقق من بياناتك.');
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

  return (
    <main
      dir="rtl"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background:
          'radial-gradient(circle at 20% 20%, rgba(2, 159, 233, 0.08), transparent 32%), var(--inx-bg)',
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
            <img
              src="/branding/logo-light.png"
              alt="InsurNex"
              style={{
                width: 48,
                height: 48,
                objectFit: 'contain',
                borderRadius: 12,
              }}
            />
            <div>
              <strong
                style={{ display: 'block', fontSize: 14, color: 'var(--inx-text)' }}
              >
                InsurNex
              </strong>
              <small style={{ color: 'var(--inx-muted)', fontSize: 11 }}>
                Insurance Brokerage
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
          <span className="eyebrow">Smarter Insurance Brokerage</span>
          <h1
            style={{
              margin: '8px 0 8px',
              fontSize: 24,
              fontWeight: 800,
              color: 'var(--inx-text)',
            }}
          >
            مرحباً بعودتك
          </h1>
          <p
            style={{
              margin: 0,
              color: 'var(--inx-muted)',
              fontSize: 13.5,
              lineHeight: 1.75,
            }}
          >
            عملاؤك ووثائقك وتحديثاتك في مساحة عمل واحدة مصممة خصيصاً لمكتبك.
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
                placeholder="name@company.com"
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
            style={{ padding: '13px 16px', fontSize: 14.5 }}
          >
            {busy ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            <ArrowLeft size={16} />
          </button>
        </form>

        {/* SWITCH */}
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
            جديد على InsurNex؟
          </span>
          <Link
            to="/register"
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
            إنشاء حساب جديد
          </Link>
        </div>
      </div>
    </main>
  );
}