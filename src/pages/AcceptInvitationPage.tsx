import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, MailCheck, ShieldCheck, Users } from 'lucide-react';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../firebase/config';
import { useAuth } from '../features/auth/auth-context';
import {
  acceptOrganizationInvitation,
  getInvitationForCurrentUser,
  type OrganizationInvitation,
} from '../features/settings/organization-members.service';

const ROLE_LABELS: Record<string, string> = {
  admin: 'مدير المؤسسة',
  broker: 'وسيط تأمين',
  sales: 'المبيعات',
  claims: 'المطالبات',
  finance: 'المالية',
  staff: 'موظف',
};

function errorLabel(value: string) {
  if (value.includes('INVITATION_EMAIL_MISMATCH')) return 'الدعوة مخصصة لبريد إلكتروني مختلف. سجّل الخروج ثم ادخل بالبريد المدعو.';
  if (value.includes('INVITATION_EXPIRED')) return 'انتهت صلاحية الدعوة. اطلب من مدير المؤسسة إرسال دعوة جديدة.';
  if (value.includes('INVITATION_NOT_PENDING')) return 'هذه الدعوة لم تعد معلّقة أو سبق استخدامها.';
  if (value.includes('ACCOUNT_ALREADY_LINKED')) return 'هذا الحساب مرتبط بالفعل بملف مؤسسة. لا يدعم التطبيق حتى الآن ربط حساب واحد بأكثر من مؤسسة.';
  if (value.includes('EMAIL_VERIFICATION_REQUIRED')) return 'تحقق من بريدك الإلكتروني أولًا، ثم ارجع إلى هذه الصفحة.';
  if (value.includes('INVITATION_NOT_FOUND') || value.includes('permission-denied')) return 'تعذر الوصول إلى الدعوة. تأكد من استخدام الحساب المدعو وأن الرابط ما زال صالحًا.';
  return 'تعذر إتمام قبول الدعوة. تحقق من الحساب وحاول مرة أخرى.';
}

