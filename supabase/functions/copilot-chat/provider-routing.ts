export interface CopilotProviderAttempt {
  name: string;
  run: () => Promise<string>;
}

export interface CopilotProviderResult {
  reply: string;
  provider: string;
  usedFallback: boolean;
}

/**
 * Tries configured AI providers in order. Provider errors and response bodies
 * are deliberately discarded; only a deterministic local fallback is returned
 * after every configured provider fails or no provider is configured.
 */
export async function runCopilotProviderCascade(
  providers: readonly CopilotProviderAttempt[],
  fallbackReply: string,
): Promise<CopilotProviderResult> {
  for (const provider of providers) {
    try {
      const reply = await provider.run();
      if (typeof reply === "string" && reply.trim()) {
        return {
          reply: reply.trim(),
          provider: provider.name,
          usedFallback: false,
        };
      }
    } catch {
      // Do not log or return provider error text, response bodies or credentials.
    }
  }

  return {
    reply: fallbackReply,
    provider: "local-fallback",
    usedFallback: true,
  };
}

/**
 * Language-only fallback: it deliberately does not include client, policy,
 * claim, financial, medical or other business context.
 */
export function buildCopilotProviderUnavailableReply(messages: readonly { content: string }[]): string {
  const lastMessage = messages[messages.length - 1]?.content ?? "";
  const arabic = /[\u0600-\u06FF]/.test(lastMessage);

  return arabic
    ? "مساعد InsurNex غير متاح مؤقتاً بسبب تعذر الاتصال بمزود الذكاء الاصطناعي. لم يتم إنشاء تحليل أو تنفيذ أي إجراء على سجلاتك. يمكنك إعادة المحاولة لاحقاً أو متابعة العمل يدوياً داخل المنصة."
    : "InsurNex Copilot is temporarily unavailable because no AI provider could complete the request. No analysis was generated and no action was performed on your records. Please retry later or continue your work manually in the platform.";
}
