import assert from 'node:assert/strict';
import {
  buildPolicyCommissionDocumentId,
  computeFinancialSummary,
  formatCurrencyAmount,
  formatFinanceMetric,
} from '../src/features/finance/financial-metrics.js';

const summary = computeFinancialSummary(
  [
    { amount: 1000.125, currency: 'egp', status: 'confirmed' },
    { amount: 100, currency: 'USD', status: 'confirmed' },
    { amount: 900, currency: 'EGP', status: 'pending' },
    { amount: 250, currency: 'USD', status: 'cancelled' },
  ],
  [
    { amount: 100.115, currency: 'EGP' },
    { amount: 20, currency: 'USD' },
  ],
  [
    { commissionAmount: 50.255, currency: 'EGP', status: 'pending' },
    { commissionAmount: 10, currency: 'USD', status: 'received' },
    { commissionAmount: 400, currency: 'EGP', status: 'cancelled' },
  ],
);

assert.equal(summary.currencies.length, 2, 'currencies remain separate instead of being added together');
const egp = summary.currencies.find((item) => item.currency === 'EGP');
const usd = summary.currencies.find((item) => item.currency === 'USD');

assert.ok(egp);
assert.ok(usd);
assert.equal(egp.totalRevenue, 1000.13, 'EGP values are rounded to the currency minor unit');
assert.equal(egp.totalExpenses, 100.12);
assert.equal(egp.netIncome, 900.01);
assert.equal(egp.pendingCommissions, 50.26);
assert.equal(egp.receivedCommissions, 0);
assert.equal(usd.totalRevenue, 100);
assert.equal(usd.totalExpenses, 20);
assert.equal(usd.netIncome, 80);
assert.equal(usd.pendingCommissions, 0);
assert.equal(usd.receivedCommissions, 10);

const zeroDecimal = computeFinancialSummary(
  [{ amount: 123.6, currency: 'JPY', status: 'confirmed' }],
  [],
  [],
);
assert.equal(zeroDecimal.currencies[0].totalRevenue, 124, 'zero-decimal currencies use their ISO minor-unit convention');

const quality = computeFinancialSummary(
  [{ amount: Number.NaN, currency: 'EGP', status: 'confirmed' }],
  [{ amount: 10, currency: '', }],
  [],
);
assert.equal(quality.dataQuality.invalidAmountRows, 1);
assert.equal(quality.dataQuality.missingOrInvalidCurrencyRows, 1);
assert.equal(quality.currencies.find((item) => item.currency === 'EGP').totalRevenue, 0);
assert.equal(quality.currencies.find((item) => item.currency === 'UNSPECIFIED').totalExpenses, 10);

assert.match(formatCurrencyAmount(10, 'EGP'), /ج\.م|EGP/);
assert.match(formatFinanceMetric(summary.currencies, 'netIncome'), /USD|US\$/);
assert.equal(
  buildPolicyCommissionDocumentId('org_insurer_policy_123'),
  'policy_commission_org_insurer_policy_123',
);
assert.throws(() => buildPolicyCommissionDocumentId(''), /POLICY_ID_REQUIRED/);
assert.throws(() => buildPolicyCommissionDocumentId('x'.repeat(1500)), /POLICY_COMMISSION_ID_TOO_LONG/);

console.log('All financial metric contract tests passed.');
