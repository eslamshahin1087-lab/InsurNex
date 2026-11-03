export type QuoteStatus = 'received' | 'shortlisted' | 'selected' | 'rejected' | 'issued';

export function isDateOnly(value: unknown): value is string;
export function getTodayDateKey(now?: Date): string;
export function addDaysToDateKey(value: string, days: number): string;
export function normalizeQuoteStatus(value: unknown): QuoteStatus | null;
export function canTransitionQuoteStatus(from: unknown, to: unknown): boolean;
export function getQuoteCommissionAmount(premium: unknown, commissionRate: unknown): number | null;
export function getQuoteValidationErrors(input: unknown, today?: string): string[];
export function compareQuoteOffers<T extends { currency?: string; premium?: number; deductible?: number | null; insurerName?: string }>(offers: T[]): T[];
export function isQuoteOfferValid(offer: { status?: unknown; validUntil?: string }, today?: string): boolean;
export function buildPolicyDocumentId(organizationId: string, insurerId: string, policyNumber: string): string;
