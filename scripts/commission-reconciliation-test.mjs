import assert from 'node:assert/strict';
import {
  allocateCommissionPayment,
  calculateStatementReconciliation,
  toCurrencyMinorUnits,
  validateDateOnly,
  validateStatementReference,
} from '../src/features/finance/commission-reconciliation.js';

const exact = calculateStatementReconciliation(125.255, 125.26, 'EGP');
assert.equal(exact.status, 'matched');
assert.equal(exact.expectedAmount, 125.26);
assert.equal(exact.varianceAmount, 0);

const shortStatement = calculateStatementReconciliation(125.26, 100, 'EGP');
assert.equal(shortStatement.status, 'variance');
assert.equal(shortStatement.varianceAmount, -25.26);

const extraStatement = calculateStatementReconciliation(100, 100.5, 'EGP');
assert.equal(extraStatement.status, 'variance');
assert.equal(extraStatement.varianceAmount, 0.5);

const zeroDecimal = calculateStatementReconciliation(500, 500, 'JPY');
assert.equal(zeroDecimal.varianceAmount, 0);
assert.equal(toCurrencyMinorUnits(125.4, 'JPY'), 125);

const firstPayment = allocateCommissionPayment(100, 0, 40, 'EGP');
assert.equal(firstPayment.receivedAmount, 40);
assert.equal(firstPayment.outstandingAmount, 60);
assert.equal(firstPayment.paymentStatus, 'partial');

const secondPayment = allocateCommissionPayment(100, 40, 60, 'EGP');
assert.equal(secondPayment.receivedAmount, 100);
assert.equal(secondPayment.outstandingAmount, 0);
assert.equal(secondPayment.paymentStatus, 'paid');

assert.throws(() => allocateCommissionPayment(100, 0, 0, 'EGP'), /PAYMENT_MUST_BE_POSITIVE/);
assert.throws(() => allocateCommissionPayment(100, 70, 40, 'EGP'), /PAYMENT_EXCEEDS_OUTSTANDING/);
assert.throws(() => allocateCommissionPayment(100, 120, 1, 'EGP'), /RECEIVED_EXCEEDS_STATEMENT/);
assert.throws(() => calculateStatementReconciliation(100, -1, 'EGP'), /NEGATIVE_AMOUNT_NOT_SUPPORTED/);
assert.throws(() => calculateStatementReconciliation(100, 1, 'XXX'), /UNSUPPORTED_CURRENCY/);
assert.equal(validateStatementReference('  INS-2026-001  '), 'INS-2026-001');
assert.throws(() => validateStatementReference(' '), /INVALID_STATEMENT_REFERENCE/);
assert.equal(validateDateOnly('2026-11-03'), '2026-11-03');
assert.throws(() => validateDateOnly('2026-02-30'), /INVALID_DATE/);

console.log('All insurer commission reconciliation contract tests passed.');
