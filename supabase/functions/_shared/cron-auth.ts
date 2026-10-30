export function constantTimeStringEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

/** Scheduler-only authentication; the Supabase service-role key is never accepted as a cron bearer. */
export function isCronRequestAuthorized(request: Request, expectedSecret: string): boolean {
  if (!expectedSecret) return false;
  const supplied = request.headers.get('x-cron-secret') ?? '';
  if (!supplied) return false;
  return constantTimeStringEqual(supplied, expectedSecret);
}

export function normalizeDateOnly(value: unknown): string | null {
  let candidate: string | null = null;
  if (typeof value === 'string') candidate = value.trim();
  else if (value instanceof Date && Number.isFinite(value.getTime())) candidate = value.toISOString();
  else if (value && typeof value === 'object' && 'toDate' in value
    && typeof (value as { toDate?: unknown }).toDate === 'function') {
    const converted = (value as { toDate: () => Date }).toDate();
    if (converted instanceof Date && Number.isFinite(converted.getTime())) candidate = converted.toISOString();
  }
  if (!candidate) return null;

  const match = /^(\d{4}-\d{2}-\d{2})/.exec(candidate);
  if (!match) return null;
  const date = new Date(match[1] + 'T00:00:00.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== match[1]) return null;
  return match[1];
}

export function daysUntilUtcDate(value: unknown, now = new Date()): number | null {
  const target = normalizeDateOnly(value);
  if (!target || !Number.isFinite(now.getTime())) return null;
  const today = now.toISOString().slice(0, 10);
  const targetMs = Date.parse(target + 'T00:00:00.000Z');
  const todayMs = Date.parse(today + 'T00:00:00.000Z');
  return Math.round((targetMs - todayMs) / 86_400_000);
}

export function renewalReminderWindow(daysLeft: number): 7 | 30 | 45 | 90 | null {
  if (!Number.isFinite(daysLeft) || daysLeft < 0) return null;
  if (daysLeft <= 7) return 7;
  if (daysLeft <= 30) return 30;
  if (daysLeft <= 45) return 45;
  if (daysLeft <= 90) return 90;
  return null;
}

export async function stableNotificationId(
  resourceKind: 'policy' | 'document',
  resourceId: string,
  expiryDate: string,
  windowDays: 7 | 30 | 45 | 90,
): Promise<string> {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(resourceId)) throw new Error('INVALID_RESOURCE_ID');
  const normalizedDate = normalizeDateOnly(expiryDate);
  if (!normalizedDate) throw new Error('INVALID_EXPIRY_DATE');

  const material = [resourceKind, resourceId, normalizedDate, String(windowDays)].join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  const hex = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
  return 'auto_' + resourceKind + '_' + hex;
}

export function reminderPriority(windowDays: 7 | 30 | 45 | 90): 'urgent' | 'high' | 'medium' | 'normal' {
  if (windowDays === 7) return 'urgent';
  if (windowDays === 30) return 'high';
  if (windowDays === 45) return 'medium';
  return 'normal';
}
