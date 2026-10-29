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
  type FinanceQueryBody = {
    structuredQuery: {
      from: Array<{ collectionId: string }>;
      where: unknown;
      select: { fields: Array<{ fieldPath: string }> };
      limit: number;
    };
  };
  const requests: Array<{ collectionId: string; authorization: string | null; body: FinanceQueryBody }> = [];
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
    const body = JSON.parse(String(init?.body)) as FinanceQueryBody;
    const collectionId = body.structuredQuery.from[0].collectionId;
    requests.push({ collectionId, authorization, body });
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

Deno.test("renewal context prioritizes actionable dates from a bounded org-scoped sample", async () => {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => dateParts.find((item) => item.type === type)?.value ?? "";
  const currentDay = [part("year"), part("month"), part("day")].join("-");
  const dateOffset = (offset: number) => {
    const [year, month, day] = currentDay.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
  };

  const requests: Array<{ body: Record<string, unknown>; authorization: string | null }> = [];
  const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    requests.push({ body, authorization: new Headers(init?.headers).get("Authorization") });
    return Response.json([
      doc({
        organizationId: "org-renewals", insurerName: "Soon Insurer", line: "motor",
        expiryDate: dateOffset(2), premium: 3200, currency: "EGP", status: "active",
        policyNumber: "PRIVATE_SOON_POLICY", clientName: "PRIVATE_CLIENT_NAME",
      }),
      doc({
        organizationId: "org-renewals", insurerName: "Recently Overdue Insurer", line: "health",
        expiryDate: dateOffset(-4), premium: 2200, currency: "EGP", status: "active",
      }),
      doc({
        organizationId: "org-renewals", insurerName: "Later Insurer", line: "property",
        expiryDate: dateOffset(14), premium: 1500, currency: "EGP", status: "active",
      }),
      doc({
        organizationId: "org-renewals", insurerName: "Stale Overdue Insurer", line: "motor",
        expiryDate: dateOffset(-180), premium: 3000, currency: "EGP", status: "active",
      }),
      doc({
        organizationId: "org-renewals", insurerName: "Far Future Insurer", line: "motor",
        expiryDate: dateOffset(200), premium: 1000, currency: "EGP", status: "active",
      }),
      doc({
        organizationId: "org-renewals", insurerName: "Cancelled Insurer", line: "motor",
        expiryDate: dateOffset(1), premium: 1000, currency: "EGP", status: "cancelled",
      }),
      doc({
        organizationId: "org-renewals", insurerName: "Invalid Date Insurer", line: "motor",
        expiryDate: "2027-02-31", premium: 1000, currency: "EGP", status: "active",
      }),
      doc({
        organizationId: "org-other", insurerName: "OTHER_TENANT_INSURER", line: "motor",
        expiryDate: dateOffset(1), premium: 99999, currency: "EGP", status: "active",
      }),
      doc({
        organizationId: "org-renewals", insurerName: "Missing Date Insurer", line: "motor",
        expiryDate: "", premium: 1000, currency: "EGP", status: "active",
      }),
    ]);
  }) as typeof fetch;

  const context = await buildAuthorizedCopilotContext({
    projectId: "demo-project",
    organizationId: "org-renewals",
    idToken: "renewal-user-token",
    isPlatformAdmin: false,
    requestedContext: { page: "renewals", renewals: [{ policyNumber: "FORGED_POLICY" }] },
    fetcher,
  });

  assert(requests.length === 1, "renewal page must load a single bounded policy sample");
  assert(requests[0].authorization === "Bearer renewal-user-token", "renewal query must use caller Firebase token");
  const structured = requests[0].body.structuredQuery as Record<string, unknown>;
  assert(structured.orderBy === undefined, "renewal sample must be sorted by computed days-left, not oldest expiry first in Firestore");
  assert(structured.limit === 300, "renewal sampling should match the renewal page's 300-policy cap");
  assert(JSON.stringify(structured.where).includes("org-renewals"), "renewal query must be scoped to the verified organization");

  const renewals = context?.renewals as Array<Record<string, unknown>> | undefined;
  assert(Array.isArray(renewals) && renewals.length === 3, "only valid, non-cancelled dates inside the action window should be returned");
  assert(renewals[0].daysLeft === 2, "nearest upcoming expiry should be prioritized first");
  assert(renewals[1].daysLeft === -4, "recently overdue policy should be retained after the nearest date");
  assert(renewals[2].daysLeft === 14, "the next upcoming expiry should follow the nearest action dates");
  assert(!JSON.stringify(renewals).includes("Stale Overdue Insurer"), "very old expiries must not crowd out actionable renewals");
  assert(!JSON.stringify(renewals).includes("Far Future Insurer"), "far-future expiries must not crowd out actionable renewals");
  assert(!JSON.stringify(renewals).includes("Cancelled Insurer"), "cancelled policies must not appear in the renewal watchlist");
  assert(!JSON.stringify(renewals).includes("Invalid Date Insurer"), "invalid dates must not appear in the renewal watchlist");
  assert(!JSON.stringify(renewals).includes("OTHER_TENANT_INSURER"), "foreign-tenant policies must be excluded");
  assert(context?.policies === undefined, "renewals should use a dedicated renewal context section");
  const serialized = JSON.stringify(context);
  for (const privateValue of ["PRIVATE_SOON_POLICY", "PRIVATE_CLIENT_NAME", "FORGED_POLICY"]) {
    assert(!serialized.includes(privateValue), "private or browser-supplied renewal data must be excluded: " + privateValue);
  }
});

