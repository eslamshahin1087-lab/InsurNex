type FirestoreValue = Record<string, unknown>;
type FirestoreDocument = {
  name?: string;
  fields?: Record<string, FirestoreValue | undefined>;
};

type CollectionKey = "clients" | "policies" | "claims" | "leads" | "tasks" | "insurers" | "revenue" | "expenses" | "commissions";

const PAGE_COLLECTIONS: Record<string, CollectionKey[]> = {
  dashboard: ["clients", "policies", "claims", "leads", "tasks", "insurers"],
  clients: ["clients"],
  policies: ["policies"],
  claims: ["claims"],
  leads: ["leads"],
  tasks: ["tasks"],
  insurers: ["insurers"],
  renewals: ["policies"],
  "client-details": [],
  finance: ["revenue", "expenses", "commissions"],
};

const COLLECTION_FIELDS: Record<CollectionKey, string[]> = {
  clients: ["organizationId", "type", "status", "createdAt"],
  policies: ["organizationId", "insurerName", "line", "expiryDate", "premium", "currency", "status", "createdAt"],
  claims: ["organizationId", "insurerName", "currency", "status", "incidentDate", "claimAmount", "createdAt"],
  leads: ["organizationId", "stage", "insuranceType", "estimatedValue", "createdAt"],
  tasks: ["organizationId", "status", "priority", "dueDate", "createdAt"],
  insurers: ["organizationId", "name", "status"],
  revenue: ["organizationId", "amount", "status", "currency", "date"],
  expenses: ["organizationId", "amount", "currency", "category", "date"],
  commissions: ["organizationId", "commissionAmount", "status", "currency", "createdAt"],
};

const MAX_PER_COLLECTION = 20;
const MAX_FINANCE_ROWS = 500;
const MAX_CLIENT_ID_LENGTH = 160;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fieldValue(fields: Record<string, FirestoreValue | undefined> | undefined, name: string): unknown {
  const value = fields?.[name];
  if (!value) return undefined;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) {
    const parsed = Number(value.integerValue);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if ("doubleValue" in value) {
    const parsed = Number(value.doubleValue);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value && isRecord(value.arrayValue)) {
    const values = Array.isArray(value.arrayValue.values) ? value.arrayValue.values : [];
    return values.map((item) => fieldValue({ item: item as FirestoreValue }, "item"));
  }
  return undefined;
}

function safeScalar(value: unknown): string | number | boolean | undefined {
  if (typeof value === "string") {
    const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
    return cleaned || undefined;
  }
  if (typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1_000_000_000_000_000) return value;
  if (typeof value === "boolean") return value;
  return undefined;
}

function recordToMap(document: FirestoreDocument): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(document.fields ?? {})) {
    const decoded = fieldValue({ [key]: value }, key);
    if (decoded !== undefined) result[key] = decoded;
  }
  return result;
}

function buildQueryBody(
  collectionId: CollectionKey,
  organizationId: string,
  clientId?: string,
  page?: string,
): Record<string, unknown> {
  const filters: Record<string, unknown>[] = [{
    fieldFilter: {
      field: { fieldPath: "organizationId" },
      op: "EQUAL",
      value: { stringValue: organizationId },
    },
  }];

  if (clientId && collectionId === "tasks") {
    filters.push(
      {
        fieldFilter: {
          field: { fieldPath: "relatedType" },
          op: "EQUAL",
          value: { stringValue: "client" },
        },
      },
      {
        fieldFilter: {
          field: { fieldPath: "relatedId" },
          op: "EQUAL",
          value: { stringValue: clientId },
        },
      },
    );
  } else if (clientId) {
    filters.push({
      fieldFilter: {
        field: { fieldPath: "clientId" },
        op: "EQUAL",
        value: { stringValue: clientId },
      },
    });
  }

  const where = filters.length === 1
    ? filters[0]
    : { compositeFilter: { op: "AND", filters } };

  return {
    structuredQuery: {
      from: [{ collectionId }],
      where,
      select: {
        fields: COLLECTION_FIELDS[collectionId].map((fieldPath) => ({ fieldPath })),
      },
      orderBy: [{
        field: {
          fieldPath: page === "renewals" && collectionId === "policies"
            ? "expiryDate"
            : collectionId === "insurers"
              ? "name"
              : collectionId === "revenue" || collectionId === "expenses"
                ? "date"
                : "createdAt",
        },
        direction: collectionId === "insurers" || (page === "renewals" && collectionId === "policies")
          ? "ASCENDING"
          : "DESCENDING",
      }],
      limit: ["revenue", "expenses", "commissions"].includes(collectionId)
        ? MAX_FINANCE_ROWS
        : MAX_PER_COLLECTION,
    },
  };
}

