export type ClaimStatus = 'new' | 'documents' | 'submitted' | 'review' | 'additional_documents' | 'approved' | 'rejected' | 'settlement' | 'closed';

export interface Claim {
  id: string;
  organizationId: string;
  claimNumber: string;
  clientId: string;
  clientName: string;
  policyId: string;
  policyNumber: string;
  insurerId: string;
  insurerName: string;
  incidentDate: string;
  notificationDate: string;
  claimAmount: number;
  approvedAmount: number;
  currency: string;
  status: ClaimStatus;
  description: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ClaimInput = Omit<Claim, 'id' | 'organizationId' | 'clientName' | 'policyNumber' | 'insurerId' | 'insurerName' | 'createdBy' | 'createdAt' | 'updatedAt'>;
