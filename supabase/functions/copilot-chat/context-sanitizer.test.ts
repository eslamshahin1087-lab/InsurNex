import { sanitizeCopilotContext } from "./context-sanitizer.ts";

function expect(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

Deno.test("context is field-allow-listed", () => {
  const value = sanitizeCopilotContext({
    client: { id: "a1", name: "Alice", email: "alice@example.test", type: "business", status: "active" },
    policy: { policyNumber: "P-123", insurerName: "Insurer A", premium: 300, currency: "EGP", status: "active" },
    notes: "private free text",
    claims: [{ claimNumber: "C-123", claimAmount: 500, status: "open", medicalDetails: "private" }],
  });
  expect(value, "valid context should remain");
  const text = JSON.stringify(value);
  expect(!text.includes("Alice"), "client name must be excluded");
  expect(!text.includes("alice@example.test"), "email must be excluded");
  expect(!text.includes("P-123"), "policy number must be excluded");
  expect(!text.includes("private"), "free text and unsupported fields must be excluded");
  expect(!text.includes("C-123"), "claim number must be excluded");
  expect(value.policy?.premium === 300, "approved numeric data should remain");
});

Deno.test("context arrays are bounded and invalid shapes are ignored", () => {
  const value = sanitizeCopilotContext({
    policies: Array.from({ length: 25 }, (_, i) => ({ insurerName: "Insurer " + i, premium: i })),
    claims: Array.from({ length: 20 }, () => ({ claimAmount: 1, status: "open" })),
    tasks: "invalid",
  });
  expect(value, "context with supported arrays should remain");
  expect(value.policies?.length === 20, "policy list must be capped");
  expect(value.claims?.length === 15, "claim list must be capped");
  expect(value.tasks === undefined, "invalid task list must be ignored");
});

Deno.test("empty or non-object context is omitted", () => {
  expect(sanitizeCopilotContext(null) === undefined, "null should be omitted");
  expect(sanitizeCopilotContext({ notes: "private" }) === undefined, "unsupported-only context should be omitted");
});
