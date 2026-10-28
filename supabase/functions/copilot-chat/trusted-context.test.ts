import { buildAuthorizedCopilotContext } from "./trusted-context.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function doc(fields: Record<string, unknown>, name = "projects/demo/databases/(default)/documents/policies/policy-1") {
  return {
    document: {
      name,
      fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => {
        if (typeof value === "string") return [key, { stringValue: value }];
        if (typeof value === "number") return [key, { doubleValue: value }];
        if (typeof value === "boolean") return [key, { booleanValue: value }];
        return [key, { stringValue: String(value) }];
      })),
    },
  };
}

Deno.test("policies context is read from Firestore with tenant filters and field projection", async () => {
  const requests: Array<{ url: string; authorization: string | null; body: Record<string, unknown> }> = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    requests.push({ url, authorization: headers.get("Authorization"), body });

    return Response.json([
      doc({
        organizationId: "org-safe",
        insurerName: "Trusted insurer",
        line: "motor",
        expiryDate: "2027-05-01",
        premium: 2500,
        currency: "EGP",
        status: "active",
        clientName: "DO_NOT_SEND_CLIENT_NAME",
        policyNumber: "DO_NOT_SEND_POLICY_NUMBER",
        documentUrl: "DO_NOT_SEND_DOCUMENT_URL",
      }),
      doc({
        organizationId: "org-other",
        insurerName: "OTHER_TENANT_INSURER",
        line: "health",
        expiryDate: "2027-06-01",
        premium: 9000,
        currency: "EGP",
        status: "active",
      }, "projects/demo/databases/(default)/documents/policies/other-policy"),
    ]);
  }) as typeof fetch;

  const context = await buildAuthorizedCopilotContext({
    projectId: "demo-project",
    organizationId: "org-safe",
    idToken: "firebase-user-token",
    isPlatformAdmin: false,
    requestedContext: {
      page: "policies",
      policies: [{ insurerName: "CLIENT_FORGED_INSURER", premium: 999999 }],
      notes: "CLIENT_FORGED_NOTES",
      client: { name: "CLIENT_FORGED_NAME", phone: "CLIENT_FORGED_PHONE" },
    },
    fetcher,
  });

  assert(requests.length === 1, "policy page should execute one server-side query");
  assert(requests[0].authorization === "Bearer firebase-user-token", "query must use the caller Firebase ID token");
  assert(requests[0].url.includes("documents:runQuery"), "data must be loaded through Firestore runQuery");
  const structured = requests[0].body.structuredQuery as Record<string, unknown>;
  const select = structured.select as { fields: Array<{ fieldPath: string }> };
  const selectedFields = select.fields.map((field) => field.fieldPath);
  assert(selectedFields.includes("organizationId"), "projection must include the tenant discriminator");
  assert(selectedFields.includes("premium"), "projection should include permitted policy summary values");
  for (const privateField of ["clientName", "policyNumber", "documentUrl", "nationalId", "phone", "email"]) {
    assert(!selectedFields.includes(privateField), "private field must not be queried: " + privateField);
  }
  const serializedQuery = JSON.stringify(structured.where);
  assert(serializedQuery.includes("org-safe"), "query must be filtered to the verified organization");
  assert(!serializedQuery.includes("org-other"), "query must not request another organization");

  const serializedContext = JSON.stringify(context);
  assert(serializedContext.includes("Trusted insurer"), "server-loaded record should be present");
  assert(!serializedContext.includes("CLIENT_FORGED"), "browser-supplied business values must be ignored");
  assert(!serializedContext.includes("DO_NOT_SEND"), "private fields must not enter model context");
  assert(!serializedContext.includes("OTHER_TENANT"), "cross-tenant results must be dropped in defense in depth");
});

Deno.test("client details selector is verified before related data queries", async () => {
  const requests: string[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push(url);
    if (url.includes("/documents/clients/client-from-other-tenant")) {
      return Response.json({
        name: "projects/demo/databases/(default)/documents/clients/client-from-other-tenant",
        fields: {
          organizationId: { stringValue: "org-other" },
          type: { stringValue: "individual" },
          status: { stringValue: "active" },
        },
      });
    }
    return Response.json([]);
  }) as typeof fetch;

  const context = await buildAuthorizedCopilotContext({
    projectId: "demo-project",
    organizationId: "org-safe",
    idToken: "firebase-user-token",
    isPlatformAdmin: false,
    requestedContext: {
      page: "client-details",
      client: {
        id: "client-from-other-tenant",
        type: "corporate",
        status: "active",
        phone: "CLIENT_SUPPLIED_PHONE",
      },
      policies: [{ insurerName: "CLIENT_SUPPLIED_INSURER" }],
    },
    fetcher,
  });

  assert(requests.length === 1, "no related collection should be queried after a tenant mismatch");
  assert(context?.client === undefined, "foreign client context must not be returned");
  assert(!JSON.stringify(context).includes("CLIENT_SUPPLIED"), "browser business values must never be copied");
});

Deno.test("platform-admin scope returns no tenant context and performs no Firestore data reads", async () => {
  let calls = 0;
  const fetcher = (async () => {
    calls += 1;
    return Response.json([]);
  }) as typeof fetch;
  const context = await buildAuthorizedCopilotContext({
    projectId: "demo-project",
    organizationId: null,
    idToken: "admin-token",
    isPlatformAdmin: true,
    requestedContext: {
      page: "dashboard",
      stats: { totalClients: 123456 },
      policies: [{ policyNumber: "PRIVATE_POLICY" }],
    },
    fetcher,
  });

  assert(calls === 0, "platform-admin private scope must not read tenant records");
  assert(JSON.stringify(context) === JSON.stringify({ page: "dashboard" }), "only the safe page label may remain");
});

Deno.test("permission failures are not converted into zero-client statistics", async () => {
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("documents:runQuery")) return new Response("forbidden", { status: 403 });
    return new Response(null, { status: 404 });
  }) as typeof fetch;
  const context = await buildAuthorizedCopilotContext({
    projectId: "demo-project",
    organizationId: "org-safe",
    idToken: "firebase-user-token",
    isPlatformAdmin: false,
    requestedContext: { page: "clients" },
    fetcher,
  });

  assert(context?.stats === undefined, "denied client query must not be represented as zero clients");
});
