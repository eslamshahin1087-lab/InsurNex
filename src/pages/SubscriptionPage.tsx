import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Copy,
  KeyRound,
  LogOut,
  MessageCircle,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { signOut } from '../features/auth/auth.service';
import { useSubscription } from '../features/subscription/subscription.hooks';
import { redeemCode } from '../features/subscription/subscription.service';

const PRICE = 300;
const CURRENCY = 'EGP';
const INSTAPAY = 'islamib2810@instapay';
const VODAFONE_CASH = '01017789594';
const WHATSAPP_CONTACT = '+201123152500';
const SUPPORT_EMAIL = 'eslam.shahin1087@gmail.com';

export default function SubscriptionPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { subscription, loading, isExpired, daysRemaining, refresh } = useSubscription();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  };

  async function handleRedeem(e: FormEvent) {
    e.preventDefault();
    if (!user || !profile?.organizationId) return;
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      const result = await redeemCode({
        code,
        organizationId: profile.organizationId,
        uid: user.uid,
        userName: profile.displayName,
      });

      if (!result.success) {
        const messages: Record<string, string> = {
          EMPTY_CODE: 'الرجاء إدخال كود الاشتراك.',
          CODE_NOT_FOUND: 'الكود غير موجود. تحقق من الأحرف.',
          CODE_ALREADY_USED: 'هذا الكود مستخدم بالفعل.',
          CODE_REVOKED: 'هذا الكود ملغى.',
        };
        setError(messages[result.error || ''] || 'تعذر استخدام الكود.');
        return;
      }

      setSuccess(
        `تم تفعيل اشتراكك بنجاح! ينتهي في ${result.newEndDate} (+${result.daysAdded} يوم)`,
      );
      setCode('');
      await refresh();
    } catch (err) {
      console.error(err);
      setError('حدث خطأ. حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  if (loading) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-container">
          <div className="inx-empty">
            <RefreshCw size={28} />
            <b>جاري تحميل الاشتراك...</b>
          </div>
        </div>
      </main>
    );
  }

  const statusTone = isExpired
    ? 'danger'
    : daysRemaining <= 7
    ? 'warning'
    : 'success';

  const statusLabel = isExpired
    ? 'اشتراكك منتهي'
    : subscription?.status === 'trial'
    ? 'تجربة مجانية نشطة'
    : 'اشتراك نشط';

  const statusSub = isExpired
    ? 'جدد الآن لمواصلة استخدام جميع الميزات'
    : `ينتهي في ${subscription?.endDate} (${daysRemaining} يوم متبقٍ)`;

  return (
    <main
      dir="rtl"
      style={{
        minHeight: '100vh',
        padding: 20,
        background:
          'radial-gradient(circle at 20% 20%, rgba(2, 159, 233, 0.08), transparent 32%), var(--inx-bg)',
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          display: 'grid',
          gap: 16,
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src="/branding/logo-light.png"
              alt="InsurNex"
              style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 12 }}
            />
            <div>
              <strong style={{ display: 'block', fontSize: 15, color: 'var(--inx-text)' }}>
                إدارة الاشتراك
              </strong>
              <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
                InsurNex · {PRICE} {CURRENCY} / شهر
              </small>
            </div>
          </div>
          <button
            type="button"
            className="inx-icon-btn"
            onClick={() => void handleSignOut()}
            title="تسجيل الخروج"
          >
            <LogOut size={17} />
          </button>
        </header>

        <section
          className="inx-card inx-card-lg"
          style={{
            borderColor:
              statusTone === 'danger'
                ? 'var(--inx-danger)'
                : statusTone === 'warning'
                ? 'var(--inx-warning)'
                : 'var(--inx-success)',
          }}
        >
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <span
              className={`inx-icon-circle inx-icon-circle-lg ${
                statusTone === 'danger'
                  ? 'tone-danger'
                  : statusTone === 'warning'
                  ? 'tone-warning'
                  : 'tone-success'
              }`}
            >
              {isExpired ? (
                <AlertCircle size={24} />
              ) : daysRemaining <= 7 ? (
                <Clock3 size={24} />
              ) : (
                <CheckCircle2 size={24} />
              )}
            </span>
            <div style={{ flex: 1, minWidth: 200 }}>
              <span className="eyebrow">حالة الاشتراك</span>
              <h2
                style={{
                  margin: '4px 0 6px',
                  fontSize: 18,
                  color: 'var(--inx-text)',
                }}
              >
                {statusLabel}
              </h2>
              <small style={{ color: 'var(--inx-muted)', fontSize: 12.5 }}>
                {statusSub}
              </small>
            </div>
            <button
              type="button"
              className="inx-icon-btn"
              onClick={() => void refresh()}
              title="تحديث"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </section>

        <section className="inx-card inx-card-lg">
          <div className="inx-card-head">
            <h3>كيف تُجدد اشتراكك؟</h3>
            <Wallet size={18} style={{ color: 'var(--inx-muted)' }} />
          </div>

          <ol
            style={{
              paddingInlineStart: 20,
              margin: '0 0 14px',
              color: 'var(--inx-text)',
              lineHeight: 1.9,
              fontSize: 13.5,
            }}
          >
            <li>
              حوّل <strong>{PRICE} {CURRENCY}</strong> عبر إحدى الوسائل التالية:
            </li>
          </ol>

          <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
            <PaymentRow
              label="InstaPay"
              value={INSTAPAY}
              copied={copied === 'instapay'}
              onCopy={() => void copyToClipboard(INSTAPAY, 'instapay')}
            />
            <PaymentRow
              label="Vodafone Cash"
              value={VODAFONE_CASH}
              copied={copied === 'vodafone'}
              onCopy={() => void copyToClipboard(VODAFONE_CASH, 'vodafone')}
            />
          </div>

          <ol
            start={2}
            style={{
              paddingInlineStart: 20,
              margin: '0 0 10px',
              color: 'var(--inx-text)',
              lineHeight: 1.9,
              fontSize: 13.5,
            }}
          >
            <li>
              أرسل صورة الإيصال على واتساب:{' '}
              <a
                href={`https://wa.me/${WHATSAPP_CONTACT.replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--inx-blue)', fontWeight: 700 }}
              >
                {WHATSAPP_CONTACT}
              </a>
            </li>
            <li>
              أو بالبريد: <strong>{SUPPORT_EMAIL}</strong>
            </li>
            <li>سيصلك كود الاشتراك خلال دقائق — أدخله بالأسفل.</li>
          </ol>
        </section>

        <section className="inx-card inx-card-lg">
          <div className="inx-card-head">
            <h3>إدخال كود الاشتراك</h3>
            <KeyRound size={18} style={{ color: 'var(--inx-muted)' }} />
          </div>

          <form onSubmit={handleRedeem} style={{ display: 'grid', gap: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: '1px solid var(--inx-border)',
                borderRadius: 'var(--inx-radius, 14px)',
                padding: '0 12px',
                background: 'var(--inx-surface)',
              }}
            >
              <KeyRound size={18} style={{ color: 'var(--inx-muted)' }} />
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="INX-XXXX-XXXX"
                style={{
                  flex: 1,
                  border: 0,
                  outline: 0,
                  padding: '14px 0',
                  background: 'transparent',
                  color: 'var(--inx-text)',
                  fontSize: 16,
                  letterSpacing: 1.5,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                }}
              />
            </div>

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

            {success && (
              <div
                role="alert"
                style={{
                  background: 'var(--inx-success-bg)',
                  color: 'var(--inx-success)',
                  border: '1px solid var(--inx-success)',
                  padding: '10px 12px',
                  borderRadius: 'var(--inx-radius-sm, 10px)',
                  fontSize: 12.5,
                  fontWeight: 700,
                }}
              >
                {success}
              </div>
            )}

            <button
              type="submit"
              className="inx-btn inx-btn-primary inx-btn-block"
              disabled={busy || !code.trim()}
              style={{ padding: '13px 16px', fontSize: 14.5 }}
            >
              {busy ? 'جاري التحقق...' : 'تفعيل الاشتراك'}
            </button>
          </form>

          <small
            style={{
              display: 'block',
              marginTop: 12,
              color: 'var(--inx-muted)',
              fontSize: 12,
            }}
          >
            الكود يُصدر بعد تأكيد الدفع ويُرسل لك عبر واتساب أو البريد.
          </small>
        </section>

        <section className="inx-card" style={{ textAlign: 'center' }}>
          <MessageCircle
            size={22}
            style={{ color: 'var(--inx-blue)', marginBottom: 6 }}
          />
          <b style={{ display: 'block', marginBottom: 4 }}>بحاجة لمساعدة؟</b>
          <small style={{ color: 'var(--inx-muted)' }}>
            تواصل معنا على واتساب {WHATSAPP_CONTACT} أو {SUPPORT_EMAIL}
          </small>
        </section>
      </div>
    </main>
  );
}

function PaymentRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: 'var(--inx-bg)',
        border: '1px solid var(--inx-border)',
        borderRadius: 'var(--inx-radius, 14px)',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontSize: 12.5, color: 'var(--inx-muted)', minWidth: 100 }}>
        {label}
      </span>
      <span
        style={{
          flex: 1,
          fontFamily: 'monospace',
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--inx-text)',
          wordBreak: 'break-all',
        }}
      >
        {value}
      </span>
      <button
        type="button"
        className="inx-icon-btn"
        onClick={onCopy}
        title="نسخ"
      >
        {copied ? (
          <CheckCircle2 size={16} style={{ color: 'var(--inx-success)' }} />
        ) : (
          <Copy size={16} />
        )}
      </button>
    </div>
  );
}