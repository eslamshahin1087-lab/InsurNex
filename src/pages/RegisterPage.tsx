import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { register } from '../features/auth/auth.service';

export default function RegisterPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!loading && user) return <Navigate to="/setup" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('استخدم كلمة مرور لا تقل عن 8 أحرف.');
    if (password !== confirmPassword) return setError('كلمتا المرور غير متطابقتين.');
    setBusy(true);
    try {
      await register(name, email, password);
      navigate('/setup', { replace: true });
    } catch (err: unknown) {
      const code = typeof err === 'object' && err && 'code' in err ? String((err as { code?: string }).code) : '';
      if (code.includes('email-already-in-use')) setError('هذا البريد مسجل بالفعل. استخدم تسجيل الدخول.');
      else if (code.includes('invalid-email')) setError('صيغة البريد الإلكتروني غير صحيحة.');
      else if (code.includes('weak-password')) setError('كلمة المرور ضعيفة. اختر كلمة أقوى.');
      else setError('تعذر إنشاء الحساب الآن. حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-mobile" dir="rtl">
    <section className="auth-phone-card">
      <div className="auth-brand-row">
        <img src="/branding/insurnex-brand.png" alt="InsurNex" />
        <span>حساب جديد</span>
      </div>
      <div className="auth-copy">
        <span className="eyebrow">ابدأ مع InsurNex</span>
        <h1>أنشئ حسابك</h1>
        <p>أنشئ حساب المالك ثم جهز مساحة عمل مؤسسة الوساطة في الخطوة التالية.</p>
      </div>
      <form className="auth-form mobile-form" onSubmit={submit}>
        <label>الاسم الكامل<div className="input-wrap"><UserRound size={19}/><input autoComplete="name" required value={name} onChange={e=>setName(e.target.value)} placeholder="اسم المستخدم" /></div></label>
        <label>البريد الإلكتروني<div className="input-wrap"><Mail size={19}/><input autoComplete="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@company.com" /></div></label>
        <label>كلمة المرور<div className="input-wrap"><LockKeyhole size={19}/><input autoComplete="new-password" type={showPassword?'text':'password'} required value={password} onChange={e=>setPassword(e.target.value)} placeholder="8 أحرف على الأقل" /><button type="button" className="input-action" onClick={()=>setShowPassword(x=>!x)} aria-label="إظهار أو إخفاء كلمة المرور">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
        <label>تأكيد كلمة المرور<div className="input-wrap"><LockKeyhole size={19}/><input autoComplete="new-password" type={showPassword?'text':'password'} required value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} placeholder="أعد كتابة كلمة المرور" /></div></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button app-cta" disabled={busy}>{busy?'جارٍ إنشاء الحساب...':'إنشاء الحساب'}<ArrowLeft size={18}/></button>
      </form>
      <p className="auth-switch">لديك حساب بالفعل؟ <Link to="/login">تسجيل الدخول</Link></p>
    </section>
  </main>;
}
