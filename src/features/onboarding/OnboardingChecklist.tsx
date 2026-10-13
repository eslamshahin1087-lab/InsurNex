import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Circle, Sparkles, X } from 'lucide-react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { useAuth } from '../auth/auth-context';
import { db } from '../../firebase/config';

interface Step {
  key: string;
  label: string;
  description: string;
  done: boolean;
  to: string;
}

interface Props {
  clientsCount: number;
  policiesCount: number;
}

const DISMISS_KEY = 'insurnex-checklist-dismissed-at';
const DISMISS_DAYS = 7;

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    const ageDays = (Date.now() - ts) / 86400000;
    return ageDays < DISMISS_DAYS;
  } catch {
    return false;
  }
}

export default function OnboardingChecklist({ clientsCount, policiesCount }: Props) {
  const { user } = useAuth();
  const [hasUsedCopilot, setHasUsedCopilot] = useState(false);
  const [checked, setChecked] = useState(false);
  const [dismissed, setDismissed] = useState(isDismissed());

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const q = query(
          collection(db, 'copilotConversations'),
          where('userId', '==', user.uid),
          limit(1),
        );
        const s = await getDocs(q);
        setHasUsedCopilot(s.size > 0);
      } catch {
        setHasUsedCopilot(false);
      } finally {
        setChecked(true);
      }
    })();
  }, [user?.uid]);

  function handleDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  const steps: Step[] = [
    {
      key: 'account',
      label: 'إنشاء الحساب',
      description: 'تم',
      done: true,
      to: '/',
    },
    {
      key: 'org',
      label: 'إعداد المؤسسة',
      description: 'تم',
      done: true,
      to: '/settings',
    },
    {
      key: 'client',
      label: 'أضف أول عميل',
      description: 'ابدأ بإضافة عميل لمحفظتك',
      done: clientsCount > 0,
      to: '/clients',
    },
    {
      key: 'policy',
      label: 'أنشئ أول وثيقة',
      description: 'أنشئ وثيقة تأمين لعميلك',
      done: policiesCount > 0,
      to: '/policies',
    },
    {
      key: 'copilot',
      label: 'جرّب المساعد الذكي',
      description: 'اسأل Copilot عن أي شيء',
      done: hasUsedCopilot,
      to: '/copilot',
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const percent = Math.round((completed / total) * 100);

  // Don't show if loading, dismissed, or fully completed
  if (!checked) return null;
  if (dismissed) return null;
  if (completed === total) return null;

  return (
    <section
      className="inx-card inx-card-lg"
      style={{ marginBottom: 16, position: 'relative' }}
    >
      {/* HEADER */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="inx-icon-circle tone-primary">
            <Sparkles size={18} />
          </span>
          <div>
            <b
              style={{
                display: 'block',
                fontSize: 14,
                color: 'var(--inx-text)',
              }}
            >
              أكمل إعداد InsurNex
            </b>
            <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
              {completed} من {total} خطوات مكتملة
            </small>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="inx-badge inx-badge-primary">{percent}%</span>
          <button
            type="button"
            className="inx-icon-btn"
            onClick={handleDismiss}
            title="إخفاء لـ 7 أيام"
            style={{ width: 30, height: 30 }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* PROGRESS */}
      <div className="inx-progress" style={{ marginBottom: 14 }}>
        <span style={{ width: `${percent}%` }} />
      </div>

      {/* STEPS */}
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'grid',
          gap: 8,
        }}
      >
        {steps.map((step) => {
          if (step.done) {
            return (
              <li
                key={step.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  background: 'var(--inx-bg)',
                  border: '1px solid var(--inx-border)',
                  borderRadius: 'var(--inx-radius, 14px)',
                  opacity: 0.85,
                }}
              >
                <CheckCircle2
                  size={18}
                  style={{ color: 'var(--inx-success)', flexShrink: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <b
                    style={{
                      fontSize: 13,
                      color: 'var(--inx-text)',
                      fontWeight: 700,
                    }}
                  >
                    {step.label}
                  </b>
                </div>
                <span
                  className="inx-badge inx-badge-success"
                  style={{ fontSize: 10.5 }}
                >
                  تم
                </span>
              </li>
            );
          }

          return (
            <li key={step.key}>
              <Link
                to={step.to}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  background: 'var(--inx-surface)',
                  border: '1px solid var(--inx-blue)',
                  borderRadius: 'var(--inx-radius, 14px)',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background 0.15s',
                }}
              >
                <Circle
                  size={18}
                  style={{ color: 'var(--inx-blue)', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b
                    style={{
                      display: 'block',
                      fontSize: 13,
                      color: 'var(--inx-text)',
                      fontWeight: 700,
                      marginBottom: 2,
                    }}
                  >
                    {step.label}
                  </b>
                  <small
                    style={{
                      color: 'var(--inx-muted)',
                      fontSize: 11.5,
                    }}
                  >
                    {step.description}
                  </small>
                </div>
                <ArrowLeft
                  size={16}
                  style={{ color: 'var(--inx-blue)', flexShrink: 0 }}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}