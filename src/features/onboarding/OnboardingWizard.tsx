import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  Rocket,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import {
  advanceStep,
  completeOnboarding,
  getOnboardingProgress,
  skipStep,
  startOnboarding,
} from './onboarding.service';

interface StepDef {
  number: number;
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
  ctaLabel?: string;
  ctaPath?: string;
  icon: typeof Rocket;
  tone: string;
}

const STEPS: StepDef[] = [
  {
    number: 1,
    eyebrow: 'أهلاً بك في InsurNex',
    title: 'ابدأ رحلتك كوسيط احترافي',
    description:
      'InsurNex هو مركز التشغيل الرقمي الكامل لمكتبك. سنأخذك في 4 خطوات سريعة لتتعرف على الميزات الأساسية.',
    points: [
      'إدارة العملاء والوثائق في مكان واحد',
      'متابعة التجديدات والمطالبات تلقائيًا',
      'مساعد ذكي يجيبك على أي سؤال داخل المنصة',
    ],
    icon: Rocket,
    tone: 'tone-cyan',
  },
  {
    number: 2,
    eyebrow: 'الخطوة 1 من 3',
    title: 'أضف عميلك الأول',
    description:
      'كل شيء في InsurNex يبدأ من العميل. أضف أول عميل لك لتجرب دورة العمل كاملة.',
    points: [
      'يمكنك إضافة أفراد أو شركات',
      'كل عميل له ملف كامل (بيانات، وثائق، مطالبات)',
      'البيانات معزولة تمامًا بين المؤسسات',
    ],
    ctaLabel: 'افتح قسم العملاء',
    ctaPath: '/clients',
    icon: Users,
    tone: 'tone-primary',
  },
  {
    number: 3,
    eyebrow: 'الخطوة 2 من 3',
    title: 'أنشئ وثيقتك الأولى',
    description:
      'أنشئ أول وثيقة تأمين لعميلك، وسيتابع النظام تنبيهات التجديد تلقائيًا.',
    points: [
      'يدعم كل خطوط التأمين (طبي، سيارات، ممتلكات، حياة)',
      'تنبيهات تلقائية قبل الانتهاء بـ 30/60/90 يوم',
      'تتبع الأقساط والعمولات لكل وثيقة',
    ],
    ctaLabel: 'افتح قسم الوثائق',
    ctaPath: '/policies',
    icon: ShieldCheck,
    tone: 'tone-success',
  },
  {
    number: 4,
    eyebrow: 'الخطوة 3 من 3',
    title: 'جرّب المساعد الذكي',
    description:
      'InsurNex AI Copilot يفهم عملك وبياناتك. اسأله عن أي عميل أو وثيقة أو مطالبة.',
    points: [
      'يعمل من أي صفحة في التطبيق',
      'يحفظ سياق المحادثة',
      'يجيب بالعربية بأرقام حقيقية من بياناتك',
    ],
    ctaLabel: 'افتح المساعد الذكي',
    ctaPath: '/copilot',
    icon: Sparkles,
    tone: 'tone-purple',
  },
  {
    number: 5,
    eyebrow: 'كل شيء جاهز',
    title: 'أنت الآن جاهز للانطلاق!',
    description:
      'يمكنك الآن إدارة مكتبك بالكامل من InsurNex. لا تنسَ تجربة باقي الأدوات في قسم "المزيد".',
    points: [
      'الإدارة المالية لمتابعة العمولات',
      'العمليات لتنظيم دورة العمل',
      'تحليل ملفات التأمين بالذكاء الاصطناعي',
    ],
    icon: CheckCircle2,
    tone: 'tone-success',
  },
];

