import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getCopilotPageSessionKey } from "./copilot-page-session.ts";

Deno.test("Copilot full-page session scope requires an authenticated user and workspace", () => {
  assertEquals(getCopilotPageSessionKey(null, "org-1", { page: "clients" }), null);
  assertEquals(getCopilotPageSessionKey("user-1", null, { page: "clients" }), null);
});

Deno.test("Copilot full-page session scope separates users and workspaces", () => {
  const context = { page: "clients" };
  assertNotEquals(
    getCopilotPageSessionKey("user-1", "org-1", context),
    getCopilotPageSessionKey("user-2", "org-1", context),
  );
  assertNotEquals(
    getCopilotPageSessionKey("user-1", "org-1", context),
    getCopilotPageSessionKey("user-1", "org-2", context),
  );
});

Deno.test("Copilot full-page session scope separates different records on one route", () => {
  assertNotEquals(
    getCopilotPageSessionKey("user-1", "org-1", { page: "client-details", client: { id: "client-1" } }),
    getCopilotPageSessionKey("user-1", "org-1", { page: "client-details", client: { id: "client-2" } }),
  );
  assertNotEquals(
    getCopilotPageSessionKey("user-1", "org-1", { page: "policy-details", policyRef: { id: "policy-1" } }),
    getCopilotPageSessionKey("user-1", "org-1", { page: "claim-details", claimRef: { id: "claim-1" } }),
  );
});

Deno.test("Copilot session key includes only the minimized selector, never private page fields", () => {
  const key = getCopilotPageSessionKey("user-1", "org-1", {
    page: "client-details",
    client: { id: "client-1", name: "PRIVATE_CLIENT_NAME", phone: "PRIVATE_PHONE", notes: "PRIVATE_NOTES" },
    notes: "PRIVATE_FREE_TEXT",
  });
  if (!key) throw new Error("Expected a session key");
  assertEquals(key.includes("PRIVATE_"), false);
  assertEquals(key.includes("client-1"), true);
});

Deno.test("Copilot session key falls back to a general scope for unsupported context", () => {
  assertEquals(
    getCopilotPageSessionKey("user-1", "org-1", { page: "unknown-page", client: { id: "client-1" } }),
    getCopilotPageSessionKey("user-1", "org-1", undefined),
  );
});
