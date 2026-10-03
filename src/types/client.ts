export type ClientType = 'individual' | 'company';
export type ClientStatus = 'active' | 'prospect' | 'inactive';
export interface InsuranceClient {
  id: string; organizationId: string; type: ClientType; status: ClientStatus;
  name: string; email: string; phone: string; nationalId?: string; taxId?: string;
  industry?: string; city?: string; address?: string; notes?: string;
  createdBy: string; createdAt?: { toDate?: () => Date } | null; updatedAt?: unknown;
}
export type ClientInput = Omit<InsuranceClient,'id'|'organizationId'|'createdBy'|'createdAt'|'updatedAt'>;