export default function AcceptInvitationPage() {
  const { orgId = '', invitationId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [invitation, setInvitation] = useState<OrganizationInvitation | null>(null);
  const [loadedInvitationKey, setLoadedInvitationKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [refresh, setRefresh] = useState(0);

  const invitationKey = `${orgId}/${invitationId}`;
  const shouldLoadInvitation = Boolean(
    !authLoading && user && user.emailVerified && !profile && orgId && invitationId,
  );
  const loading = authLoading || (shouldLoadInvitation && loadedInvitationKey !== invitationKey);
  const currentInvitation = loadedInvitationKey === invitationKey ? invitation : null;

  useEffect(() => {
    if (authLoading || !user || !user.emailVerified || !orgId || !invitationId || profile) return;
    let alive = true;
    void getInvitationForCurrentUser(orgId, invitationId)
      .then((item) => {
        if (!alive) return;
        setInvitation(item);
        setError('');
        setLoadedInvitationKey(invitationKey);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setInvitation(null);
        setError(errorLabel(String((err as Error)?.message || err)));
        setLoadedInvitationKey(invitationKey);
      });
    return () => { alive = false; };
  }, [orgId, invitationId, invitationKey, user, profile, authLoading, refresh]);

  async function sendVerification() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await sendEmailVerification(currentUser);
      setMessage('أرسلنا رسالة تحقق إلى بريدك. افتحها ثم عد إلى هذه الصفحة واضغط «تحققت من البريد».');
    } catch {
      setError('تعذر إرسال رسالة التحقق. تحقق من اتصالك وحاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  async function refreshVerification() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await currentUser.reload();
      await currentUser.getIdToken(true);
      if (!currentUser.emailVerified) {
        setError('لم يؤكد Firebase التحقق بعد. افتح رابط التحقق في بريدك ثم أعد المحاولة.');
      } else {
        setInvitation(null);
        setLoadedInvitationKey(null);
        setRefresh((value) => value + 1);
      }
    } catch {
      setError('تعذر تحديث حالة البريد الإلكتروني.');
    } finally {
      setBusy(false);
    }
  }

  async function accept() {
    if (!user) return;
    setBusy(true);
    setError('');
    try {
      await acceptOrganizationInvitation(orgId, invitationId);
      setMessage('تم قبول الدعوة. جارٍ فتح مساحة العمل...');
      window.location.assign('/');
    } catch (err: unknown) {
      setError(errorLabel(String((err as Error)?.message || err)));
    } finally {
      setBusy(false);
    }
  }

  const next = `${location.pathname}${location.search}`;
  const loginUrl = `/login?next=${encodeURIComponent(next)}`;
  const registerUrl = `/register?next=${encodeURIComponent(next)}`;

  return (
    <main dir="rtl" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: 'var(--inx-bg)' }}>
      <section className="inx-card inx-card-lg" style={{ width: 'min(520px,100%)', padding: 28, display: 'grid', gap: 18 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="inx-icon-circle"><Users size={22} /></span>
          <div>
            <span className="eyebrow">InsurNex · Organization Access</span>
            <h1 style={{ margin: '5px 0 0', color: 'var(--inx-text)', fontSize: 22 }}>دعوة للانضمام إلى مؤسسة</h1>
          </div>
        </header>

        {authLoading || loading ? (
          <div className="inx-empty">جارٍ التحقق من الدعوة...</div>
        ) : !user ? (
          <>
            <p style={{ margin: 0, color: 'var(--inx-text-soft)', lineHeight: 1.8 }}>سجّل الدخول أو أنشئ حسابًا باستخدام البريد الإلكتروني الذي استقبل الدعوة. سيظل الرابط مرتبطًا بهذه الدعوة أثناء تسجيل الدخول.</p>
            <div style={{ display: 'grid', gap: 10 }}>
              <Link className="inx-btn inx-btn-primary inx-btn-block" to={loginUrl}>تسجيل الدخول</Link>
              <Link className="inx-btn inx-btn-secondary inx-btn-block" to={registerUrl}>إنشاء حساب جديد</Link>
            </div>
          </>
        ) : profile ? (
          <div role="status" style={{ border: '1px solid var(--inx-border)', borderRadius: 14, padding: 14, color: 'var(--inx-text-soft)', lineHeight: 1.8 }}>
            هذا الحساب لديه ملف مؤسسة بالفعل. ربط الحساب بأكثر من مؤسسة غير متاح في الإصدار الحالي. استخدم الحساب المدعو الصحيح أو اطلب من مدير المؤسسة مراجعة الدعوة.
          </div>
        ) : !user.emailVerified ? (
          <>
            <div style={{ border: '1px solid var(--inx-border)', borderRadius: 14, padding: 14, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <MailCheck size={22} style={{ color: 'var(--inx-blue)', flexShrink: 0 }} />
              <div style={{ color: 'var(--inx-text-soft)', lineHeight: 1.8 }}>يلزم التحقق من ملكية البريد الإلكتروني قبل عرض تفاصيل الدعوة أو تفعيل عضوية المؤسسة.</div>
            </div>
            {message && <div role="status" style={{ color: 'var(--inx-success)' }}>{message}</div>}
            {error && <div role="alert" style={{ color: 'var(--inx-danger)' }}>{error}</div>}
            <button className="inx-btn inx-btn-primary inx-btn-block" type="button" disabled={busy} onClick={sendVerification}>{busy ? 'جارٍ الإرسال...' : 'إرسال رسالة التحقق'}</button>
            <button className="inx-btn inx-btn-secondary inx-btn-block" type="button" disabled={busy} onClick={refreshVerification}>تحققت من البريد — إعادة الفحص</button>
          </>
        ) : currentInvitation ? (
          <>
            <div style={{ border: '1px solid var(--inx-border)', borderRadius: 14, padding: 16, display: 'grid', gap: 9 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--inx-text)' }}><CheckCircle2 size={18} style={{ color: 'var(--inx-success)' }} /> تمت مطابقة البريد الإلكتروني</div>
              <div><small style={{ color: 'var(--inx-muted)' }}>البريد المدعو</small><div style={{ fontWeight: 700, overflowWrap: 'anywhere' }}>{currentInvitation.invitedEmail}</div></div>
              <div><small style={{ color: 'var(--inx-muted)' }}>الدور داخل المؤسسة</small><div style={{ fontWeight: 700 }}>{ROLE_LABELS[currentInvitation.role] || currentInvitation.role}</div></div>
              <div><small style={{ color: 'var(--inx-muted)' }}>صلاحية الدعوة حتى</small><div>{currentInvitation.expiresAt.toDate().toLocaleString('ar-EG')}</div></div>
            </div>
            <p style={{ margin: 0, color: 'var(--inx-text-soft)', lineHeight: 1.8 }}>بقبول الدعوة سيتم إنشاء ملف عضوية للمؤسسة بهذا الدور. لا تمنح الدعوة صلاحيات مسؤول المنصة.</p>
            {message && <div role="status" style={{ color: 'var(--inx-success)' }}>{message}</div>}
            {error && <div role="alert" style={{ color: 'var(--inx-danger)' }}>{error}</div>}
            <button className="inx-btn inx-btn-primary inx-btn-block" type="button" disabled={busy} onClick={accept}>{busy ? 'جارٍ تفعيل العضوية...' : 'قبول الدعوة والانضمام'}</button>
          </>
        ) : (
          <>
            {error && <div role="alert" style={{ color: 'var(--inx-danger)', lineHeight: 1.8 }}>{error}</div>}
            <button className="inx-btn inx-btn-secondary inx-btn-block" type="button" onClick={() => navigate('/settings')}>العودة إلى InsurNex</button>
          </>
        )}
        <small style={{ display: 'flex', gap: 7, alignItems: 'center', color: 'var(--inx-muted)', lineHeight: 1.7 }}><ShieldCheck size={15} /> الدعوة محدودة المدة ومربوطة بالبريد الإلكتروني والتحقق من الصلاحيات.</small>
      </section>
    </main>
  );
}
