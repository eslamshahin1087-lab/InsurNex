export type TaskStatus = 'open' | 'in_progress' | 'completed';
export type TaskDueBucket = 'overdue' | 'today' | 'upcoming' | 'later' | 'undated';
export type TaskDueFilter = 'all' | 'overdue' | 'today' | 'upcoming' | 'undated';

export interface TaskDueSummary {
  overdue: number;
  today: number;
  upcoming: number;
  later: number;
  undated: number;
}

export function getTodayDateKey(now?: Date): string;
export function normalizeTaskStatus(value: unknown): TaskStatus | null;
export function canTransitionTaskStatus(from: unknown, to: unknown): boolean;
export function nextTaskStatus(status: unknown): TaskStatus | null;
export function getTaskDueBucket(dueDate: unknown, today?: string): TaskDueBucket;
export function getTaskDueSummary(tasks: Array<{ status?: unknown; dueDate?: unknown }>, today?: string): TaskDueSummary;
export function sortTasksForDailyWork<T extends { status?: unknown; priority?: unknown; dueDate?: unknown }>(tasks: T[], today?: string): T[];
