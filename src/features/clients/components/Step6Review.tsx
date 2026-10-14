import { AlertTriangle, CheckCircle2, Shield } from 'lucide-react';
import type {
  ClientWizardInput,
  RiskAssessment,
} from '../client.types';
import { calculateCompleteness } from '../risk-assessment.service';

interface Props {
  data: ClientWizardInput;
  riskAssessment: RiskAssessment;
}

export default function Step6Review({ data, riskAssessment }: Props) {
  const completeness = calculateCompleteness(data);

  const clientName =
    data.type === 'individual'
      ? data.individual?.fullName || 'بدون اسم'
      : data.corporate?.companyName || 'بدون اسم';

  const levelColor =
    riskAssessment.level === 'low'
      ? 'var(--inx-success)'
      : riskAssessment.level === 'medium'
      ? 'var(--inx-warning)'
      : 'var(--inx-danger)';

  const levelLabel =
    riskAssessment.level === 'low'
      ? 'منخفضة'
      : riskAssessment.level === 'medium'
      ? 'متوسطة'
      : 'مرتفعة';

  return (
    <div className="step-content">
      <p className="step-intro">
        راجع البيانات قبل الإنشاء. يمكنك العودة لأي خطوة للتعديل.
      </p>

      {/* HEADER SUMMARY */}
      <section className="review-card">
        <header className="review-head">
          <h3>{clientName}</h3>
          <span
            className={`inx-badge inx-badge-${
              data.type === 'individual' ? 'primary' : 'purple'
            }`}
          >
            {data.type === 'individual' ? 'فردي' : 'شركات'}
          </span>
        </header>

        <div className="review-grid">
          <ReviewItem
            label="الاحتياجات"
            value={`${data.needs.length} احتياج`}
          />
          <ReviewItem
            label="المستندات"
            value={`${data.documents.length} مرفوع`}
          />
          <ReviewItem
            label="اكتمال البيانات"
            value={`${completeness}%`}
          />
          <ReviewItem
            label="طريقة التواصل"
            value={
              data.preferences.contactMethod === 'whatsapp'
                ? 'واتساب'
                : data.preferences.contactMethod === 'call'
                ? 'مكالمة'
                : 'بريد'
            }
          />
        </div>
      </section>

      {/* COMPLETENESS BAR */}
      <section className="review-card">
        <div className="review-progress-head">
          <span>اكتمال البيانات</span>
          <b>{completeness}%</b>
        </div>
        <div className="review-progress-bar">
          <span
            style={{
              width: `${completeness}%`,
              background:
                completeness >= 85
                  ? 'var(--inx-success)'
                  : completeness >= 60
                  ? 'var(--inx-warning)'
                  : 'var(--inx-danger)',
            }}
          />
        </div>
      </section>

      {/* RISK ASSESSMENT */}
      <section className="review-card">
        <header className="review-head">
          <h3>
            <Shield
              size={18}
              style={{ verticalAlign: 'middle', marginInlineEnd: 6 }}
            />
            تقييم المخاطر
          </h3>
        </header>

        <div className="risk-score-block">
          <div className="risk-score-circle">
            <div
              className="risk-score-value"
              style={{ color: levelColor }}
            >
              {riskAssessment.score}
            </div>
            <small>من 100</small>
          </div>
          <div className="risk-score-copy">
            <span className="risk-level-label">مستوى المخاطر</span>
            <b style={{ color: levelColor }}>{levelLabel}</b>
            <small style={{ color: 'var(--inx-muted)' }}>
              درجة أعلى = مخاطر أقل
            </small>
          </div>
        </div>

        {riskAssessment.factors.length > 0 && (
          <div className="risk-factors">
            <span className="risk-factors-title">عوامل مؤثرة:</span>
            <ul>
              {riskAssessment.factors.map((f, i) => (
                <li key={i} className={`risk-factor factor-${f.severity}`}>
                  <AlertTriangle size={12} />
                  {f.name}
                  <span className="factor-impact">-{f.impact}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* NEEDS LIST */}
      <section className="review-card">
        <h3>الاحتياجات المحددة</h3>
        <ul className="review-needs">
          {data.needs.map((n) => (
            <li key={n}>
              <CheckCircle2 size={14} style={{ color: 'var(--inx-success)' }} />
              {needLabel(n)}
            </li>
          ))}
        </ul>
      </section>

      {/* POST-CREATE NOTE */}
      <div className="review-note">
        <b>💡 بعد الإنشاء:</b> سيفتح المساعد الذكي تلقائيًا ويعرض لك تحليلًا
        سريعًا عن العميل واحتياجاته وتوصيات المنتجات المناسبة.
      </div>
    </div>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="review-item">
      <small>{label}</small>
      <b>{value}</b>
    </div>
  );
}

function needLabel(need: string): string {
  const map: Record<string, string> = {
    motor: '🚗 تأمين سيارات',
    health: '🏥 تأمين صحي',
    life: '👨‍👩‍👧 تأمين حياة',
    property: '🏠 تأمين ممتلكات',
    travel: '✈️ تأمين سفر',
    business: '🏢 تأمين تجاري',
    'professional-liability': '⚖️ مسؤولية مهنية',
    equipment: '🏗️ معدات وآلات',
    cyber: '🛡️ تأمين سيبراني',
  };
  return map[need] || need;
}