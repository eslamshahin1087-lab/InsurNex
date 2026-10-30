import {
  constantTimeStringEqual,
  daysUntilUtcDate,
  isCronRequestAuthorized,
  normalizeDateOnly,
  renewalReminderWindow,
  stableNotificationId,
} from './cron-auth.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

Deno.test('cron authentication accepts only the dedicated x-cron-secret header', () => {
  const expected = 'test-cron-secret-32-characters-minimum';
  assert(isCronRequestAuthorized(new Request('https://example.test/cron', {
    headers: { 'x-cron-secret': expected },
  }), expected), 'valid dedicated cron secret should be accepted');

  assert(!isCronRequestAuthorized(new Request('https://example.test/cron', {
    headers: { authorization: 'Bearer test-cron-secret-32-characters-minimum' },
  }), expected), 'Authorization bearer must not be accepted');

  assert(!isCronRequestAuthorized(new Request('https://example.test/cron', {
    headers: { authorization: 'Bearer SUPABASE_SERVICE_ROLE_KEY_VALUE' },
  }), expected), 'service-role bearer must not be accepted');

  assert(!isCronRequestAuthorized(new Request('https://example.test/cron'), ''), 'missing configured secret must fail closed');
  assert(!isCronRequestAuthorized(new Request('https://example.test/cron', {
    headers: { 'x-cron-secret': 'wrong' },
  }), expected), 'incorrect secret must be rejected');
});

Deno.test('constant-time comparison handles equal and different lengths', () => {
  assert(constantTimeStringEqual('alpha', 'alpha'), 'same values must match');
  assert(!constantTimeStringEqual('alpha', 'alphb'), 'different values must not match');
  assert(!constantTimeStringEqual('alpha', 'alpha-long'), 'different lengths must not match');
});

Deno.test('expiry values normalize date-only and ISO date-time values', () => {
  assert(normalizeDateOnly('2026-10-30') === '2026-10-30', 'date-only value should normalize');
  assert(normalizeDateOnly('2026-10-30T14:00:00.000Z') === '2026-10-30', 'ISO date-time should normalize');
  assert(normalizeDateOnly(new Date('2026-10-30T14:00:00.000Z')) === '2026-10-30', 'Date value should normalize');
  assert(normalizeDateOnly('2026-02-30') === null, 'invalid calendar date should be rejected');
  assert(normalizeDateOnly(null) === null, 'missing date should be rejected');
});

Deno.test('renewal reminder windows match the 7/30/45/90 day product policy', () => {
  assert(renewalReminderWindow(0) === 7, 'same-day expiry belongs to the urgent 7-day window');
  assert(renewalReminderWindow(7) === 7, '7 days belongs to 7-day window');
  assert(renewalReminderWindow(8) === 30, '8 days belongs to 30-day window');
  assert(renewalReminderWindow(30) === 30, '30 days belongs to 30-day window');
  assert(renewalReminderWindow(31) === 45, '31 days belongs to 45-day window');
  assert(renewalReminderWindow(45) === 45, '45 days belongs to 45-day window');
  assert(renewalReminderWindow(46) === 90, '46 days belongs to 90-day window');
  assert(renewalReminderWindow(90) === 90, '90 days belongs to 90-day window');
  assert(renewalReminderWindow(91) === null, 'more than 90 days should not be in the reminder queue');
  assert(renewalReminderWindow(-1) === null, 'expired records should not be in the upcoming queue');
});

Deno.test('date arithmetic uses UTC calendar days', () => {
  const now = new Date('2026-10-30T23:30:00.000Z');
  assert(daysUntilUtcDate('2026-10-31', now) === 1, 'next UTC calendar date should be one day away');
  assert(daysUntilUtcDate('2026-10-30', now) === 0, 'same UTC calendar date should be due today');
});

Deno.test('notification ids are deterministic and distinguish reminder windows', async () => {
  const first = await stableNotificationId('policy', 'policy-123', '2026-11-29', 30);
  const repeated = await stableNotificationId('policy', 'policy-123', '2026-11-29', 30);
  const differentWindow = await stableNotificationId('policy', 'policy-123', '2026-11-29', 45);
  const differentExpiry = await stableNotificationId('policy', 'policy-123', '2026-11-30', 30);
  assert(first === repeated, 'same resource/date/window must produce the same id');
  assert(first !== differentWindow, 'different reminder window must produce a separate id');
  assert(first !== differentExpiry, 'different expiry date must produce a separate id');
});
