export type LeadStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'quotation'
  | 'negotiation'
  | 'won'
  | 'lost';

export type LeadSource =
  | 'website'
  | 'referral'
  | 'phone'
  | 'email'
  | 'social'
  | 'campaign'
  | 'walk_in'
  | 'existing_client'
  | 'other';

export type LeadPriority = 'low' | 'medium' | 'high';

export interface Lead {
  id: string;
  organizationId: string;
  name: string;
  companyName?: string;
  phone: string;
  email: string;
  source: LeadSource;
  priority: LeadPriority;
  stage: LeadStage;
  insuranceType: string;
  preferredInsurerId?: string;
  preferredInsurerName?: string;
  estimatedValue: number;
  assignedTo: string;
  assignedToName?: string;
  /** Trusted source metadata for inbound integrations such as iNex-App. */
  sourceSystem?: string;
  sourceExternalId?: string;
  sourceSchemaVersion?: number;
  sourceEvent?: string;
  clientType?: 'individual' | 'corporate' | string;
  consentToContact?: boolean;
  consentCapturedAt?: unknown;
  consentNoticeVersion?: string;
  notes?: string;
  lostReason?: string;
  clientId?: string;
  convertedAt?: unknown;
  wonAt?: unknown;
  lostAt?: unknown;
  lastActivityAt?: unknown;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type LeadInput = Omit<
  Lead,
  | 'id'
  | 'organizationId'
  | 'createdBy'
  | 'createdAt'
  | 'updatedAt'
  | 'convertedAt'
  | 'wonAt'
  | 'lostAt'
  | 'lastActivityAt'
  | 'clientId'
>;

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: 'جديد',
  contacted: 'تم التواصل',
  qualified: 'مؤهل',
  quotation: 'عرض سعر',
  negotiation: 'تفاوض',
  won: 'ناجح',
  lost: 'مفقود',
};

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  website: 'الموقع الإلكتروني',
  referral: 'ترشيح',
  phone: 'اتصال هاتفي',
  email: 'البريد الإلكتروني',
  social: 'وسائل التواصل',
  campaign: 'حملة تسويقية',
  walk_in: 'زيارة مباشرة',
  existing_client: 'عميل حالي',
  other: 'أخرى',
};

export const LEAD_PRIORITY_LABELS: Record<LeadPriority, string> = {
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'مرتفعة',
};