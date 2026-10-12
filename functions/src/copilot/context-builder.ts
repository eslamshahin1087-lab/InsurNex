export interface CopilotContext {
  page?: 'client' | 'policy' | 'claim' | 'renewal' | 'dashboard' | 'general';
  client?: {
    id: string;
    name: string;
    type: 'individual' | 'company';
    status: string;
    phone?: string;
    email?: string;
    city?: string;
    notes?: string;
  };
  policy?: {
    policyNumber: string;
    insurerName: string;
    line: string;
    startDate: string;
    expiryDate: string;
    premium: number;
    currency: string;
    status: string;
  };
  claim?: {
    claimNumber: string;
    clientName: string;
    insurerName: string;
    policyNumber: string;
    claimAmount: number;
    approvedAmount?: number;
    currency: string;
    status: string;
    incidentDate: string;
  };
  stats?: {
    totalClients?: number;
    activePolicies?: number;
    openClaims?: number;
    upcomingRenewals?: number;
  };
  notes?: string;
}

export function buildContextString(ctx?: CopilotContext): string {
  if (!ctx) return '';

  const parts: string[] = [];

  if (ctx.page) parts.push(`Current page: ${ctx.page}`);

  if (ctx.client) {
    parts.push(
      `Client context:\n${JSON.stringify(ctx.client, null, 2)}`
    );
  }

  if (ctx.policy) {
    parts.push(
      `Policy context:\n${JSON.stringify(ctx.policy, null, 2)}`
    );
  }

  if (ctx.claim) {
    parts.push(
      `Claim context:\n${JSON.stringify(ctx.claim, null, 2)}`
    );
  }

  if (ctx.stats) {
    parts.push(
      `Portfolio stats:\n${JSON.stringify(ctx.stats, null, 2)}`
    );
  }

  if (ctx.notes) {
    parts.push(`Additional notes from user: ${ctx.notes}`);
  }

  if (parts.length === 0) return '';

  return `\n\n## Current context\nThe following data is authoritative. Use it when relevant, but do not echo raw JSON.\n\n${parts.join('\n\n')}`;
}