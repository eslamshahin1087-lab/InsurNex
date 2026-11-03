const UNSPECIFIED_CURRENCY = 'UNSPECIFIED';

function normalizeCurrency(value) {
  if (typeof value !== 'string') return UNSPECIFIED_CURRENCY;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : UNSPECIFIED_CURRENCY;
}

function fractionDigits(currency) {
  if (currency === UNSPECIFIED_CURRENCY) return 2;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
}

function toMinorUnits(value, currency) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const scale = 10 ** fractionDigits(currency);
  const minor = Math.round((value + Math.sign(value) * Number.EPSILON) * scale);
  return Number.isSafeInteger(minor) ? minor : null;
}

function fromMinorUnits(value, currency) {
  return value / (10 ** fractionDigits(currency));
}

function newBucket(currency) {
  return {
    currency,
    grossPremiumsMinor: 0,
    totalRevenueMinor: 0,
    outstandingReceivablesMinor: 0,
    totalExpensesMinor: 0,
    pendingCommissionsMinor: 0,
    receivedCommissionsMinor: 0,
  };
}

function addRecord(bucketMap, row, target, quality) {
  const currency = normalizeCurrency(row?.currency);
  if (currency === UNSPECIFIED_CURRENCY) quality.missingOrInvalidCurrencyRows += 1;

  const bucket = bucketMap.get(currency) || newBucket(currency);
  bucketMap.set(currency, bucket);

  const minor = toMinorUnits(row?.amount, currency);
  if (minor === null) {
    quality.invalidAmountRows += 1;
    return;
  }
  bucket[target] += minor;
}

export function computeFinancialSummary(revenue = [], expenses = [], commissions = []) {
  const bucketMap = new Map();
  const quality = {
    missingOrInvalidCurrencyRows: 0,
    invalidAmountRows: 0,
    unclassifiedRevenueRows: 0,
  };

  for (const row of revenue) {
    if (row?.status === 'cancelled') continue;
    if (row?.type === 'premium') {
      if (row.status === 'confirmed') addRecord(bucketMap, row, 'grossPremiumsMinor', quality);
    } else if (row?.type === 'commission' || row?.type === 'fee') {
      if (row.status === 'confirmed') addRecord(bucketMap, row, 'totalRevenueMinor', quality);
    } else if (row?.type === 'outstanding') {
      addRecord(bucketMap, row, 'outstandingReceivablesMinor', quality);
    } else {
      quality.unclassifiedRevenueRows += 1;
    }
  }

  for (const row of expenses) {
    addRecord(bucketMap, row, 'totalExpensesMinor', quality);
  }

  for (const row of commissions) {
    if (row?.status === 'pending') {
      addRecord(bucketMap, { amount: row.commissionAmount, currency: row.currency }, 'pendingCommissionsMinor', quality);
    } else if (row?.status === 'received') {
      addRecord(bucketMap, { amount: row.commissionAmount, currency: row.currency }, 'receivedCommissionsMinor', quality);
    }
  }

  const currencies = Array.from(bucketMap.values())
    .sort((a, b) => a.currency.localeCompare(b.currency))
    .map((bucket) => {
      const totalRevenue = fromMinorUnits(bucket.totalRevenueMinor, bucket.currency);
      const totalExpenses = fromMinorUnits(bucket.totalExpensesMinor, bucket.currency);
      return {
        currency: bucket.currency,
        grossPremiums: fromMinorUnits(bucket.grossPremiumsMinor, bucket.currency),
        totalRevenue,
        outstandingReceivables: fromMinorUnits(bucket.outstandingReceivablesMinor, bucket.currency),
        totalExpenses,
        netIncome: fromMinorUnits(bucket.totalRevenueMinor - bucket.totalExpensesMinor, bucket.currency),
        pendingCommissions: fromMinorUnits(bucket.pendingCommissionsMinor, bucket.currency),
        receivedCommissions: fromMinorUnits(bucket.receivedCommissionsMinor, bucket.currency),
      };
    });

  return {
    currencies,
    dataQuality: quality,
    recordCounts: {
      revenue: revenue.length,
      expenses: expenses.length,
      commissions: commissions.length,
    },
  };
}

export function formatCurrencyAmount(amount, currency, locale = 'ar-EG') {
  const value = Number.isFinite(amount) ? amount : 0;
  const code = normalizeCurrency(currency);
  if (code === UNSPECIFIED_CURRENCY) {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value) + ' (عملة غير محددة)';
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: fractionDigits(code),
    maximumFractionDigits: fractionDigits(code),
  }).format(value);
}

export function formatFinanceMetric(currencies, metric, locale = 'ar-EG') {
  return (currencies || [])
    .map((bucket) => formatCurrencyAmount(bucket[metric], bucket.currency, locale))
    .join(' · ') || '—';
}

export function buildPolicyCommissionDocumentId(policyId) {
  const id = typeof policyId === 'string' ? policyId.trim() : '';
  if (!id) throw new Error('POLICY_ID_REQUIRED');
  // Policy IDs are already generated as Firestore-safe deterministic IDs.
  // Reuse the same ID in the commissions collection to make policy-to-ledger
  // cardinality enforceable in Firestore Rules without a non-transactional query.
  if (id.includes('/') || id.length > 1200) throw new Error('POLICY_COMMISSION_ID_INVALID');
  return id;
}
