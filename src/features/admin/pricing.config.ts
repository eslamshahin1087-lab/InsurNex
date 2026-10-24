import { DEFAULT_FEATURE_ENTITLEMENTS, type FeatureEntitlements } from './feature-catalog';

export const VAT_RATE = 0.14;
export const CURRENCY = 'EGP';

export interface PricingPlan {
  id: string;
  name: string;
  duration: number;
  subtotal: number;
  currency: typeof CURRENCY;
  description: string;
  discountNote?: string;
  isActive: boolean;
  order: number;
  features: FeatureEntitlements;
}

export const DEFAULT_PRICING_PLANS: PricingPlan[] = [
  {
    id: 'monthly',
    name: 'شهري',
    duration: 30,
    subtotal: 300,
    currency: 'EGP',
    description: 'اشتراك شهري أساسي',
    isActive: true,
    order: 1,
    features: DEFAULT_FEATURE_ENTITLEMENTS,
  },
  {
    id: 'yearly',
    name: 'سنوي',
    duration: 365,
    subtotal: 3000,
    currency: 'EGP',
    description: 'اشتراك سنوي بخصم 17%',
    discountNote: 'خصم 17%',
    isActive: true,
    order: 2,
    features: DEFAULT_FEATURE_ENTITLEMENTS,
  },
  {
    id: 'yearly_discount',
    name: 'سنوي مخفض',
    duration: 365,
    subtotal: 2500,
    currency: 'EGP',
    description: 'اشتراك سنوي بخصم خاص',
    discountNote: 'خصم 31%',
    isActive: true,
    order: 3,
    features: DEFAULT_FEATURE_ENTITLEMENTS,
  },
];

export function computePricing(subtotal: number) {
  const vatAmount = Math.round(subtotal * VAT_RATE * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;
  return { subtotal, vatRate: VAT_RATE, vatAmount, total };
}

export function formatEGP(value: number): string {
  return `${new Intl.NumberFormat('ar-EG', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value)} ج.م`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ar-EG').format(value);
}
