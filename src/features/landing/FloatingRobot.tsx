import { useState } from 'react';
import { ArrowLeft, Bot, Sparkles, X } from 'lucide-react';

type TourStep = {
  id: string;
  title: string;
  description: string;
  action?: 'scroll' | 'navigate';
  target?: string;
};

const STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'مرحبًا! أنا InsurNex Bot 🤖',
    description:
      'هل ترغب في جولة سريعة أشرح لك فيها الميزات الرئيسية؟ تستغرق 20 ثانية فقط.',
  },
  {
    id: 'features',
    title: 'هنا كل الميزات',
    description:
      'CRM، الوثائق، المطالبات، التجديدات، والمساعد الذكي — كل شيء في مكان واحد.',
    action: 'scroll',
    target: 'features',
  },
  {
    id: 'pricing',
    title: '300 ج.م شهريًا فقط',
    description:
      'باقة واحدة تضم كل الميزات. ابدأ بـ 30 يوم مجانية بدون بطاقة بنكية.',
    action: 'scroll',
    target: 'pricing',
  },
  {
    id: 'cta',
    title: 'جاهز للبدء؟',
    description:
      'اضغط على "أنشئ حسابك الآن" للانطلاق. لا تتردد — التجربة مجانية!',
    action: 'scroll',
    target: 'cta',
  },
];

export default function FloatingRobot() {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [started, setStarted] = useState(false);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  function startTour() {
    setStarted(true);
    setStepIndex(1);
    scrollToStep(STEPS[1]);
  }

  function next() {
    if (isLast) {
      setOpen(false);
      setStarted(false);
      setStepIndex(0);
      return;
    }
    const nextIdx = stepIndex + 1;
    setStepIndex(nextIdx);
    scrollToStep(STEPS[nextIdx]);
  }

  function close() {
    setOpen(false);
    setStarted(false);
    setStepIndex(0);
  }

  function scrollToStep(s: TourStep) {
    if (s.action !== 'scroll' || !s.target) return;
    const el = document.getElementById(s.target);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="landing-robot-wrapper" dir="rtl">
      {open && (
        <div className="landing-robot-bubble">
          <button
            type="button"
            className="landing-robot-close"
            onClick={close}
            aria-label="إغلاق"
          >
            <X size={14} />
          </button>

          <div className="landing-robot-bubble-head">
            <span className="landing-robot-bubble-icon">
              <Sparkles size={16} />
            </span>
            <div>
              <b>{step.title}</b>
              {started && (
                <small>
                  {stepIndex} / {STEPS.length - 1}
                </small>
              )}
            </div>
          </div>

          <p className="landing-robot-bubble-text">{step.description}</p>

          <div className="landing-robot-bubble-actions">
            {!started ? (
              <>
                <button
                  type="button"
                  className="inx-btn inx-btn-primary inx-btn-sm"
                  onClick={startTour}
                >
                  هيا نبدأ
                  <ArrowLeft size={13} />
                </button>
                <button
                  type="button"
                  className="inx-btn inx-btn-ghost inx-btn-sm"
                  onClick={close}
                >
                  ربما لاحقًا
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="inx-btn inx-btn-primary inx-btn-sm"
                  onClick={next}
                >
                  {isLast ? 'إنهاء الجولة' : 'التالي'}
                  <ArrowLeft size={13} />
                </button>
                <button
                  type="button"
                  className="inx-btn inx-btn-ghost inx-btn-sm"
                  onClick={close}
                >
                  تخطي
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        className={`landing-robot-fab ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="مساعد InsurNex"
        title="مساعد InsurNex"
      >
        <Bot size={26} />
      </button>
    </div>
  );
}