async function queryCollection(
  input: {
    projectId: string;
    organizationId: string;
    idToken: string;
    collectionId: CollectionKey;
    clientId?: string;
    page?: string;
    fetcher: typeof fetch;
  },
): Promise<Record<string, unknown>[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(input.projectId)}/databases/(default)/documents:runQuery`;
  const response = await input.fetcher(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildQueryBody(input.collectionId, input.organizationId, input.clientId, input.page)),
  });

  if (!response.ok) {
    // Do not expose document contents, response bodies, or provider errors.
    throw new Error("FIRESTORE_CONTEXT_QUERY_FAILED");
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("FIRESTORE_CONTEXT_INVALID_RESPONSE");

  return payload
    .filter((entry): entry is { document: FirestoreDocument } =>
      isRecord(entry) && isRecord(entry.document))
    .map((entry) => {
      const data = recordToMap(entry.document);
      // Defense in depth: never use a returned record from another tenant,
      // even if an unexpected proxy or test fixture ignores the Firestore filter.
      if (data.organizationId !== input.organizationId) return null;
      return data;
    })
    .filter((entry): entry is Record<string, unknown> => entry !== null);
}

async function getClientSelector(
  input: {
    projectId: string;
    idToken: string;
    organizationId: string;
    clientId: string;
    fetcher: typeof fetch;
  },
): Promise<Record<string, unknown> | undefined> {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(input.clientId)) return undefined;
  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(input.projectId)}/databases/(default)/documents/clients/${encodeURIComponent(input.clientId)}`,
  );
  for (const fieldPath of ["organizationId", "type", "status"]) {
    url.searchParams.append("mask.fieldPaths", fieldPath);
  }
  const response = await input.fetcher(url.toString(), {
    headers: { Authorization: `Bearer ${input.idToken}` },
  });

  if (response.status === 404 || response.status === 403) return undefined;
  if (!response.ok) throw new Error("FIRESTORE_CLIENT_LOOKUP_FAILED");

  const raw: unknown = await response.json();
  if (!isRecord(raw)) return undefined;
  const data = recordToMap(raw as FirestoreDocument);
  if (data.organizationId !== input.organizationId) return undefined;

  const client: Record<string, unknown> = {};
  const type = safeScalar(data.type);
  const status = safeScalar(data.status);
  if (type !== undefined) client.type = type;
  if (status !== undefined) client.status = status;
  return Object.keys(client).length ? client : undefined;
}

/**
 * Loads bounded, field-projected context from Firestore using the caller's
 * Firebase ID token. The browser payload is treated only as a page hint and,
 * for Client 360, a document ID selector; no business values are copied.
 */
