export interface OnboardingProgress {
  uid: string;
  organizationId: string;
  currentStep: number;      // 1 = welcome, 2 = clients, 3 = policies, 4 = copilot, 5 = done
  completed: boolean;
  skippedSteps: number[];
  startedAt?: unknown;
  completedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const TOTAL_STEPS = 5;