Deno.test("Client 360 task context uses relatedType/relatedId schema, not a nonexistent clientId field", async () => {
  const requests: Array<{ collectionId: string; body: Record<string, unknown> }> = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/documents/clients/client-123")) {
      return Response.json({
        name: "projects/demo/databases/(default)/documents/clients/client-123",
        fields: {
          organizationId: { stringValue: "org-client" },
          type: { stringValue: "corporate" },
          status: { stringValue: "active" },
        },
      });
    }

    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    const structured = body.structuredQuery as Record<string, unknown>;
    const collectionId = ((structured.from as Array<{ collectionId: string }>)[0]).collectionId;
    requests.push({ collectionId, body });
    if (collectionId === "tasks") {
      return Response.json([doc({
        organizationId: "org-client",
        status: "open",
        priority: "high",
        dueDate: "2027-01-15",
        createdAt: "2026-10-29T09:00:00Z",
        title: "PRIVATE_TASK_TITLE",
      })]);
    }
    if (collectionId === "policies") {
      return Response.json([doc({
        organizationId: "org-client",
        insurerName: "Client Insurer",
        line: "motor",
        expiryDate: "2027-01-15",
        premium: 3200,
        currency: "EGP",
        status: "active",
      })]);
    }
    return Response.json([doc({
      organizationId: "org-client",
      insurerName: "Client Insurer",
      currency: "EGP",
      status: "open",
      incidentDate: "2026-09-15",
      claimAmount: 5000,
    })]);
  }) as typeof fetch;

  const context = await buildAuthorizedCopilotContext({
    projectId: "demo-project",
    organizationId: "org-client",
    idToken: "client-user-token",
    isPlatformAdmin: false,
    requestedContext: {
      page: "client-details",
      client: { id: "client-123", name: "FORGED_CLIENT_NAME", phone: "FORGED_PHONE" },
      tasks: [{ title: "FORGED_TASK" }],
    },
    fetcher,
  });

  assert(requests.length === 3, "Client 360 should query policies, claims, and tasks after validating the client");
  const taskRequest = requests.find((request) => request.collectionId === "tasks");
  assert(taskRequest !== undefined, "task context query must be made");
  const structured = taskRequest.body.structuredQuery as Record<string, unknown>;
  const serializedWhere = JSON.stringify(structured.where);
  assert(serializedWhere.includes('"fieldPath":"relatedType"'), "task query must filter by relatedType");
  assert(serializedWhere.includes('"stringValue":"client"'), "task query must select client-related tasks");
  assert(serializedWhere.includes('"fieldPath":"relatedId"'), "task query must filter by relatedId");
  assert(serializedWhere.includes('"stringValue":"client-123"'), "task query must use the validated client ID");
  assert(!serializedWhere.includes('"fieldPath":"clientId"'), "task collection does not use a clientId relation field");

  const tasks = context?.tasks as Array<Record<string, unknown>> | undefined;
  assert(Array.isArray(tasks) && tasks.length === 1, "validated client task summary must be available");
  assert(tasks[0].status === "open" && tasks[0].priority === "high", "safe task fields should remain");
  assert(!JSON.stringify(context).includes("PRIVATE_TASK_TITLE"), "task titles must not be sent to the model");
  assert(!JSON.stringify(context).includes("FORGED_"), "browser-supplied client or task data must be ignored");
});

