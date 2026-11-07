export const MEDICAL_GEMINI_ENABLE_FLAG = 'VITE_ENABLE_MEDICAL_GEMINI_AGGREGATES';
export const MEDICAL_GEMINI_TERMS_APPROVAL_FLAG = 'VITE_MEDICAL_GEMINI_PROVIDER_TERMS_APPROVED';

/**
 * External medical AI is off unless an operator explicitly approves both
 * aggregated medical-data processing and the provider terms for the build.
 * These are build-time policy acknowledgements, not secrets or DLP controls.
 */
export function isMedicalGeminiAllowed(env) {
  if (!env || typeof env !== 'object') return false;
  return env[MEDICAL_GEMINI_ENABLE_FLAG] === 'true'
    && env[MEDICAL_GEMINI_TERMS_APPROVAL_FLAG] === 'true';
}
