import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Crown,
  Home,
  KeyRound,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { signOut } from '../features/auth/auth.service';
import { useSubscription } from '../features/subscription/subscription.hooks';
import { redeemCode } from '../features/subscription/subscription.service';
import { listPlans } from '../features/admin/plans.service';
import type { PricingPlanDoc } from '../features/admin/plans.types';
import { computePricing, formatEGP } from '../features/admin/pricing.config';
import '../theme/admin-pricing.css';

const INSTAPAY = 'islamib2810@instapay';
const VODAFONE_CASH = '01017789594';
const WHATSAPP_CONTACT = '+201123152500';
const SUPPORT_EMAIL = 'eslam.shahin1087@gmail.com';

// Same navigation as AppLayout
const navigation = [
  ['/', 'الرئيسية', Home],
  ['/clients', 'CRM', Users],
  ['/policies', 'الوثائق', ShieldCheck],
  ['/operations', 'العمليات', Settings2],
  ['/copilot', 'الذكاء', Sparkles],
] as const;

function planBadgeText(plan: PricingPlanDoc): string | null {
  if (plan.id === 'yearly' || plan.id === 'yearly_discount') return 'الأكثر توفيرًا';
  return null;
}

export default function SubscriptionPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { subscription, loading, isExpired, daysRemaining, refresh } = useSubscription();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [plans, setPlans] = useState<PricingPlanDoc[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await listPlans();
        const active = rows.filter((p) => p.isActive);
        setPlans(active);
        if (active.length > 0) {
          const sorted = [...active].sort((a, b) => a.subtotal - b.subtotal);
          setSelectedPlanId(sorted[0].id);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setPlansLoading(false);
      }
    })();
  }, []);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];
  const selectedPricing = selectedPlan ? computePricing(selectedPlan.subtotal) : null;

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
          EMPTY_CODE: 'الرجاء إدخال كود التفعيل.',
          CODE_NOT_FOUND: 'الكود غير موجود. تأكد من كتابته بشكل صحيح.',
          CODE_ALREADY_USED: 'هذا الكود تم استخدامه مسبقًا.',
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
      setError('حدث خطأ. الرجاء المحاولة مرة أخرى.');
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

  const statusTone = isExpired ? 'danger' : daysRemaining <= 7 ? 'warning' : 'success';

  const statusLabel = isExpired
    ? 'اشتراكك منتهي'
    : subscription?.status === 'trial'
    ? 'تجربة مجانية نشطة'
    : 'اشتراكك نشط';

  const statusSub = isExpired
    ? 'جدد الآن لمواصلة استخدام المنصة.'
    : `ينتهي في ${subscription?.endDate} (${daysRemaining} يوم متبقٍ)`;

  return (
    <div className="mobile-shell" dir="rtl">
      <main
        style={{
          minHeight: '100vh',
          padding: 20,
          paddingBottom: 110,
          background:
            'radial-gradient(circle at 20% 20%, rgba(58, 107, 159, 0.08), transparent 32%), var(--inx-bg)',
        }}
      >
        <div
          style={{
            maxWidth: 900,
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
                  InsurNex · اختر خطتك
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

          {/* STATUS CARD */}
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
                <h2 style={{ margin: '4px 0 6px', fontSize: 18, color: 'var(--inx-text)' }}>
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

          {/* PLANS */}
          <section className="inx-card inx-card-lg">
            <div className="inx-card-head">
              <h3>
                <Sparkles
                  size={18}
                  style={{
                    verticalAlign: 'middle',
                    marginInlineEnd: 6,
                    color: 'var(--inx-warning)',
                  }}
                />
                خططنا المتاحة
              </h3>
            </div>

            {plansLoading ? (
              <div className="inx-empty">جاري تحميل الخطط...</div>
            ) : plans.length === 0 ? (
              <div className="inx-empty">
                <b>لا توجد خطط متاحة حاليًا</b>
                <small style={{ color: 'var(--inx-muted)' }}>تواصل معنا للاستفسار</small>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  {plans.map((plan) => {
                    const pricing = computePricing(plan.subtotal);
                    const isSelected = selectedPlanId === plan.id;
                    const badge = planBadgeText(plan);

                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`sub-plan-card ${isSelected ? 'is-selected' : ''}`}
                      >
                        {badge && (
                          <span className="sub-plan-badge">
                            <Crown size={11} />
                            {badge}
                          </span>
                        )}

                        {isSelected && (
                          <span className="sub-plan-check">
                            <Check size={14} style={{ color: '#fff' }} />
                          </span>
                        )}

                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 800,
                            color: 'var(--inx-text)',
                            marginBottom: 8,
                          }}
                        >
                          {plan.name}
                        </div>

                        <div
                          style={{
                            fontSize: 26,
                            fontWeight: 900,
                            color: 'var(--inx-blue)',
                            letterSpacing: '-0.5px',
                            lineHeight: 1,
                          }}
                        >
                          {pricing.subtotal}
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: 'var(--inx-text-soft)',
                              marginInlineStart: 4,
                            }}
                          >
                            ج.م
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: 11.5,
                            color: 'var(--inx-muted)',
                            marginTop: 4,
                          }}
                        >
                          + {pricing.vatAmount} ضريبة (14%)
                        </div>

                        <div className="sub-plan-total-divider" />

                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 800,
                            color: 'var(--inx-success)',
                            lineHeight: 1.4,
                          }}
                        >
                          الإجمالي: {pricing.total} ج.م
                        </div>

                        <div
                          style={{
                            fontSize: 11.5,
                            color: 'var(--inx-text-soft)',
                            marginTop: 6,
                          }}
                        >
                          لمدة {plan.duration} يوم
                        </div>

                        {plan.discountNote && (
                          <div
                            style={{
                              marginTop: 8,
                              padding: '3px 8px',
                              background: 'var(--inx-warning-bg)',
                              color: 'var(--inx-warning)',
                              fontSize: 10.5,
                              fontWeight: 800,
                              borderRadius: 999,
                              display: 'inline-block',
                            }}
                          >
                            {plan.discountNote}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div
                  style={{
                    background: 'var(--inx-info-bg)',
                    padding: '10px 14px',
                    borderRadius: 10,
                    fontSize: 12.5,
                    color: 'var(--inx-text-soft)',
                  }}
                >
                  💡 الكود الذي تشتريه منّا يحمل الخطة التي اخترتها. لا حاجة لاختيارها هنا مرة
                  أخرى — اخترنا لك الأرخص افتراضيًا لعرض السعر فقط.
                </div>
              </>
            )}
          </section>

          {/* PAYMENT INFO */}
          {selectedPlan && selectedPricing && (
            <section className="inx-card inx-card-lg">
              <div className="inx-card-head">
                <h3>دفع قيمة اشتراك {selectedPlan.name}</h3>
                <Wallet size={18} style={{ color: 'var(--inx-muted)' }} />
              </div>

              <div
                style={{
                  background: 'var(--inx-navy-bg)',
                  padding: '14px 16px',
                  borderRadius: 12,
                  marginBottom: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--inx-text-soft)' }}>
                  المبلغ المطلوب
                </span>
                <b style={{ fontSize: 22, color: 'var(--inx-blue)' }}>
                  {formatEGP(selectedPricing.total)}
                </b>
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
                <li>حوّل المبلغ على أحد الحسابات:</li>
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
                  أرسل إثبات الدفع على واتساب:{' '}
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
                  أو راسلنا على البريد: <strong>{SUPPORT_EMAIL}</strong>
                </li>
                <li>سنرسل لك كود التفعيل خلال دقائق. أدخله أدناه لتفعيل اشتراكك.</li>
              </ol>
            </section>
          )}

          {/* REDEEM */}
          <section className="inx-card inx-card-lg">
            <div className="inx-card-head">
              <h3>استرداد كود التفعيل</h3>
              <KeyRound size={18} style={{ color: 'var(--inx-muted)' }} />
            </div>

            <form onSubmit={handleRedeem} style={{ display: 'grid', gap: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  border: '1px solid var(--inx-border)',
                  borderRadius: 14,
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
                    borderRadius: 10,
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
                    borderRadius: 10,
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
                {busy ? 'جاري التفعيل...' : 'تفعيل الاشتراك'}
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
              الكود يُرسل بعد تأكيد الدفع. تواصل معنا إذا لم يصلك خلال 15 دقيقة.
            </small>
          </section>

          {/* SUPPORT */}
          <section className="inx-card" style={{ textAlign: 'center' }}>
            <MessageCircle size={22} style={{ color: 'var(--inx-blue)', marginBottom: 6 }} />
            <b style={{ display: 'block', marginBottom: 4 }}>تحتاج مساعدة؟</b>
            <small style={{ color: 'var(--inx-muted)' }}>
              تواصل معنا على {WHATSAPP_CONTACT} أو {SUPPORT_EMAIL}
            </small>
          </section>
        </div>
      </main>

      {/* SAME TABBAR AS AppLayout */}
      <nav
        className="app-tabbar s8-tabbar inx-tabbar-primary"
        aria-label="التنقل السريع"
      >
        {navigation.map(([to, label, Icon]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={to === '/copilot' ? 'nav-copilot' : undefined}
          >
            <Icon size={21} />
            <span>{label}</span>
          </NavLink>
        ))}
        <NavLink to="/more">
          <MoreHorizontal size={22} />
          <span>المزيد</span>
        </NavLink>
      </nav>
    </div>
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
        borderRadius: 14,
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