export default function OnboardingWizard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.uid || !profile?.organizationId) return;
    (async () => {
      try {
        const prog = await getOnboardingProgress(user.uid);
        if (!prog) {
          await startOnboarding(user.uid, profile.organizationId);
          setStepIndex(0);
        } else if (prog.completed) {
          navigate('/', { replace: true });
          return;
        } else {
          setStepIndex(
            Math.max(0, Math.min(STEPS.length - 1, prog.currentStep - 1)),
          );
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid, profile?.organizationId, navigate]);

  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;
  const StepIcon = step.icon;

  async function goNext() {
    if (!user?.uid) return;
    setBusy(true);
    try {
      if (isLast) {
        await completeOnboarding(user.uid);
        navigate('/', { replace: true });
        return;
      }
      const nextIdx = stepIndex + 1;
      await advanceStep(user.uid, STEPS[nextIdx].number);
      setStepIndex(nextIdx);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function goBack() {
    if (!user?.uid || isFirst) return;
    setBusy(true);
    try {
      const prevIdx = stepIndex - 1;
      await advanceStep(user.uid, STEPS[prevIdx].number);
      setStepIndex(prevIdx);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    if (!user?.uid || isLast) return;
    setBusy(true);
    try {
      await skipStep(user.uid, step.number);
      const nextIdx = stepIndex + 1;
      if (nextIdx >= STEPS.length - 1) {
        await completeOnboarding(user.uid);
        navigate('/', { replace: true });
        return;
      }
      await advanceStep(user.uid, STEPS[nextIdx].number);
      setStepIndex(nextIdx);
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  function openSection() {
    if (!step.ctaPath) return;
    navigate(step.ctaPath);
  }

  async function skipAll() {
    if (!user?.uid) return;
    setBusy(true);
    try {
      await completeOnboarding(user.uid);
      navigate('/', { replace: true });
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-container">
          <div className="inx-empty">
            <b>جاري التحضير...</b>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        minHeight: '100vh',
        padding: 20,
        display: 'grid',
        placeItems: 'center',
        background:
          'radial-gradient(circle at 20% 20%, rgba(58, 107, 159, 0.08), transparent 32%), var(--inx-bg)',
      }}
    >
      <div style={{ width: 'min(560px, 100%)', display: 'grid', gap: 16 }}>
        {/* Progress indicator */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            justifyContent: 'center',
          }}
        >
          {STEPS.map((_, idx) => (
            <span
              key={idx}
              style={{
                width: idx === stepIndex ? 28 : 10,
                height: 10,
                borderRadius: 999,
                background:
                  idx <= stepIndex
                    ? 'var(--inx-gradient)'
                    : 'var(--inx-border)',
                transition: 'all 0.3s',
              }}
            />
          ))}
        </div>

        {/* Content card */}
        <section
          className="inx-card inx-card-lg"
          style={{ padding: 28, textAlign: 'center' }}
        >
          <span
            className={`inx-icon-circle inx-icon-circle-lg ${step.tone}`}
            style={{ margin: '0 auto 16px', width: 72, height: 72 }}
          >
            <StepIcon size={32} />
          </span>

          <span className="eyebrow">{step.eyebrow}</span>
          <h1
            style={{
              margin: '10px 0 12px',
              fontSize: 24,
              fontWeight: 800,
              color: 'var(--inx-text)',
            }}
          >
            {step.title}
          </h1>
          <p
            style={{
              margin: '0 0 20px',
              color: 'var(--inx-muted)',
              fontSize: 14,
              lineHeight: 1.85,
              maxWidth: 480,
              marginInline: 'auto',
            }}
          >
            {step.description}
          </p>

          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '0 0 24px',
              display: 'grid',
              gap: 10,
              textAlign: 'right',
              maxWidth: 460,
              marginInline: 'auto',
            }}
          >
            {step.points.map((p) => (
              <li
                key={p}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 12px',
                  background: 'var(--inx-bg)',
                  borderRadius: 'var(--inx-radius, 14px)',
                  border: '1px solid var(--inx-border)',
                  fontSize: 13.5,
                  color: 'var(--inx-text)',
                }}
              >
                <CheckCircle2
                  size={18}
                  style={{
                    color: 'var(--inx-success)',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                />
                <span style={{ lineHeight: 1.6 }}>{p}</span>
              </li>
            ))}
          </ul>

          {/* Primary CTA (open section) */}
          {step.ctaLabel && step.ctaPath && (
            <button
              type="button"
              className="inx-btn inx-btn-primary inx-btn-block"
              onClick={openSection}
              style={{ padding: '13px 16px', fontSize: 14.5, marginBottom: 12 }}
            >
              {step.ctaLabel}
              <ChevronLeft size={16} />
            </button>
          )}

          {/* Nav buttons */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'space-between',
              flexWrap: 'wrap',
            }}
          >
            {!isFirst && (
              <button
                type="button"
                className="inx-btn inx-btn-secondary"
                onClick={() => void goBack()}
                disabled={busy}
              >
                <ArrowLeft size={14} /> السابق
              </button>
            )}
            <div style={{ display: 'flex', gap: 8, marginInlineStart: 'auto' }}>
              {!isFirst && !isLast && (
                <button
                  type="button"
                  className="inx-btn inx-btn-ghost"
                  onClick={() => void skip()}
                  disabled={busy}
                >
                  تخطي
                </button>
              )}
              <button
                type="button"
                className="inx-btn inx-btn-primary"
                onClick={() => void goNext()}
                disabled={busy}
              >
                {isLast ? 'ابدأ العمل' : 'التالي'}
                {!isLast && <ChevronLeft size={14} />}
              </button>
            </div>
          </div>
        </section>

        {/* Skip all */}
        {!isLast && (
          <button
            type="button"
            onClick={() => void skipAll()}
            disabled={busy}
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--inx-muted)',
              fontSize: 12.5,
              cursor: 'pointer',
              textDecoration: 'underline',
              alignSelf: 'center',
            }}
          >
            تخطي الإعداد والبدء مباشرة
          </button>
        )}
      </div>
    </main>
  );
}