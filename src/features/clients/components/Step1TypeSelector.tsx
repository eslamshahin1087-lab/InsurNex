import { Building2, Check, User } from 'lucide-react';
import type { ClientKind } from '../client.types';

interface Props {
  value: ClientKind;
  onChange: (type: ClientKind) => void;
}

export default function Step1TypeSelector({ value, onChange }: Props) {
  return (
    <div className="step-content">
      <p className="step-intro">
        اختر نوع العميل الذي تريد إضافته. سيتم تكييف النموذج والبيانات
        المطلوبة حسب اختيارك.
      </p>

      <div className="type-cards">
        <button
          type="button"
          className={`type-card ${value === 'individual' ? 'is-selected' : ''}`}
          onClick={() => onChange('individual')}
        >
          {value === 'individual' && (
            <span className="type-check">
              <Check size={14} />
            </span>
          )}
          <span className="type-icon">
            <User size={28} />
          </span>
          <h3>عميل فردي</h3>
          <p>شخص طبيعي يريد تأمينًا شخصيًا</p>
          <ul className="type-features">
            <li>بطاقة الرقم القومي</li>
            <li>رخصة قيادة (إن وُجدت)</li>
            <li>تقارير طبية (حسب الاحتياج)</li>
          </ul>
        </button>

        <button
          type="button"
          className={`type-card ${value === 'corporate' ? 'is-selected' : ''}`}
          onClick={() => onChange('corporate')}
        >
          {value === 'corporate' && (
            <span className="type-check">
              <Check size={14} />
            </span>
          )}
          <span className="type-icon">
            <Building2 size={28} />
          </span>
          <h3>عميل شركات</h3>
          <p>شركة أو مؤسسة تريد تأمينًا تجاريًا</p>
          <ul className="type-features">
            <li>السجل التجاري</li>
            <li>البطاقة الضريبية</li>
            <li>عقد التأسيس وترخيص النشاط</li>
          </ul>
        </button>
      </div>
    </div>
  );
}