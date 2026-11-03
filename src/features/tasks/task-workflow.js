const TASK_STATUSES = new Set(['open', 'in_progress', 'completed']);
const TASK_TRANSITIONS = Object.freeze({
  open: ['in_progress', 'completed'],
  in_progress: ['open', 'completed'],
  completed: ['open'],
});

const PRIORITY_ORDER = Object.freeze({
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
});

function isDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function getTodayDateKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeTaskStatus(value) {
  return typeof value === 'string' && TASK_STATUSES.has(value) ? value : null;
}

export function canTransitionTaskStatus(from, to) {
  const current = normalizeTaskStatus(from);
  const next = normalizeTaskStatus(to);
  return Boolean(current && next && (current === next || TASK_TRANSITIONS[current].includes(next)));
}

export function nextTaskStatus(status) {
  const current = normalizeTaskStatus(status);
  if (current === 'open') return 'in_progress';
  if (current === 'in_progress') return 'completed';
  if (current === 'completed') return 'open';
  return null;
}

export function getTaskDueBucket(dueDate, today = getTodayDateKey()) {
  if (!isDateOnly(today) || !isDateOnly(dueDate)) return 'undated';
  if (dueDate < today) return 'overdue';
  if (dueDate === today) return 'today';

  const [year, month, day] = today.split('-').map(Number);
  const todayUtc = Date.UTC(year, month - 1, day);
  const [dueYear, dueMonth, dueDay] = dueDate.split('-').map(Number);
  const dueUtc = Date.UTC(dueYear, dueMonth - 1, dueDay);
  const daysUntilDue = Math.round((dueUtc - todayUtc) / 86_400_000);
  return daysUntilDue <= 7 ? 'upcoming' : 'later';
}

export function getTaskDueSummary(tasks, today = getTodayDateKey()) {
  const summary = { overdue: 0, today: 0, upcoming: 0, later: 0, undated: 0 };
  for (const task of tasks) {
    if (normalizeTaskStatus(task?.status) === 'completed') continue;
    summary[getTaskDueBucket(task?.dueDate, today)] += 1;
  }
  return summary;
}

export function sortTasksForDailyWork(tasks, today = getTodayDateKey()) {
  const bucketOrder = { overdue: 0, today: 1, upcoming: 2, later: 3, undated: 4 };
  return [...tasks].sort((left, right) => {
    const leftCompleted = normalizeTaskStatus(left?.status) === 'completed';
    const rightCompleted = normalizeTaskStatus(right?.status) === 'completed';
    if (leftCompleted !== rightCompleted) return leftCompleted ? 1 : -1;

    const leftBucket = getTaskDueBucket(left?.dueDate, today);
    const rightBucket = getTaskDueBucket(right?.dueDate, today);
    const dueDifference = bucketOrder[leftBucket] - bucketOrder[rightBucket];
    if (dueDifference !== 0) return dueDifference;

    const priorityDifference = (PRIORITY_ORDER[left?.priority] ?? 4)
      - (PRIORITY_ORDER[right?.priority] ?? 4);
    if (priorityDifference !== 0) return priorityDifference;

    return String(left?.dueDate || '').localeCompare(String(right?.dueDate || ''));
  });
}
