export type CopilotRole = 'user' | 'assistant';

export interface CopilotMessage {
  id: string;
  conversationId: string;
  organizationId: string;
  userId: string;
  role: CopilotRole;
  content: string;
  createdAt?: unknown;
}

export interface CopilotConversation {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  lastMessage: string;
  messageCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CopilotContextPayload {
  page?: string;
  client?: {
    id: string;
    name: string;
    type: string;
    status: string;
    phone?: string;
    email?: string;
    city?: string;
    notes?: string;
  };
  // Client-side selector only; Copilot sends the ID and fetches authorized fields server-side.
  lead?: { id: string };
  // Policy/Claim 360 selectors only; the server loads authorized summary fields.
  policyRef?: { id: string };
  claimRef?: { id: string };
  policy?: {
    policyNumber: string;
    insurerName: string;
    line: string;
    startDate?: string;
    expiryDate: string;
    premium: number;
    currency: string;
    status: string;
  };
  policies?: Array<{
    policyNumber: string;
    clientName?: string;
    insurerName: string;
    line: string;
    expiryDate: string;
    premium: number;
    currency: string;
    status: string;
  }>;
  claims?: Array<{
    claimNumber: string;
    clientName?: string;
    insurerName: string;
    policyNumber: string;
    claimAmount: number;
    currency: string;
    status: string;
    incidentDate: string;
  }>;
  renewals?: Array<{
    policyNumber: string;
    clientName?: string;
    insurerName: string;
    line: string;
    expiryDate: string;
    premium: number;
    daysLeft: number;
    currency: string;
  }>;
  leads?: Array<{
    name: string;
    companyName?: string;
    stage: string;
    insuranceType: string;
    estimatedValue: number;
  }>;
  insurers?: Array<{
    name: string;
    category: string;
    status?: string;
  }>;
  tasks?: Array<{
    title: string;
    status: string;
    priority: string;
    dueDate?: string;
  }>;
  finance?: {
    totalRevenue?: number;
    totalExpenses?: number;
    netIncome?: number;
    pendingCommissions?: number;
    receivedCommissions?: number;
    currency?: string;
  };
  stats?: {
    totalClients?: number;
    activePolicies?: number;
    openClaims?: number;
    upcomingRenewals?: number;
    totalLeads?: number;
    wonLeads?: number;
    pipelineValue?: number;
  };
  notes?: string;
}

export interface CopilotRequestMessage {
  role: CopilotRole;
  content: string;
}

export interface CopilotResponse {
  reply: string;
  usage?: unknown;
  model?: string;
}