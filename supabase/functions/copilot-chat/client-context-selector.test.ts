import { buildCopilotContextSelector } from "../../../src/features/copilot/copilot-context-selector.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

Deno.test("browser context is reduced to the approved page selector", () => {
  const selector = buildCopilotContextSelector({
    page: "policies",
    policies: [{ policyNumber: "PRIVATE_POLICY", premium: 999999 }],
    claims: [{ claimNumber: "PRIVATE_CLAIM" }],
    finance: { totalRevenue: 999999999 },
    notes: "PRIVATE_NOTE",
    client: { name: "PRIVATE_CLIENT", phone: "PRIVATE_PHONE" },
  });

  assert(JSON.stringify(selector) === JSON.stringify({ page: "policies" }), "only the approved page should be sent for a list page");
  const serialized = JSON.stringify(selector);
  for (const value of ["PRIVATE_", "policyNumber", "claimNumber", "totalRevenue", "notes", "phone"]) {
    assert(!serialized.includes(value), "business values must not leave the browser: " + value);
  }
});

Deno.test("Client 360 sends only a validated client document ID", () => {
  const selector = buildCopilotContextSelector({
    page: "client-details",
    client: {
      id: "client_123-abc",
      name: "PRIVATE_CLIENT",
      phone: "PRIVATE_PHONE",
      email: "PRIVATE_EMAIL",
      notes: "PRIVATE_NOTE",
      nationalId: "PRIVATE_IDENTITY",
    },
    policies: [{ policyNumber: "PRIVATE_POLICY" }],
  });

  assert(JSON.stringify(selector) === JSON.stringify({ page: "client-details", client: { id: "client_123-abc" } }), "only page and client ID may be sent");
});

Deno.test("unsupported pages and invalid IDs fail closed", () => {
  const unknownPage = buildCopilotContextSelector({
    page: "admin-private-records",
    notes: "PRIVATE_NOTE",
  });
  assert(JSON.stringify(unknownPage) === JSON.stringify({ page: "general" }), "unknown page must fall back to general");

  const badId = buildCopilotContextSelector({
    page: "client-details",
    client: { id: "../other-tenant", name: "PRIVATE_CLIENT" },
  });
  assert(JSON.stringify(badId) === JSON.stringify({ page: "client-details" }), "invalid document ID must not be forwarded");

  assert(buildCopilotContextSelector("raw string") === undefined, "primitive context should be ignored");
  assert(buildCopilotContextSelector(null) === undefined, "null context should be ignored");
});

Deno.test("Lead 360 browser selector sends only the validated lead document ID", () => {
  const selector = buildCopilotContextSelector({
    page: "lead-details",
    lead: {
      id: "lead_123-abc",
      name: "PRIVATE_LEAD_NAME",
      companyName: "PRIVATE_COMPANY",
      email: "PRIVATE_EMAIL",
      phone: "PRIVATE_PHONE",
      notes: "PRIVATE_NOTES",
    },
    leads: [{ stage: "qualified", estimatedValue: 999999 }],
  });

  assert(JSON.stringify(selector) === JSON.stringify({ page: "lead-details", lead: { id: "lead_123-abc" } }), "only page and validated lead ID may be sent");
});

Deno.test("Lead 360 selector drops invalid lead IDs", () => {
  const selector = buildCopilotContextSelector({
    page: "lead-details",
    lead: { id: "../foreign", name: "PRIVATE_LEAD_NAME" },
  });

  assert(JSON.stringify(selector) === JSON.stringify({ page: "lead-details" }), "invalid lead ID must not be forwarded");
});
