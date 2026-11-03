import assert from 'node:assert/strict';
import {
  addDaysToDateKey,
  canTransitionQuoteStatus,
  compareQuoteOffers,
  getQuoteCommissionAmount,
  getQuoteValidationErrors,
  getTodayDateKey,
  isQuoteOfferValid,
} from '../src/features/quotes/quote-workflow.js';

const today = '2026-11-03';
assert.equal(getTodayDateKey(new Date(2026, 10, 3, 12)), today);
assert.equal(addDaysToDateKey(today, 14), '2026-11-17');
assert.equal(addDaysToDateKey('2026-02-30', 1), '');

assert.equal(getQuoteCommissionAmount(1250, 10), 125);
assert.equal(getQuoteCommissionAmount(1000.55, 7.5), 75.04);
assert.equal(getQuoteCommissionAmount(-1, 5), null);
assert.equal(getQuoteCommissionAmount(100, 101), null);

assert.equal(canTransitionQuoteStatus('received', 'selected'), true);
assert.equal(canTransitionQuoteStatus('shortlisted', 'selected'), true);
assert.equal(canTransitionQuoteStatus('selected', 'issued'), false);
assert.equal(canTransitionQuoteStatus('issued', 'selected'), false);
assert.equal(canTransitionQuoteStatus('rejected', 'selected'), false);

const base = {
  organizationId: 'org-a',
  rfqId: 'rfq-a',
  clientId: 'client-a',
  insurerId: 'insurer-a',
  insurerName: 'شركة اختبار',
  premium: 1250,
  currency: 'EGP',
  commissionRate: 10,
  deductible: 100,
  validUntil: '2026-11-20',
  effectiveStartDate: '2026-12-01',
  effectiveEndDate: '2027-11-30',
};
assert.deepEqual(getQuoteValidationErrors(base, today), []);
assert.deepEqual(getQuoteValidationErrors({ ...base, deductible: '' }, today), []);
assert.ok(getQuoteValidationErrors({ ...base, premium: 0 }, today).includes('PREMIUM_MUST_BE_POSITIVE'));
assert.ok(getQuoteValidationErrors({ ...base, commissionRate: 101 }, today).includes('INVALID_COMMISSION_RATE'));
assert.ok(getQuoteValidationErrors({ ...base, commissionRate: '' }, today).includes('COMMISSION_RATE_REQUIRED'));
assert.deepEqual(getQuoteValidationErrors({ ...base, deductible: '' }, today), []);
assert.ok(getQuoteValidationErrors({ ...base, validUntil: '2026-10-30' }, today).includes('QUOTE_VALIDITY_DATE_REQUIRED'));
assert.ok(getQuoteValidationErrors({ ...base, effectiveEndDate: '' }, today).includes('BOTH_EFFECTIVE_DATES_REQUIRED'));

const offers = [
  { insurerName: 'شركة ب', currency: 'EGP', premium: 1200, deductible: 200 },
  { insurerName: 'شركة د', currency: 'EGP', premium: 1200, deductible: null },
  { insurerName: 'شركة أ', currency: 'EGP', premium: 1000, deductible: 300 },
  { insurerName: 'شركة ج', currency: 'USD', premium: 900, deductible: 0 },
];
assert.deepEqual(compareQuoteOffers(offers).map((item) => item.insurerName), [
  'شركة أ', 'شركة ب', 'شركة د', 'شركة ج',
]);
assert.equal(isQuoteOfferValid({ status: 'received', validUntil: '2026-11-03' }, today), true);
assert.equal(isQuoteOfferValid({ status: 'selected', validUntil: '2026-11-02' }, today), false);

console.log('Quote workflow domain tests passed.');
