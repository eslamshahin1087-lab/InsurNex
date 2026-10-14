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
  updatedAt?: unknown;
  updatedBy?: string;
}