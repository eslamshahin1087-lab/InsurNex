import type { FeatureEntitlements } from './feature-catalog';

export interface PricingPlanDoc {
  id: string;
  name: string;
  duration: number;
  subtotal: number;
  currency: string;
  description: string;
  discountNote?: string;
  isActive: boolean;
  order: number;
  /** Missing fields in legacy plan documents normalize to all features enabled. */
  features: FeatureEntitlements;
  updatedAt?: unknown;
  updatedBy?: string;
}
