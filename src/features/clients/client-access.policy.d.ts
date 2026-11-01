import type { UserRole } from '../../types/auth';

export interface ClientAccessScope {
  uid: string;
  organizationId: string;
  role: UserRole;
  status: 'active' | 'invited' | 'disabled';
}

export interface ClientBaseSummary {
  id: string;
  organizationId: string;
  code?: string;
  type: 'individual' | 'company';
  status: 'active' | 'prospect' | 'inactive';
  name: string;
  phone: string;
  email?: string;
  industry?: string;
  city?: string;
  assignedTo?: string;
  leadSource?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const LEGACY_CLIENT_READ_ROLES: readonly UserRole[];
export const CLIENT_BASE_SUMMARY_FIELDS: readonly string[];
export function canReadLegacyClientRecord(scope: ClientAccessScope | null | undefined): boolean;
export function assertCanReadLegacyClientRecord(scope: ClientAccessScope): void;
export function projectClientBaseSummary(
  documentId: string,
  data: Record<string, unknown>,
  scope: ClientAccessScope,
): ClientBaseSummary;
export function projectLegacyClientWorkspace<T extends Record<string, unknown>>(
  documentId: string,
  data: T,
  scope: ClientAccessScope,
): { id: string } & T;
