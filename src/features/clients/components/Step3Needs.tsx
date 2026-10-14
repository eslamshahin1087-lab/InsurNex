import type { ClientKind, InsuranceNeed } from '../client.types';

interface NeedOption {
  id: InsuranceNeed;
  label: string;
  icon: string;
  availableFor: ClientKind[];
}

const NEEDS: NeedOption[] = [
  { id: 'motor', label: 'تأمين سيارات', icon: '🚗', availableFor: ['individual', 'corporate'] },
  { id: 'health', label: 'تأمين صحي', icon: '🏥', availableFor: ['individual', 'corporate'] },
  { id: 'life', label: 'تأمين حياة', icon: '👨‍👩‍👧', availableFor: ['individual', 'corporate'] },
  { id: 'property', label: 'تأمين ممتلكات', icon: '🏠', availableFor: ['individual', 'corporate'] },
  { id: 'travel', label: 'تأمين سفر', icon: '✈️', availableFor: ['individual'] },
  { id: 'business', label: 'تأمين تجاري شامل', icon: '🏢', availableFor: ['corporate'] },
  { id: 'professional-liability', label: 'مسؤولية مهنية', icon: '⚖️', availableFor: ['corporate'] },
  { id: 'equipment', label: 'معدات وآلات', icon: '🏗️', availableFor: ['corporate'] },
  { id: 'cyber', label: 'تأمين سيبراني', icon: '🛡️', availableFor: ['corporate'] },
];

interface Props {
  type: ClientKind;
  needs: InsuranceNeed[];
  onToggle: (need: InsuranceNeed) => void;
}

export default function Step3Needs({ type, needs, onToggle }: Props) {
  const available = NEEDS.filter((n) => n.availableFor.includes(type));

  return (
    <div className="step-content">
      <p className="step-intro">
        اختر احتياجات العميل التأمينية. ستُطلب بيانات إضافية ومستندات محددة
        حسب كل احتياج.
      </p>

      <div className="needs-grid">
        {available.map((need) => {
          const isSelected = needs.includes(need.id);
          return (
            <button
              key={need.id}
              type="button"
              className={`need-card ${isSelected ? 'is-selected' : ''}`}
              onClick={() => onToggle(need.id)}
            >
              <span className="need-icon">{need.icon}</span>
              <span className="need-label">{need.label}</span>
              <span className={`need-check ${isSelected ? 'on' : ''}`}>
                {isSelected ? '✓' : ''}
              </span>
            </button>
          );
        })}
      </div>

      {needs.length === 0 && (
        <div className="wizard-hint">
          💡 اختر احتياجًا واحدًا على الأقل للمتابعة
        </div>
      )}
    </div>
  );
}