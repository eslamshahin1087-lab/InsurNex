export interface Ad {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  linkUrl?: string;
  ctaText?: string;
  isActive: boolean;
  startDate?: string;
  endDate?: string;
  order: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
}