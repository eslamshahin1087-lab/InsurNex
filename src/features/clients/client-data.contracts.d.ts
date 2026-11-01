import type {
  AiAnalysis,
  ClientCorporate,
  ClientIndividual,
  ClientRiskData,
  HealthRiskData,
  LifeRiskData,
  BusinessRiskData,
  ProfessionalLiabilityRiskData,
  PropertyRiskData,
  EquipmentRiskData,
} from './client.types';
import type { Claim } from '../../types/claim';
import type { DocumentRecord } from '../../types/document';
import type { ClientBaseSummary } from './client-access.policy.js';

export type ClientSensitiveProfileKind =
  | 'identity'
  | 'family'
  | 'financial'
  | 'contact_address';

export type ClientScopedProfileKind =
  | ClientSensitiveProfileKind
  | 'medical'
  | 'claim_sensitive'
  | 'ai_findings';

export interface ClientScopedRecordEnvelope<
  TKind extends ClientScopedProfileKind,
  TData,
> {
  schemaVersion: 1;
  organizationId: string;
  clientId: string;
  profileKind: TKind;
  data: TData;
  createdBy: string;
  updatedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/** Candidate only: field and role approval is still required. */
export interface ClientIdentityProfileData {
  individual?: Partial<Pick<
    ClientIndividual,
    'fullName' | 'nationalId' | 'dateOfBirth' | 'gender' | 'occupation' | 'employer'
  >>;
  corporate?: Partial<Pick<
    ClientCorporate,
    'companyName' | 'tradeName' | 'commercialRegister' | 'taxCard' |
    'incorporationDate' | 'primaryActivity' | 'sector' |
    'authorizedSignatory' | 'authorizedSignatoryNid'
  >>;
}

export interface ClientFamilyProfileData {
  individual?: Pick<ClientIndividual, 'maritalStatus'>;
  life?: Pick<LifeRiskData, 'dependents'>;
}

export interface ClientFinancialProfileData {
  individual?: Pick<ClientIndividual, 'monthlyIncome'>;
  corporate?: Pick<ClientCorporate, 'capital'>;
  life?: Pick<LifeRiskData, 'annualSalary'>;
  business?: Pick<BusinessRiskData, 'annualRevenue'>;
  professionalLiability?: Pick<ProfessionalLiabilityRiskData, 'annualTurnover'>;
  property?: Pick<PropertyRiskData, 'propertyValue'>;
  equipment?: Pick<EquipmentRiskData, 'totalValue'>;
  customer?: { lifetimeValue: number };
}

export interface ClientAddressProfileData {
  individual?: Pick<ClientIndividual, 'city' | 'area' | 'street'>;
  corporate?: Pick<ClientCorporate, 'city' | 'area' | 'street'>;
}

export type ClientMedicalProfileData = {
  health?: Pick<
    HealthRiskData,
    'generalStatus' | 'chronicConditions' | 'medications' |
    'surgeries' | 'smoker' | 'height' | 'weight' | 'lastCheckup'
  >;
  life?: Pick<LifeRiskData, 'healthStatus'>;
};

export type ClientSensitiveProfileRecord =
  | ClientScopedRecordEnvelope<'identity', ClientIdentityProfileData>
  | ClientScopedRecordEnvelope<'family', ClientFamilyProfileData>
  | ClientScopedRecordEnvelope<'financial', ClientFinancialProfileData>
  | ClientScopedRecordEnvelope<'contact_address', ClientAddressProfileData>;

export type ClientMedicalProfileRecord =
  ClientScopedRecordEnvelope<'medical', ClientMedicalProfileData>;

export type ClientClaimSensitiveData = Pick<
  Claim,
  | 'claimNumber'
  | 'policyId'
  | 'policyNumber'
  | 'insurerId'
  | 'insurerName'
  | 'incidentDate'
  | 'notificationDate'
  | 'claimAmount'
  | 'approvedAmount'
  | 'currency'
  | 'status'
  | 'description'
>;

export type ClientClaimSensitiveRecord =
  ClientScopedRecordEnvelope<'claim_sensitive', ClientClaimSensitiveData>;

export interface ClientAiFindingsData {
  riskAssessment?: {
    score: number;
    level: 'low' | 'medium' | 'high';
    factors: Array<{ name: string; impact: number; severity: 'low' | 'medium' | 'high' }>;
    assessedAt: unknown;
  };
  aiAnalysis?: Pick<
    AiAnalysis,
    'summary' | 'recommendations' | 'suggestedProducts' | 'analyzedAt'
  >;
  sourceVersion?: number;
  reviewedBy?: string;
  reviewedAt?: unknown;
}

export type ClientAiFindingsRecord =
  ClientScopedRecordEnvelope<'ai_findings', ClientAiFindingsData>;

/**
 * Safe metadata projection. Deliberately excludes DocumentRecord.downloadUrl,
 * storagePath, storageBucket, notes, description and uploaded file bytes.
 */
export type ClientDocumentMetadataProjection = Pick<
  DocumentRecord,
  | 'name'
  | 'category'
  | 'originalFileName'
  | 'contentType'
  | 'size'
  | 'storageProvider'
  | 'relatedType'
  | 'relatedId'
  | 'uploadedBy'
  | 'status'
  | 'expiryDate'
  | 'issuedDate'
  | 'issuedBy'
  | 'verified'
  | 'verifiedAt'
  | 'verifiedBy'
  | 'createdAt'
  | 'updatedAt'
> & {
  id: string;
  organizationId: string;
  clientId: string;
};

export interface ClientDocumentProjectionScope {
  organizationId: string;
  clientId: string;
}

export interface ClientScopedRecordExpectedScope {
  organizationId: string;
  clientId: string;
}

export const CLIENT_DATA_CONTRACT_CATALOG: Readonly<Record<
  string,
  Readonly<{ collection: string; status: string }>
>>;

export const CLIENT_SENSITIVE_PROFILE_KINDS: readonly ClientSensitiveProfileKind[];
export const CLIENT_DOCUMENT_METADATA_FIELDS: readonly (keyof ClientDocumentMetadataProjection | string)[];

export function isClientScopedRecordEnvelope(value: unknown): value is ClientScopedRecordEnvelope<ClientScopedProfileKind, Record<string, unknown>>;
export function assertClientRecordMatchesScope(
  value: unknown,
  expected: ClientScopedRecordExpectedScope,
): ClientScopedRecordEnvelope<ClientScopedProfileKind, Record<string, unknown>>;
export function projectClientDocumentMetadata(
  documentId: string,
  source: unknown,
  expected: ClientDocumentProjectionScope,
): ClientDocumentMetadataProjection;
export type { ClientBaseSummary, ClientRiskData };
