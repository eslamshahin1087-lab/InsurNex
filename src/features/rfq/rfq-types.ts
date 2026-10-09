export type RfqStatus = 'draft' | 'ready' | 'submitted' | 'quotes_received' | 'closed';
export type MarketSubmissionStatus = 'draft' | 'sent' | 'follow_up' | 'quote_received' | 'declined' | 'no_response';

export interface RfqInsurerTarget {
  insurerId: string;
  insurerName: string;
  status: MarketSubmissionStatus;
  sentAt?: string;
  recipientEmail?: string;
  followUpAt?: string;
  quoteReceivedAt?: string;
  quoteDocumentId?: string;
  notes?: string;
}

export interface RfqRecord {
  id: string;
  organizationId: string;
  clientId: string;
  clientName: string;
  insuranceType: string;
  coverageAmount?:number;
  coverageSummary: string;
  status: RfqStatus;
  documentIds: string[];
  insurers: RfqInsurerTarget[];
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CreateRfqInput {
  organizationId: string;
  clientId: string;
  clientName: string;
  insuranceType: string;
  coverageAmount?: number;
  coverageSummary: string;
  documentIds: string[];
  insurers: Array<{ insurerId: string; insurerName: string }>;
  createdBy: string;
}
