export type CopilotProviderName = 'groq' | 'gemini';

export interface CopilotPrivacyPolicyInput {
  groqConfigured: boolean;
  geminiConfigured: boolean;
  allowBusinessContext: boolean;
  groqZeroDataRetentionConfirmed: boolean;
}

export interface CopilotPrivacyPolicy {
  readonly allowBusinessContext: boolean;
  readonly providerOrder: readonly CopilotProviderName[];
}

/**
 * Fail-closed policy for free-tier Copilot providers.
 *
 * Business context can be used only when explicitly enabled and Groq's
 * Zero Data Retention setting has been independently confirmed by the
 * operator. Such requests are Groq-only: a provider failure must never
 * forward the same tenant context to another provider.
 */
export function resolveCopilotPrivacyPolicy(
  input: CopilotPrivacyPolicyInput,
): CopilotPrivacyPolicy {
  const allowBusinessContext =
    input.allowBusinessContext &&
    input.groqConfigured &&
    input.groqZeroDataRetentionConfirmed;

  const providerOrder: CopilotProviderName[] = allowBusinessContext
    ? ['groq']
    : [
        ...(input.groqConfigured ? ['groq' as const] : []),
        ...(input.geminiConfigured ? ['gemini' as const] : []),
      ];

  return Object.freeze({
    allowBusinessContext,
    providerOrder: Object.freeze(providerOrder),
  });
}
