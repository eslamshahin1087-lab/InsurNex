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

export type CopilotContextPage =
  | 'client'
  | 'policy'
  | 'claim'
  | 'renewal'
  | 'dashboard'
  | 'general';

export interface CopilotContextPayload {
  page?: CopilotContextPage;
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

export interface CopilotRequestMessage {
  role: CopilotRole;
  content: string;
}

export interface CopilotResponse {
  reply: string;
  usage?: unknown;
  model?: string;
}