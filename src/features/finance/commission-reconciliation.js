const UNSPECIFIED_CURRENCY = 'UNSPECIFIED';

function currencyFractionDigits(currency) {
  const code = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
  if (!/^[A-Z]{3}$/.test(code)) throw new Error('INVALID_CURRENCY');
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code })
      .resolvedOptions().maximumFractionDigits;
  } catch {
    throw new Error('UNSUPPORTED_CURRENCY');
  }
}

export function toCurrencyMinorUnits(amount, currency) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new Error('INVALID_AMOUNT');
  }
  if (amount < 0) throw new Error('NEGATIVE_AMOUNT_NOT_SUPPORTED');
  const scale = 10 ** currencyFractionDigits(currency);
  const minor = Math.round((Math.abs(amount) + Number.EPSILON) * scale);
  if (!Number.isSafeInteger(minor)) throw new Error('AMOUNT_OUT_OF_RANGE');
  return minor;
}

export function fromCurrencyMinorUnits(minor, currency) {
  if (!Number.isSafeInteger(minor)) throw new Error('INVALID_MINOR_UNITS');
  return minor / (10 ** currencyFractionDigits(currency));
}

export function validateStatementReference(value) {
  const reference = typeof value === 'string' ? value.trim() : '';
  if (!reference || reference.length > 120) throw new Error('INVALID_STATEMENT_REFERENCE');
  return reference;
}

export function validateDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('INVALID_DATE');
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('INVALID_DATE');
  }
  return value;
}

export function calculateStatementReconciliation(expectedAmount, statementAmount, currency) {
  const expectedMinor = toCurrencyMinorUnits(expectedAmount, currency);
  const statementMinor = toCurrencyMinorUnits(statementAmount, currency);
  const varianceMinor = statementMinor - expectedMinor;
  return {
    expectedAmount: fromCurrencyMinorUnits(expectedMinor, currency),
    statementAmount: fromCurrencyMinorUnits(statementMinor, currency),
    varianceAmount: fromCurrencyMinorUnits(varianceMinor, currency),
    varianceMinor,
    status: varianceMinor === 0 ? 'matched' : 'variance',
  };
}

export function allocateCommissionPayment(statementAmount, receivedAmount, paymentAmount, currency) {
  const statementMinor = toCurrencyMinorUnits(statementAmount, currency);
  const receivedMinor = toCurrencyMinorUnits(receivedAmount, currency);
  const paymentMinor = toCurrencyMinorUnits(paymentAmount, currency);
  if (paymentMinor <= 0) throw new Error('PAYMENT_MUST_BE_POSITIVE');
  if (receivedMinor > statementMinor) throw new Error('RECEIVED_EXCEEDS_STATEMENT');
  if (paymentMinor > statementMinor - receivedMinor) throw new Error('PAYMENT_EXCEEDS_OUTSTANDING');

  const nextReceivedMinor = receivedMinor + paymentMinor;
  const outstandingMinor = statementMinor - nextReceivedMinor;
  return {
    receivedAmount: fromCurrencyMinorUnits(nextReceivedMinor, currency),
    outstandingAmount: fromCurrencyMinorUnits(outstandingMinor, currency),
    paymentStatus: outstandingMinor === 0 ? 'paid' : 'partial',
    paymentMinor,
  };
}
