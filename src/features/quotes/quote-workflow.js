const QUOTE_STATUSES = new Set(['received', 'shortlisted', 'selected', 'rejected', 'issued']);
const QUOTE_TRANSITIONS = Object.freeze({
  received: ['shortlisted', 'selected', 'rejected'],
  shortlisted: ['received', 'selected', 'rejected'],
  selected: ['shortlisted', 'rejected'],
  rejected: [],
  issued: [],
});

export function isDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

export function getTodayDateKey(now = new Date()) {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

export function addDaysToDateKey(value, days) {
  if (!isDateOnly(value) || !Number.isInteger(days)) return '';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return getTodayDateKey(date);
}

export function normalizeQuoteStatus(value) {
  return typeof value === 'string' && QUOTE_STATUSES.has(value) ? value : null;
}

export function canTransitionQuoteStatus(from, to) {
  const current = normalizeQuoteStatus(from);
  const next = normalizeQuoteStatus(to);
  return Boolean(current && next && (current === next || QUOTE_TRANSITIONS[current].includes(next)));
}

export function getQuoteCommissionAmount(premium, commissionRate) {
  const amount = Number(premium);
  const rate = Number(commissionRate);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(rate) || rate < 0 || rate > 100) {
    return null;
  }
  return Number(((amount * rate) / 100).toFixed(2));
}

export function getQuoteValidationErrors(input, today = getTodayDateKey()) {
  const errors = [];
  if (!input || typeof input !== 'object') return ['INVALID_INPUT'];
  if (!String(input.organizationId || '').trim()) errors.push('ORGANIZATION_REQUIRED');
  if (!String(input.rfqId || '').trim()) errors.push('RFQ_REQUIRED');
  if (!String(input.clientId || '').trim()) errors.push('CLIENT_REQUIRED');
  if (!String(input.insurerId || '').trim()) errors.push('INSURER_REQUIRED');
  if (!String(input.insurerName || '').trim()) errors.push('INSURER_NAME_REQUIRED');

  const premium = Number(input.premium);
  if (!Number.isFinite(premium) || premium <= 0) errors.push('PREMIUM_MUST_BE_POSITIVE');

  const hasCommissionRate = String(input.commissionRate ?? '').trim() !== '';
  const rate = Number(input.commissionRate);
  if (!hasCommissionRate) errors.push('COMMISSION_RATE_REQUIRED');
  else if (!Number.isFinite(rate) || rate < 0 || rate > 100) errors.push('INVALID_COMMISSION_RATE');

  const hasDeductible = input.deductible !== undefined && input.deductible !== null && String(input.deductible).trim() !== '';
  const deductible = hasDeductible ? Number(input.deductible) : null;
  if (hasDeductible && (!Number.isFinite(deductible) || deductible < 0)) errors.push('INVALID_DEDUCTIBLE');

  if (!String(input.currency || '').trim()) errors.push('CURRENCY_REQUIRED');
  if (!isDateOnly(input.validUntil) || !isDateOnly(today) || input.validUntil < today) {
    errors.push('QUOTE_VALIDITY_DATE_REQUIRED');
  }

  const hasStart = Boolean(input.effectiveStartDate);
  const hasEnd = Boolean(input.effectiveEndDate);
  if (hasStart !== hasEnd) errors.push('BOTH_EFFECTIVE_DATES_REQUIRED');
  if (hasStart && (!isDateOnly(input.effectiveStartDate)
    || !isDateOnly(input.effectiveEndDate)
    || input.effectiveStartDate >= input.effectiveEndDate)) {
    errors.push('INVALID_EFFECTIVE_DATE_RANGE');
  }
  return errors;
}

export function compareQuoteOffers(offers) {
  return [...offers].sort((left, right) => {
    const currencyDifference = String(left.currency || '').localeCompare(String(right.currency || ''));
    if (currencyDifference !== 0) return currencyDifference;
    const premiumDifference = Number(left.premium || 0) - Number(right.premium || 0);
    if (premiumDifference !== 0) return premiumDifference;
    const leftDeductible = left.deductible == null ? Number.POSITIVE_INFINITY : Number(left.deductible);
    const rightDeductible = right.deductible == null ? Number.POSITIVE_INFINITY : Number(right.deductible);
    const deductibleDifference = leftDeductible - rightDeductible;
    if (deductibleDifference !== 0) return deductibleDifference;
    return String(left.insurerName || '').localeCompare(String(right.insurerName || ''));
  });
}

export function isQuoteOfferValid(offer, today = getTodayDateKey()) {
  return Boolean(
    offer
    && normalizeQuoteStatus(offer.status)
    && offer.status !== 'rejected'
    && offer.status !== 'issued'
    && isDateOnly(offer.validUntil)
    && isDateOnly(today)
    && offer.validUntil >= today,
  );
}
