export const MEDICAL_GEMINI_ENABLE_FLAG: 'VITE_ENABLE_MEDICAL_GEMINI_AGGREGATES';
export const MEDICAL_GEMINI_TERMS_APPROVAL_FLAG: 'VITE_MEDICAL_GEMINI_PROVIDER_TERMS_APPROVED';
export interface MedicalGeminiPolicyEnvironment {
  VITE_ENABLE_MEDICAL_GEMINI_AGGREGATES?: unknown;
  VITE_MEDICAL_GEMINI_PROVIDER_TERMS_APPROVED?: unknown;
}
export function isMedicalGeminiAllowed(env?: MedicalGeminiPolicyEnvironment | null): boolean;
