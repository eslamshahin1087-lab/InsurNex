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

Deno.test("finance summary is computed from authorized bounded records, not client-supplied totals", async () => {
  const requests: Array<{ collectionId: string; authorization: string | null; body: Record<string, unknown> }> = [];
  const records: Record<string, unknown[]> = {
    revenue: [
      doc({ organizationId: "org-finance", amount: 2000, status: "confirmed", currency: "EGP", type: "fee", clientName: "PRIVATE_CLIENT" }),
      doc({ organizationId: "org-finance", amount: 300, status: "pending", currency: "EGP", type: "premium" }),
    ],
    expenses: [
      doc({ organizationId: "org-finance", amount: 400, currency: "EGP", category: "operational", description: "PRIVATE_DESCRIPTION" }),
    ],
    commissions: [
      doc({ organizationId: "org-finance", commissionAmount: 100, status: "pending", currency: "EGP", policyNumber: "PRIVATE_POLICY" }),
      doc({ organizationId: "org-finance", commissionAmount: 50, status: "received", currency: "EGP" }),
    ],
  };
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const authorization = new Headers(init?.headers).get("Authorization");
    const body = JSON.parse(String(init?.body)) as {
      structuredQuery: {
        from: Array<{ collectionId: string }>;
        where: unknown;
        select: { fields: Array<{ fieldPath: string }> };
        limit: number;
      };
    };
    const collectionId = body.structuredQuery.from[0].collectionId;
    requests.push({ collectionId, authorization, body: body as unknown as Record<string, unknown> });
    return Response.json(records[collectionId] ?? []);
  }) as typeof fetch;

  const context = await buildAuthorizedCopilotContext({
    projectId: "demo-project",
    organizationId: "org-finance",
    idToken: "finance-user-token",
    isPlatformAdmin: false,
    requestedContext: {
      page: "finance",
      finance: { totalRevenue: 999999999, netIncome: 999999999 },
      notes: "FORGED_FINANCE_NOTES",
    },
    fetcher,
  });

  assert(requests.length === 3, "finance context must read each ledger collection separately");
  assert(requests.every((request) => request.authorization === "Bearer finance-user-token"), "all finance queries must use the authenticated caller token");
  assert(requests.every((request) => JSON.stringify(request.body.structuredQuery.where).includes("org-finance")), "every finance query must filter to the verified organization");
  assert(requests.every((request) => request.body.structuredQuery.limit === 500), "finance reads must respect the existing 500-row ledger cap");
  const summary = context?.finance as Record<string, unknown> | undefined;
  assert(summary?.totalRevenue === 2000, "only confirmed revenue should be included");
  assert(summary.totalExpenses === 400, "expenses should be aggregated from server-returned records");
  assert(summary.netIncome === 1600, "net income should be deterministically computed");
  assert(summary.pendingCommissions === 100, "pending commissions should be aggregated");
  assert(summary.receivedCommissions === 50, "received commissions should be aggregated");
  assert(summary.currency === "EGP", "the one consistent currency should be preserved");
  const serialized = JSON.stringify(context);
  assert(!serialized.includes("FORGED"), "client-supplied finance data and notes must be ignored");
  assert(!serialized.includes("PRIVATE_CLIENT"), "client names must not be included in finance context");
  assert(!serialized.includes("PRIVATE_DESCRIPTION"), "expense descriptions must not be included in finance context");
  assert(!serialized.includes("PRIVATE_POLICY"), "policy identifiers must not be included in finance context");
});

Deno.test("finance summary is omitted rather than mixing currencies", async () => {
  const records: Record<string, unknown[]> = {
    revenue: [doc({ organizationId: "org-finance", amount: 100, status: "confirmed", currency: "EGP" })],
    expenses: [doc({ organizationId: "org-finance", amount: 10, category: "other", currency: "USD" })],
    commissions: [doc({ organizationId: "org-finance", commissionAmount: 5, status: "pending", currency: "EGP" })],
  };
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { structuredQuery: { from: Array<{ collectionId: string }> } };
    return Response.json(records[body.structuredQuery.from[0].collectionId] ?? []);
  }) as typeof fetch;
  const context = await buildAuthorizedCopilotContext({
    projectId: "demo-project",
    organizationId: "org-finance",
    idToken: "finance-user-token",
    isPlatformAdmin: false,
    requestedContext: { page: "finance", finance: { totalRevenue: 1234 } },
    fetcher,
  });
  assert(context?.finance === undefined, "mixed-currency totals must not be surfaced as one number");
});