export async function buildAuthorizedCopilotContext(input: {
  projectId: string;
  organizationId: string | null;
  idToken: string;
  isPlatformAdmin: boolean;
  requestedContext: unknown;
  fetcher?: typeof fetch;
}): Promise<Record<string, unknown> | undefined> {
  const fetcher = input.fetcher ?? fetch;
  const raw = isRecord(input.requestedContext) ? input.requestedContext : {};
  const candidatePage = typeof raw.page === "string" ? raw.page : "general";
  const page = Object.hasOwn(PAGE_COLLECTIONS, candidatePage) ? candidatePage : "general";
  const output: Record<string, unknown> = { page };

  // Platform admins have their own private Copilot scope and are never given
  // tenant context, even if they submit an organization page hint.
  if (input.isPlatformAdmin || !input.organizationId) return output;

  let clientId: string | undefined;
  let client: Record<string, unknown> | undefined;
  if (page === "client-details") {
    const rawClientId = isRecord(raw.client) ? raw.client.id : undefined;
    if (typeof rawClientId === "string") {
      clientId = rawClientId;
      try {
        client = await getClientSelector({
          projectId: input.projectId,
          organizationId: input.organizationId,
          idToken: input.idToken,
          clientId,
          fetcher,
        });
      } catch {
        client = undefined;
      }
    }
    if (!client) return output;
    output.client = client;
  }

  const collectionIds = page === "client-details"
    ? (["policies", "claims", "tasks"] as CollectionKey[])
    : PAGE_COLLECTIONS[page] ?? [];

  const financeRows: { revenue?: Record<string, unknown>[]; expenses?: Record<string, unknown>[]; commissions?: Record<string, unknown>[] } = {};

  const results = await Promise.all(collectionIds.map(async (collectionId) => {
    try {
      const records = await queryCollection({
        projectId: input.projectId,
        organizationId: input.organizationId!,
        idToken: input.idToken,
        collectionId,
        clientId: page === "client-details" ? clientId : undefined,
        page,
        fetcher,
      });
      return { collectionId, records: records as Record<string, unknown>[] | null };
    } catch {
      return { collectionId, records: null as Record<string, unknown>[] | null };
    }
  }));

  for (const { collectionId, records } of results) {
    // Permission/network failures are not equivalent to an empty collection.
    if (records === null) continue;
    if (collectionId === "clients") {
      output.stats = {
        sampledClients: records.length,
      };
      continue;
    }

    if (collectionId === "revenue") {
      financeRows.revenue = records;
      continue;
    }

    if (collectionId === "expenses") {
      financeRows.expenses = records;
      continue;
    }

    if (collectionId === "commissions") {
      financeRows.commissions = records;
      continue;
    }

    if (collectionId === "policies") {
      const mapped = records.map((record) => ({
        insurerName: safeScalar(record.insurerName),
        line: safeScalar(record.line),
        expiryDate: safeScalar(record.expiryDate),
        premium: safeScalar(record.premium),
        currency: safeScalar(record.currency),
        status: safeScalar(record.status),
      })).filter((record) => Object.values(record).some((value) => value !== undefined));

      if (page === "renewals") {
        const todayParts = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Africa/Cairo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).formatToParts(new Date());
        const part = (type: string) => todayParts.find((item) => item.type === type)?.value ?? "";
        const today = `${part("year")}-${part("month")}-${part("day")}`;
        const dayNumber = (date: string) => {
          const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
          if (!match) return undefined;
          return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000;
        };
        const todayNumber = dayNumber(today);
        output.renewals = mapped.map((record) => {
          const expiryDate = typeof record.expiryDate === "string" ? record.expiryDate : "";
          const expiryNumber = dayNumber(expiryDate);
          return {
            ...record,
            daysLeft: todayNumber !== undefined && expiryNumber !== undefined
              ? expiryNumber - todayNumber
              : undefined,
          };
        }).filter((record) => Object.values(record).some((value) => value !== undefined));
      } else {
        output.policies = mapped;
      }
      continue;
    }

    if (collectionId === "claims") {
      output.claims = records.map((record) => ({
        insurerName: safeScalar(record.insurerName),
        currency: safeScalar(record.currency),
        status: safeScalar(record.status),
        incidentDate: safeScalar(record.incidentDate),
        claimAmount: safeScalar(record.claimAmount),
      })).filter((record) => Object.values(record).some((value) => value !== undefined));
      continue;
    }

    if (collectionId === "leads") {
      output.leads = records.map((record) => ({
        stage: safeScalar(record.stage),
        insuranceType: safeScalar(record.insuranceType),
        estimatedValue: safeScalar(record.estimatedValue),
      })).filter((record) => Object.values(record).some((value) => value !== undefined));
      continue;
    }

    if (collectionId === "tasks") {
      output.tasks = records.map((record) => ({
        status: safeScalar(record.status),
        priority: safeScalar(record.priority),
        dueDate: safeScalar(record.dueDate),
      })).filter((record) => Object.values(record).some((value) => value !== undefined));
      continue;
    }

    if (collectionId === "insurers") {
      output.insurers = records.map((record) => ({
        name: safeScalar(record.name),
        status: safeScalar(record.status),
      })).filter((record) => Object.values(record).some((value) => value !== undefined));
    }
  }

  if (page === "finance" && financeRows.revenue && financeRows.expenses && financeRows.commissions) {
    const allFinanceRecords = [...financeRows.revenue, ...financeRows.expenses, ...financeRows.commissions];
    const currencies = new Set<string>();
    let hasMissingCurrency = false;
    for (const record of allFinanceRecords) {
      if (typeof record.currency === "string" && record.currency.trim()) {
        currencies.add(record.currency.trim());
      } else {
        hasMissingCurrency = true;
      }
    }

    // Do not combine values with different or missing currencies into one misleading total.
    if (currencies.size <= 1 && !hasMissingCurrency) {
      const amount = (record: Record<string, unknown>, key: string): number =>
        typeof record[key] === "number" && Number.isFinite(record[key])
          ? record[key] as number
          : 0;

      const totalRevenue = financeRows.revenue
        .filter((record) => record.status === "confirmed")
        .reduce((sum, record) => sum + amount(record, "amount"), 0);
      const totalExpenses = financeRows.expenses
        .reduce((sum, record) => sum + amount(record, "amount"), 0);
      const pendingCommissions = financeRows.commissions
        .filter((record) => record.status === "pending")
        .reduce((sum, record) => sum + amount(record, "commissionAmount"), 0);
      const receivedCommissions = financeRows.commissions
        .filter((record) => record.status === "received")
        .reduce((sum, record) => sum + amount(record, "commissionAmount"), 0);

      output.finance = {
        totalRevenue,
        totalExpenses,
        netIncome: totalRevenue - totalExpenses,
        pendingCommissions,
        receivedCommissions,
        currency: currencies.values().next().value ?? "EGP",
      };
    }
  }

  return output;
}
