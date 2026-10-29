import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveCopilotContextForRoute } from "../../../src/features/copilot/copilot-context-route.ts";
import type { CopilotContextSelector } from "../../../src/features/copilot/copilot-context-selector.ts";

Deno.test("route context accepts the matching collection page", () => {
  const context: CopilotContextSelector = { page: "renewals" };
  assertEquals(resolveCopilotContextForRoute("/renewals", context), context);
});

Deno.test("route context rejects a previous page selector after navigation", () => {
  assertEquals(resolveCopilotContextForRoute("/settings", { page: "client-details", client: { id: "client-1" } }), undefined);
  assertEquals(resolveCopilotContextForRoute("/claims", { page: "client-details", client: { id: "client-1" } }), undefined);
});

Deno.test("detail route requires the exact record ID", () => {
  const correct: CopilotContextSelector = { page: "client-details", client: { id: "client-42" } };
  const stale: CopilotContextSelector = { page: "client-details", client: { id: "client-41" } };
  assertEquals(resolveCopilotContextForRoute("/clients/client-42", correct), correct);
  assertEquals(resolveCopilotContextForRoute("/clients/client-42", stale), undefined);
  assertEquals(resolveCopilotContextForRoute("/clients/client-42/insurance-analysis", correct), correct);
});

Deno.test("Policy, Claim, and Lead 360 selectors must match the route ID", () => {
  assertEquals(
    resolveCopilotContextForRoute("/policies/policy-2", { page: "policy-details", policyRef: { id: "policy-2" } }),
    { page: "policy-details", policyRef: { id: "policy-2" } },
  );
  assertEquals(
    resolveCopilotContextForRoute("/claims/claim-2", { page: "claim-details", claimRef: { id: "claim-1" } }),
    undefined,
  );
  assertEquals(
    resolveCopilotContextForRoute("/leads/lead-2", { page: "lead-details", lead: { id: "lead-2" } }),
    { page: "lead-details", lead: { id: "lead-2" } },
  );
});

Deno.test("full Copilot page preserves the page context from which it was opened", () => {
  const context: CopilotContextSelector = { page: "client-details", client: { id: "client-42" } };
  assertEquals(resolveCopilotContextForRoute("/copilot", context), context);
});

Deno.test("routes without a defined business context do not inherit one", () => {
  const context: CopilotContextSelector = { page: "finance" };
  for (const path of ["/documents", "/settings", "/operations", "/analytics/medical", "/ai/file-analysis", "/more"]) {
    assertEquals(resolveCopilotContextForRoute(path, context), undefined, path + " must not inherit a previous selector");
  }
});

Deno.test("invalid encoded detail route IDs fail closed", () => {
  assertEquals(
    resolveCopilotContextForRoute("/clients/%2Fother-org", { page: "client-details", client: { id: "other-org" } }),
    undefined,
  );
});
