import type { ClientKind, InsuranceNeed } from './client.types';

export interface DocumentRequirement {
  type: string;
  label: string;
  description?: string;
  required: boolean;
}

/**
 * Required documents per client type and selected needs.
 * ALL are mandatory unless explicitly marked optional.
 */
export function getRequiredDocuments(
  kind: ClientKind,
  needs: InsuranceNeed[],
): DocumentRequirement[] {
  if (kind === 'individual') {
    const docs: DocumentRequirement[] = [
      {
        type: 'national-id-front',
        label: 'بطاقة الرقم القومي (الوجه)',
        description: 'صورة واضحة للوجه الأمامي',
        required: true,
      },
      {
        type: 'national-id-back',
        label: 'بطاقة الرقم القومي (الظهر)',
        description: 'صورة واضحة للوجه الخلفي',
        required: true,
      },
    ];

    if (needs.includes('motor')) {
      docs.push({
        type: 'driver-license',
        label: 'رخصة القيادة',
        description: 'سارية المفعول',
        required: true,
      });
      docs.push({
        type: 'vehicle-license',
        label: 'رخصة السيارة',
        required: true,
      });
    }

    if (needs.includes('health')) {
      docs.push({
        type: 'medical-report',
        label: 'تقرير طبي حديث',
        description: 'خلال آخر 6 أشهر',
        required: true,
      });
    }

    if (needs.includes('life')) {
      docs.push({
        type: 'income-proof',
        label: 'إثبات الدخل',
        description: 'كشف حساب بنكي أو مفردات مرتب',
        required: true,
      });
    }

    if (needs.includes('property')) {
      docs.push({
        type: 'property-deed',
        label: 'سند ملكية العقار',
        required: true,
      });
    }

    return docs;
  }

  // Corporate
  const docs: DocumentRequirement[] = [
    {
      type: 'commercial-register',
      label: 'السجل التجاري',
      description: 'ساري المفعول',
      required: true,
    },
    {
      type: 'tax-card',
      label: 'البطاقة الضريبية',
      required: true,
    },
    {
      type: 'articles-of-association',
      label: 'عقد التأسيس',
      required: true,
    },
    {
      type: 'activity-license',
      label: 'ترخيص النشاط',
      required: true,
    },
    {
      type: 'signatory-id',
      label: 'بطاقة المفوض بالتوقيع',
      required: true,
    },
  ];

  if (needs.includes('health')) {
    docs.push({
      type: 'employees-list',
      label: 'قائمة الموظفين المؤمّن عليهم',
      required: true,
    });
  }

  if (needs.includes('professional-liability') || needs.includes('cyber')) {
    docs.push({
      type: 'bank-statement',
      label: 'كشف حساب بنكي (6 أشهر)',
      required: true,
    });
    docs.push({
      type: 'financial-statements',
      label: 'الميزانية السنوية الأخيرة',
      required: true,
    });
  }

  if (needs.includes('property') || needs.includes('equipment')) {
    docs.push({
      type: 'asset-register',
      label: 'سجل الأصول',
      required: true,
    });
  }

  return docs;
}