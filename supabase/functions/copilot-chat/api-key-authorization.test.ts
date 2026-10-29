import { isAllowedSupabaseApiKey } from "./api-key-authorization.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

Deno.test("accepts only publishable keys supplied by the trusted Supabase runtime", () => {
  const config = {
    publishableKeysJson: JSON.stringify({
      default: "sb_publishable_expected",
      frontend: "sb_publishable_frontend",
    }),
  };

  assert(isAllowedSupabaseApiKey("sb_publishable_expected", config), "default publishable key should be accepted");
  assert(isAllowedSupabaseApiKey("sb_publishable_frontend", config), "named publishable key should be accepted");
  assert(!isAllowedSupabaseApiKey("sb_publishable_attacker", config), "unknown publishable key must be rejected");
});

Deno.test("supports the legacy anon JWT while the project migrates keys", () => {
  const legacy = "eyJhbGciOiJIUzI1NiJ9.legacy-anon";
  assert(isAllowedSupabaseApiKey(legacy, { legacyAnonKey: legacy }), "trusted legacy anon key should remain compatible");
  assert(!isAllowedSupabaseApiKey("eyJhbGciOiJIUzI1NiJ9.other", { legacyAnonKey: legacy }), "another JWT must not be accepted");
});

Deno.test("fails closed when no API key is supplied or no keys are configured", () => {
  assert(!isAllowedSupabaseApiKey(null, { publishableKeysJson: '{"default":"sb_publishable_expected"}' }), "missing key must fail");
  assert(!isAllowedSupabaseApiKey("", { publishableKeysJson: '{"default":"sb_publishable_expected"}' }), "empty key must fail");
  assert(!isAllowedSupabaseApiKey("sb_publishable_expected", {}), "unconfigured key allow-list must fail");
});

Deno.test("malformed publishable key configuration never throws or accepts arbitrary keys", () => {
  assert(!isAllowedSupabaseApiKey("sb_publishable_attacker", { publishableKeysJson: "{invalid" }), "malformed key config must fail closed");
  assert(isAllowedSupabaseApiKey("trusted-legacy", { legacyAnonKey: "trusted-legacy", publishableKeysJson: "{invalid" }), "configured legacy key can remain available during migration");
});

Deno.test("does not accept non-string values from runtime key JSON", () => {
  const config = { publishableKeysJson: JSON.stringify({ default: 12, ignored: null, good: "sb_publishable_good" }) };
  assert(isAllowedSupabaseApiKey("sb_publishable_good", config), "valid key should be found among mixed values");
  assert(!isAllowedSupabaseApiKey("12", config), "numeric configuration values must not become API keys");
});
