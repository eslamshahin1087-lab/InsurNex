import { resolveCopilotPrivacyPolicy } from './privacy-policy.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test('business context is disabled by default even when providers exist', () => {
  const policy = resolveCopilotPrivacyPolicy({
    groqConfigured: true,
    geminiConfigured: true,
    allowBusinessContext: false,
    groqZeroDataRetentionConfirmed: false,
  });
  assert(!policy.allowBusinessContext, 'context must be disabled by default');
  assert(policy.providerOrder.join(',') === 'groq,gemini', 'general chat may use configured providers');
});

Deno.test('an enable flag without confirmed Groq ZDR cannot release business context', () => {
  const policy = resolveCopilotPrivacyPolicy({
    groqConfigured: true,
    geminiConfigured: true,
    allowBusinessContext: true,
    groqZeroDataRetentionConfirmed: false,
  });
  assert(!policy.allowBusinessContext, 'explicit enable flag alone must fail closed');
  assert(policy.providerOrder.join(',') === 'groq,gemini', 'fallback providers remain general-chat only');
});

Deno.test('confirmed business-context mode is Groq-only and cannot fall back to Gemini', () => {
  const policy = resolveCopilotPrivacyPolicy({
    groqConfigured: true,
    geminiConfigured: true,
    allowBusinessContext: true,
    groqZeroDataRetentionConfirmed: true,
  });
  assert(policy.allowBusinessContext, 'both explicit gates should allow context mode');
  assert(policy.providerOrder.join(',') === 'groq', 'business context must never route to Gemini');
});

Deno.test('business context stays disabled when Groq is absent', () => {
  const policy = resolveCopilotPrivacyPolicy({
    groqConfigured: false,
    geminiConfigured: true,
    allowBusinessContext: true,
    groqZeroDataRetentionConfirmed: true,
  });
  assert(!policy.allowBusinessContext, 'Gemini configuration must not enable business context');
  assert(policy.providerOrder.join(',') === 'gemini', 'Gemini may be used for context-free general chat');
});

Deno.test('no configured provider produces an empty provider order', () => {
  const policy = resolveCopilotPrivacyPolicy({
    groqConfigured: false,
    geminiConfigured: false,
    allowBusinessContext: true,
    groqZeroDataRetentionConfirmed: true,
  });
  assert(!policy.allowBusinessContext, 'context must remain disabled without Groq');
  assert(policy.providerOrder.length === 0, 'no provider must be invoked');
});

Deno.test('privacy policy and provider order are immutable', () => {
  const policy = resolveCopilotPrivacyPolicy({
    groqConfigured: true,
    geminiConfigured: true,
    allowBusinessContext: true,
    groqZeroDataRetentionConfirmed: true,
  });
  assert(Object.isFrozen(policy), 'policy result must be frozen');
  assert(Object.isFrozen(policy.providerOrder), 'provider order must be frozen');
});
