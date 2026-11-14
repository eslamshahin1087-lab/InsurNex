export type AnalyticsRow = Record<string, unknown>;
export interface AnalyticsInput {
  clients: AnalyticsRow[];
  policies: AnalyticsRow[];
  claims: AnalyticsRow[];
  leads: AnalyticsRow[];
  tasks: AnalyticsRow[];
}
export interface AnalyticsSnapshot {
  clients: number;
  activeClients: number;
  policies: number;
  activePolicies: number;
  premiumByCurrency: Record<string, number>;
  claims: number;
  claimAmountByCurrency: Record<string, number>;
  leads: number;
  /** Lead estimated values use the application's EGP default. */
  pipeline: number;
  won: number;
  lost: number;
  winRate: number;
  openTasks: number;
  tasks: number;
  completedTasks: number;
  taskCompletionRate: number;
  stages: Record<string, number>;
  sources: Record<string, number>;
  insurers: Record<string, number>;
  insuranceTypes: Record<string, { count: number; pipeline: number; won: number; lost: number }>;
  generatedAt: string;
}
export function buildAnalyticsSnapshot(
  input: AnalyticsInput,
  generatedAt?: string,
): AnalyticsSnapshot;
