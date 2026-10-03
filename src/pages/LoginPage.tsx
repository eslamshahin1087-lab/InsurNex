import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { signIn } from '../features/auth/auth.service';

export default function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!loading && user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await signIn(email.trim(), password); navigate('/'); }
    catch { setError('تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور.'); }
    finally { setBusy(false); }
  }

  return <main className="auth-mobile" dir="rtl">
    <section className="auth-phone-card">
      <div className="auth-brand-row"><img src="/branding/insurnex-brand.png" alt="InsurNex"/><span>تسجيل الدخول</span></div>
      <div className="auth-copy"><span className="eyebrow">Smarter Insurance Brokerage</span><h1>مرحبًا بعودتك</h1><p>عملاؤك ووثائقك وتجديداتك في مساحة عمل واحدة مصممة كتطبيق حديث.</p></div>
      <form onSubmit={submit} className="auth-form mobile-form">
        <label>البريد الإلكتروني<div className="input-wrap"><Mail size={19}/><input autoComplete="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com" /></div></label>
        <label>كلمة المرور<div className="input-wrap"><LockKeyhole size={19}/><input autoComplete="current-password" type={showPassword?'text':'password'} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="كلمة المرور"/><button type="button" className="input-action" onClick={()=>setShowPassword(x=>!x)} aria-label="إظهار أو إخفاء كلمة المرور">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button app-cta" disabled={busy}>{busy?'جارٍ تسجيل الدخول...':'تسجيل الدخول'}<ArrowLeft size={18}/></button>
      </form>
      <div className="register-callout"><span>جديد على InsurNex؟</span><Link to="/register">إنشاء حساب جديد</Link></div>
    </section>
  </main>;
}