Deno.test("Lead 360 loads allow-listed fields from a verified tenant lead document", async () => {
  const seen: Array<{ url: string; authorization: string | null }> = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    seen.push({ url, authorization: new Headers(init?.headers).get("Authorization") });
    return Response.json({
      name: "projects/demo/databases/(default)/documents/leads/lead-123",
      fields: {
        organizationId: { stringValue: "org-lead" },
        stage: { stringValue: "qualified" },
        insuranceType: { stringValue: "motor" },
        estimatedValue: { doubleValue: 25000 },
        name: { stringValue: "PRIVATE_LEAD_NAME" },
        companyName: { stringValue: "PRIVATE_COMPANY_NAME" },
        email: { stringValue: "PRIVATE_EMAIL" },
        phone: { stringValue: "PRIVATE_PHONE" },
        notes: { stringValue: "PRIVATE_NOTES" },
      },
    });
  }) as typeof fetch;

  const context = await buildAuthorizedCopilotContext({
    projectId: "demo-project",
    organizationId: "org-lead",
    idToken: "lead-user-token",
    isPlatformAdmin: false,
    requestedContext: {
      page: "lead-details",
      lead: { id: "lead-123", name: "FORGED_LEAD_NAME", companyName: "FORGED_COMPANY" },
      leads: [{ stage: "forged", estimatedValue: 999999 }],
      notes: "FORGED_NOTES",
    },
    fetcher,
  });

  assert(seen.length === 1, "Lead 360 should fetch only the selected lead document");
  assert(seen[0].url.includes("/documents/leads/lead-123"), "server must fetch the selected lead document");
  assert(seen[0].authorization === "Bearer lead-user-token", "lead read must use the authenticated Firebase token");
  const url = new URL(seen[0].url);
  const maskedFields = url.searchParams.getAll("mask.fieldPaths");
  for (const field of ["organizationId", "stage", "insuranceType", "estimatedValue"]) {
    assert(maskedFields.includes(field), "safe Lead 360 field projection is missing: " + field);
  }
  for (const privateField of ["name", "companyName", "email", "phone", "notes"]) {
    assert(!maskedFields.includes(privateField), "private field must not be requested: " + privateField);
  }

  const leads = context?.leads as Array<Record<string, unknown>> | undefined;
  assert(Array.isArray(leads) && leads.length === 1, "Lead 360 must return one selected-lead summary");
  assert(leads[0].stage === "qualified", "server stage should be used instead of browser stage");
  assert(leads[0].insuranceType === "motor", "server insurance type should be used");
  assert(leads[0].estimatedValue === 25000, "server value should be used");
  const serialized = JSON.stringify(context);
  for (const privateValue of ["PRIVATE_LEAD_NAME", "PRIVATE_COMPANY_NAME", "PRIVATE_EMAIL", "PRIVATE_PHONE", "PRIVATE_NOTES", "FORGED_"]) {
    assert(!serialized.includes(privateValue), "private or forged lead data leaked into context: " + privateValue);
  }
});

