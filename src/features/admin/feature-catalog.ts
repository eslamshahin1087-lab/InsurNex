export const PLATFORM_FEATURES = [
  { key: 'clients', label: 'العملاء وCRM', description: 'ملفات العملاء وإدارة العلاقات.' },
  { key: 'policies', label: 'الوثائق', description: 'إدارة الوثائق ومتابعة حالتها.' },
  { key: 'claims', label: 'المطالبات', description: 'تسجيل المطالبات ومتابعتها.' },
  { key: 'renewals', label: 'التجديدات', description: 'متابعة مواعيد التجديد.' },
  { key: 'operations', label: 'مركز العمليات', description: 'طلبات الإصدار ومسارات العمليات.' },
  { key: 'tasks', label: 'المهام', description: 'المهام والتذكيرات التشغيلية.' },
  { key: 'insurers', label: 'شركات التأمين', description: 'دليل شركات التأمين.' },
  { key: 'leads', label: 'العملاء المحتملون', description: 'إدارة فرص البيع والعملاء المحتملين.' },
  { key: 'finance', label: 'المالية', description: 'البيانات المالية والفواتير.' },
  { key: 'analytics', label: 'التحليلات والتقارير', description: 'لوحات التحليل والتقارير.' },
  { key: 'copilot', label: 'المساعد الذكي', description: 'المساعد التفاعلي داخل التطبيق.' },
  { key: 'documents', label: 'مركز المستندات', description: 'الوصول إلى مركز المستندات.' },
  { key: 'notifications', label: 'الإشعارات', description: 'مركز إشعارات المستخدم.' },
] as const;

export type PlatformFeatureKey = (typeof PLATFORM_FEATURES)[number]['key'];
export type FeatureEntitlements = Record<PlatformFeatureKey, boolean>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/** New and legacy plans default to all application features unless explicitly configured. */
export const DEFAULT_FEATURE_ENTITLEMENTS: FeatureEntitlements = Object.fromEntries(
  PLATFORM_FEATURES.map(({ key }) => [key, true]),
) as FeatureEntitlements;

export function normalizeFeatureEntitlements(value: unknown): FeatureEntitlements {
  const raw = asRecord(value);
  return Object.fromEntries(
    PLATFORM_FEATURES.map(({ key }) => [
      key,
      typeof raw[key] === 'boolean' ? raw[key] : DEFAULT_FEATURE_ENTITLEMENTS[key],
    ]),
  ) as FeatureEntitlements;
}
