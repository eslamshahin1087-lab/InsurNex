import assert from 'node:assert/strict';
import {
  canTransitionTaskStatus,
  getTaskDueBucket,
  getTaskDueSummary,
  getTodayDateKey,
  nextTaskStatus,
  normalizeTaskStatus,
  sortTasksForDailyWork,
} from '../src/features/tasks/task-workflow.js';

const today = '2026-11-03';

assert.equal(getTodayDateKey(new Date(2026, 10, 3, 12)), today);
assert.equal(getTaskDueBucket('2026-11-02', today), 'overdue');
assert.equal(getTaskDueBucket(today, today), 'today');
assert.equal(getTaskDueBucket('2026-11-10', today), 'upcoming');
assert.equal(getTaskDueBucket('2026-11-11', today), 'later');
assert.equal(getTaskDueBucket('', today), 'undated');
assert.equal(getTaskDueBucket('2026-02-30', today), 'undated');
assert.equal(getTaskDueBucket('2024-02-29', '2024-02-28'), 'upcoming');

assert.equal(normalizeTaskStatus('open'), 'open');
assert.equal(normalizeTaskStatus('unknown'), null);
assert.equal(nextTaskStatus('open'), 'in_progress');
assert.equal(nextTaskStatus('in_progress'), 'completed');
assert.equal(nextTaskStatus('completed'), 'open');
assert.equal(nextTaskStatus('unknown'), null);
assert.equal(canTransitionTaskStatus('open', 'completed'), true);
assert.equal(canTransitionTaskStatus('completed', 'in_progress'), false);
assert.equal(canTransitionTaskStatus('in_progress', 'open'), true);

const tasks = [
  { id: 'later', status: 'open', priority: 'urgent', dueDate: '2026-11-20' },
  { id: 'today-low', status: 'open', priority: 'low', dueDate: today },
  { id: 'overdue-normal', status: 'open', priority: 'medium', dueDate: '2026-11-01' },
  { id: 'overdue-urgent', status: 'open', priority: 'urgent', dueDate: '2026-11-02' },
  { id: 'undated', status: 'open', priority: 'high', dueDate: '' },
  { id: 'completed', status: 'completed', priority: 'urgent', dueDate: '2026-11-01' },
];

assert.deepEqual(getTaskDueSummary(tasks, today), {
  overdue: 2,
  today: 1,
  upcoming: 0,
  later: 1,
  undated: 1,
});
assert.deepEqual(sortTasksForDailyWork(tasks, today).map((task) => task.id), [
  'overdue-urgent',
  'overdue-normal',
  'today-low',
  'later',
  'undated',
  'completed',
]);

console.log('Task daily-workflow tests passed.');