Deno.test("Lead 360 does not return a lead from another organization", async () => {
  let calls = 0;
  const fetcher = (async () => {
    calls += 1;
    return Response.json({
      name: "projects/demo/databases/(default)/documents/leads/foreign-lead",
      fields: {
        organizationId: { stringValue: "org-other" },
        stage: { stringValue: "qualified" },
        insuranceType: { stringValue: "motor" },
        estimatedValue: { doubleValue: 50000 },
      },
    });
  }) as typeof fetch;

  const context = await buildAuthorizedCopilotContext({
    projectId: "demo-project",
    organizationId: "org-lead",
    idToken: "lead-user-token",
    isPlatformAdmin: false,
    requestedContext: { page: "lead-details", lead: { id: "foreign-lead" } },
    fetcher,
  });

  assert(calls === 1, "selected lead should be checked once");
  assert(context?.leads === undefined, "cross-tenant Lead 360 context must be omitted");
  assert(context?.page === "lead-details", "safe page label may remain after a tenant mismatch");
});



Deno.test("Policy 360 loads only allow-listed server fields for a same-tenant policy", async () => {
  const seen: Array<{ url: string; authorization: string | null }> = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    seen.push({ url, authorization: new Headers(init?.headers).get("Authorization") });
    return Response.json({
      name: "projects/demo/databases/(default)/documents/policies/policy-123",
      fields: {
        organizationId: { stringValue: "org-policy" },
        insurerName: { stringValue: "Trusted insurer" },
        line: { stringValue: "motor" },
        startDate: { stringValue: "2026-01-01" },
        expiryDate: { stringValue: "2027-01-01" },
        premium: { doubleValue: 4500 },
        currency: { stringValue: "EGP" },
        status: { stringValue: "active" },
        policyNumber: { stringValue: "PRIVATE_POLICY_NUMBER" },
        clientId: { stringValue: "PRIVATE_CLIENT_ID" },
        clientName: { stringValue: "PRIVATE_CLIENT_NAME" },
        downloadUrl: { stringValue: "PRIVATE_DOCUMENT_URL" },
      },
    });
  }) as typeof fetch;

  const context = await buildAuthorizedCopilotContext({
    projectId: "demo-project",
    organizationId: "org-policy",
    idToken: "policy-user-token",
    isPlatformAdmin: false,
    requestedContext: {
      page: "policy-details",
      policyRef: { id: "policy-123", policyNumber: "FORGED_POLICY" },
      policy: { insurerName: "FORGED_INSURER", premium: 999999 },
      notes: "FORGED_NOTES",
    },
    fetcher,
  });

  assert(seen.length === 1, "Policy 360 should fetch only the selected policy");
  assert(seen[0].url.includes("/documents/policies/policy-123"), "server must use the selected policy ID");
  assert(seen[0].authorization === "Bearer policy-user-token", "policy lookup must use caller Firebase token");
  const url = new URL(seen[0].url);
  const mask = url.searchParams.getAll("mask.fieldPaths");
  for (const field of ["organizationId", "insurerName", "line", "startDate", "expiryDate", "premium", "currency", "status"]) {
    assert(mask.includes(field), "required Policy 360 field is missing from field mask: " + field);
  }
  for (const field of ["policyNumber", "clientId", "clientName", "downloadUrl", "notes"]) {
    assert(!mask.includes(field), "sensitive Policy 360 field must not be requested: " + field);
  }

  const policy = context?.policy as Record<string, unknown> | undefined;
  assert(policy?.insurerName === "Trusted insurer", "server insurer name should be used");
  assert(policy?.premium === 4500 && policy?.currency === "EGP", "server financial fields should be used");
  assert(policy?.status === "active", "server policy status should be used");
  assert(!JSON.stringify(context).includes("PRIVATE_"), "private policy fields must not enter the prompt");
  assert(!JSON.stringify(context).includes("FORGED_"), "browser-supplied policy details must be ignored");
});

