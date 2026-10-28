// ============================================================
// Client Types — Extended for Wizard
// ============================================================

export type ClientKind = 'individual' | 'corporate';
export type ClientStatus = 'active' | 'prospect' | 'inactive' | 'churned';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type Gender = 'male' | 'female';
export type CorporateSector = 'industrial' | 'trading' | 'services' | 'technology';

export type InsuranceNeed =
  | 'motor'
  | 'health'
  | 'life'
  | 'property'
  | 'travel'
  | 'business'
  | 'professional-liability'
  | 'equipment'
  | 'cyber';

// ============================================================
// Risk Data (Dynamic per need)
// ============================================================

export interface MotorRiskData {
  vehicleMake: string;
  vehicleYear: number;
  vehicleModel: string;
  estimatedValue: number;
  usage: 'personal' | 'commercial';
  annualKm: number;
  lastAccident?: string;
  yearsNoClaims: number;
}

export interface HealthRiskData {
  generalStatus: 'excellent' | 'good' | 'fair' | 'poor';
  chronicConditions: string[];
  medications: string;
  surgeries: string;
  smoker: boolean;
  height: number; // cm
  weight: number; // kg
  lastCheckup?: string;
}

export interface LifeRiskData {
  dependents: number;
  healthStatus: 'excellent' | 'good' | 'fair' | 'poor';
  riskyOccupation: boolean;
  annualSalary: number;
  existingLifeInsurance: boolean;
}

export interface PropertyRiskData {
  propertyType: 'apartment' | 'villa' | 'office' | 'warehouse';
  propertyValue: number;
  yearBuilt: number;
  location: string;
  hasSecuritySystem: boolean;
}

export interface TravelRiskData {
  destinations: string;
  duration: number; // days
  tripType: 'leisure' | 'business' | 'study';
  travelersCount: number;
}

export interface BusinessRiskData {
  annualRevenue: number;
  employeesCount: number;
  industryType: string;
  previousClaims: number;
}

export interface ProfessionalLiabilityRiskData {
  sector: string;
  annualTurnover: number;
  clientsCount: number;
  previousDisputes: number;
}

export interface EquipmentRiskData {
  equipmentType: string;
  totalValue: number;
  equipmentCount: number;
  yearPurchased: number;
}

export interface CyberRiskData {
  annualRevenue: number;
  dataRecordsCount: number;
  hasBackups: boolean;
  previousIncidents: number;
}

export interface ClientRiskData {
  motor?: MotorRiskData;
  health?: HealthRiskData;
  life?: LifeRiskData;
  property?: PropertyRiskData;
  travel?: TravelRiskData;
  business?: BusinessRiskData;
  'professional-liability'?: ProfessionalLiabilityRiskData;
  equipment?: EquipmentRiskData;
  cyber?: CyberRiskData;
}

// ============================================================
// Documents
// ============================================================

export interface ClientDocument {
  id: string;
  type: string;
  label: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: unknown;
  verified: boolean;
  verifiedBy?: string;
  /** Local-only staged file; stripped before persisting the client document. */
  pendingFile?: File;
}

// ============================================================
// Risk Assessment
// ============================================================

export interface RiskFactor {
  name: string;
  impact: number;
  severity: 'low' | 'medium' | 'high';
}

export interface RiskAssessment {
  score: number;
  level: 'low' | 'medium' | 'high';
  factors: RiskFactor[];
  assessedAt: unknown;
}

// ============================================================
// AI Analysis
// ============================================================

export interface AiRecommendation {
  productName: string;
  reason: string;
  estimatedPremium: number;
}

export interface AiAnalysis {
  summary: string;
  recommendations: string[];
  suggestedProducts: AiRecommendation[];
  analyzedAt: unknown;
}

// ============================================================
// Main Client Interface
// ============================================================

export interface ClientIndividual {
  fullName: string;
  nationalId: string;
  dateOfBirth: string;
  gender: Gender;
  maritalStatus: MaritalStatus;
  phone: string;
  phoneAlt?: string;
  email?: string;
  city: string;
  area: string;
  street: string;
  occupation: string;
  employer: string;
  monthlyIncome: number;
}

export interface ClientCorporate {
  companyName: string;
  tradeName?: string;
  commercialRegister: string;
  taxCard: string;
  incorporationDate: string;
  primaryActivity: string;
  sector: CorporateSector;
  employeeCount: number;
  capital: number;
  authorizedSignatory: string;
  authorizedSignatoryNid: string;
  phone: string;
  email: string;
  website?: string;
  city: string;
  area: string;
  street: string;
  hasBranches: boolean;
  existingInsurances: string[];
}

export interface ExtendedClient {
  // Meta
  id: string;
  code: string;
  type: ClientKind;
  status: ClientStatus;

  // Common
  organizationId: string;
  assignedTo?: string;
  leadSource?: 'referral' | 'walk-in' | 'online' | 'campaign' | 'other';
  referredBy?: string;
  tags: string[];

  // Individual or Corporate data
  individual?: ClientIndividual;
  corporate?: ClientCorporate;

  // Convenience fields (mirror from individual/corporate for lists)
  name: string;
  phone: string;
  email?: string;
  city: string;
  address?: string;
  nationalId?: string;

  // Needs
  needs: InsuranceNeed[];
  riskData: ClientRiskData;

  // Documents
  documents: ClientDocument[];

  // Assessment
  riskAssessment?: RiskAssessment;
  aiAnalysis?: AiAnalysis;

  // Preferences
  preferences: {
    contactMethod: 'whatsapp' | 'call' | 'email';
    bestTime: 'morning' | 'afternoon' | 'evening';
    whatsappOptIn: boolean;
  };

  // Financial
  lifetimeValue: number;

  // Meta
  completeness: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy: string;
  notes?: string;
}

// ============================================================
// Wizard Input (before code generation)
// ============================================================

export interface ClientWizardInput {
  type: ClientKind;
  individual?: ClientIndividual;
  corporate?: ClientCorporate;
  needs: InsuranceNeed[];
  riskData: ClientRiskData;
  documents: ClientDocument[];
  preferences: ExtendedClient['preferences'];
  assignedTo?: string;
  leadSource?: ExtendedClient['leadSource'];
  referredBy?: string;
  tags: string[];
  notes?: string;
}