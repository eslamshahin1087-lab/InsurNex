import {
  buildCopilotProviderUnavailableReply,
  runCopilotProviderCascade,
} from "./provider-routing.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

Deno.test("configured primary provider is used first and fallback is not called", async () => {
  let secondaryCalls = 0;
  const result = await runCopilotProviderCascade([
    { name: "groq:test-model", run: async () => "  grounded answer  " },
    { name: "gemini:test-model", run: async () => { secondaryCalls += 1; return "secondary"; } },
  ], "fallback");

  assert(result.reply === "grounded answer", "provider reply should be trimmed");
  assert(result.provider === "groq:test-model", "primary provider should be identified");
  assert(!result.usedFallback, "successful provider must not use fallback");
  assert(secondaryCalls === 0, "secondary provider must not be called after primary succeeds");
});

Deno.test("quota and transport failures fall through to the next configured provider", async () => {
  const calls: string[] = [];
  const result = await runCopilotProviderCascade([
    { name: "groq:test-model", run: async () => { calls.push("groq"); throw new Error("429 quota secret response"); } },
    { name: "gemini:test-model", run: async () => { calls.push("gemini"); return "safe fallback provider answer"; } },
  ], "local fallback");

  assert(calls.join(",") === "groq,gemini", "providers must be tried in deterministic order");
  assert(result.reply === "safe fallback provider answer", "secondary provider answer should be returned");
  assert(result.provider === "gemini:test-model", "successful fallback provider should be identified");
  assert(!result.usedFallback, "provider fallback is still a provider response");
  assert(!result.reply.includes("429"), "provider failure details must never reach the user");
});

Deno.test("empty provider responses are treated as failures", async () => {
  const result = await runCopilotProviderCascade([
    { name: "groq:test-model", run: async () => "  " },
    { name: "gemini:test-model", run: async () => "answer" },
  ], "local fallback");
  assert(result.reply === "answer", "empty primary response should not stop the cascade");
  assert(result.provider === "gemini:test-model", "secondary provider should be used");
});

Deno.test("no configured provider returns a deterministic local fallback without provider calls", async () => {
  const result = await runCopilotProviderCascade([], "local message");
  assert(result.reply === "local message", "local fallback must be returned");
  assert(result.provider === "local-fallback", "local fallback provider marker must be explicit");
  assert(result.usedFallback, "fallback result must be marked");
});

Deno.test("all providers failing returns a safe fallback without exposing provider errors or business context", async () => {
  const secret = "PRIVATE_CLIENT_PHONE_201000000000";
  const context = "PRIVATE_MEDICAL_RECORD_SHOULD_NEVER_BE_USED";
  const result = await runCopilotProviderCascade([
    { name: "groq:test-model", run: async () => { throw new Error("GROQ_429 " + secret); } },
    { name: "gemini:test-model", run: async () => { throw new Error("GEMINI_503 " + context); } },
  ], "deterministic local fallback");

  assert(result.reply === "deterministic local fallback", "provider outages must return the configured local reply");
  assert(result.provider === "local-fallback" && result.usedFallback, "result must identify local fallback");
  assert(!result.reply.includes(secret) && !result.reply.includes(context), "sensitive values must not be copied into fallback");
  assert(!result.reply.includes("429") && !result.reply.includes("503"), "provider status details must not be copied");
});

Deno.test("local fallback uses the user's language and contains no client or medical details", () => {
  const arabic = buildCopilotProviderUnavailableReply([{ content: "حلل لي تجديدات هذا الشهر" }]);
  const english = buildCopilotProviderUnavailableReply([{ content: "Summarize my renewal pipeline" }]);
  assert(arabic.includes("غير متاح مؤقتاً"), "Arabic users should receive an Arabic fallback");
  assert(english.includes("temporarily unavailable"), "English users should receive an English fallback");
  for (const value of [arabic, english]) {
    assert(!value.includes("PRIVATE_"), "fallback must not include private data");
    assert(!value.includes("EGP"), "fallback must not infer financial data");
  }
});