Deno.test("Claim 360 loads allow-listed server fields and excludes identifiers and medical notes", async () => {
  const seen: Array<{ url: string; authorization: string | null }> = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    seen.push({ url, authorization: new Headers(init?.headers).get("Authorization") });
    return Response.json({
      name: "projects/demo/databases/(default)/documents/claims/claim-123",
      fields: {
        organizationId: { stringValue: "org-claim" },
        insurerName: { stringValue: "Trusted insurer" },
        currency: { stringValue: "EGP" },
        status: { stringValue: "review" },
        incidentDate: { stringValue: "2026-10-01" },
        claimAmount: { doubleValue: 12000 },
        claimNumber: { stringValue: "PRIVATE_CLAIM_NUMBER" },
        policyNumber: { stringValue: "PRIVATE_POLICY_NUMBER" },
        clientName: { stringValue: "PRIVATE_CLIENT_NAME" },
        description: { stringValue: "PRIVATE_DESCRIPTION" },
        medicalDetails: { stringValue: "PRIVATE_MEDICAL_DETAILS" },
      },
    });
  }) as typeof fetch;

  const context = await buildAuthorizedCopilotContext({
    projectId: "demo-project",
    organizationId: "org-claim",
    idToken: "claim-user-token",
    isPlatformAdmin: false,
    requestedContext: {
      page: "claim-details",
      claimRef: { id: "claim-123", claimNumber: "FORGED_CLAIM" },
      claim: { claimAmount: 999999, status: "forged" },
      notes: "FORGED_NOTES",
    },
    fetcher,
  });

  assert(seen.length === 1, "Claim 360 should fetch only the selected claim");
  assert(seen[0].url.includes("/documents/claims/claim-123"), "server must use the selected claim ID");
  assert(seen[0].authorization === "Bearer claim-user-token", "claim lookup must use caller Firebase token");
  const url = new URL(seen[0].url);
  const mask = url.searchParams.getAll("mask.fieldPaths");
  for (const field of ["organizationId", "insurerName", "currency", "status", "incidentDate", "claimAmount"]) {
    assert(mask.includes(field), "required Claim 360 field is missing from field mask: " + field);
  }
  for (const field of ["claimNumber", "policyNumber", "clientName", "description", "medicalDetails", "notes"]) {
    assert(!mask.includes(field), "sensitive Claim 360 field must not be requested: " + field);
  }

  const claim = context?.claim as Record<string, unknown> | undefined;
  assert(claim?.claimAmount === 12000 && claim?.currency === "EGP", "server claim amount/currency should be used");
  assert(claim?.status === "review", "server claim status should be used");
  const serialized = JSON.stringify(context);
  for (const privateValue of ["PRIVATE_", "FORGED_"]) {
    assert(!serialized.includes(privateValue), "private or browser-supplied claim data must not enter the prompt");
  }
});

Deno.test("Policy and Claim 360 reject records returned for another organization", async () => {
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const collectionName = url.includes("/documents/policies/") ? "policies" : "claims";
    return Response.json({
      name: "projects/demo/databases/(default)/documents/" + collectionName + "/foreign-record",
      fields: {
        organizationId: { stringValue: "org-other" },
        insurerName: { stringValue: "FOREIGN_INSURER" },
        line: { stringValue: "motor" },
        currency: { stringValue: "EGP" },
        status: { stringValue: "active" },
        expiryDate: { stringValue: "2027-01-01" },
        incidentDate: { stringValue: "2026-10-01" },
        premium: { doubleValue: 1 },
        claimAmount: { doubleValue: 2 },
      },
    });
  }) as typeof fetch;

  for (const [page, selectorKey, id] of [
    ["policy-details", "policyRef", "foreign-policy"],
    ["claim-details", "claimRef", "foreign-claim"],
  ] as const) {
    const context = await buildAuthorizedCopilotContext({
      projectId: "demo-project",
      organizationId: "org-current",
      idToken: "current-user-token",
      isPlatformAdmin: false,
      requestedContext: { page, [selectorKey]: { id } },
      fetcher,
    });
    assert(context?.policy === undefined, "foreign policy context must be omitted");
    assert(context?.claim === undefined, "foreign claim context must be omitted");
    assert(!JSON.stringify(context).includes("FOREIGN_INSURER"), "foreign tenant data must not enter the prompt");
  }
});
