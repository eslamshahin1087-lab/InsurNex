import type { SubscriptionPlan } from '../subscription/subscription.types';

export const VAT_RATE = 0.14;
export const CURRENCY = 'EGP';

export interface PricingPlan {
  id: SubscriptionPlan;
  name: string;
  duration: number;
  subtotal: number;
  currency: typeof CURRENCY;
  description: string;
  discountNote?: string;
  isActive: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'monthly',
    name: 'شهري',
    duration: 30,
    subtotal: 300,
    currency: 'EGP',
    description: 'اشتراك شهري أساسي',
    isActive: true,
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
  },
];

export function getPlan(id: SubscriptionPlan): PricingPlan | undefined {
  return PRICING_PLANS.find((p) => p.id === id);
}

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