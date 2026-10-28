export type SafeContextValue = string | number | boolean;
export type SafeContextRecord = Record<string, SafeContextValue>;

export interface SanitizedCopilotContext {
  page?: string;
  client?: SafeContextRecord;
  policy?: SafeContextRecord;
  policies?: SafeContextRecord[];
  claims?: SafeContextRecord[];
  renewals?: SafeContextRecord[];
  leads?: SafeContextRecord[];
  insurers?: SafeContextRecord[];
  tasks?: SafeContextRecord[];
  finance?: SafeContextRecord;
  stats?: SafeContextRecord;
}

type FieldRules = {
  strings: readonly string[];
  numbers?: readonly string[];
};

const FIELD_RULES: Record<string, FieldRules> = {
  client: { strings: ["type", "status"] },
  policy: {
    strings: ["insurerName", "line", "startDate", "expiryDate", "currency", "status"],
    numbers: ["premium"],
  },
  policies: {
    strings: ["insurerName", "line", "expiryDate", "currency", "status"],
    numbers: ["premium"],
  },
  claims: {
    strings: ["insurerName", "currency", "status", "incidentDate"],
    numbers: ["claimAmount"],
  },
  renewals: {
    strings: ["insurerName", "line", "expiryDate", "currency"],
    numbers: ["premium", "daysLeft"],
  },
  leads: {
    strings: ["stage", "insuranceType"],
    numbers: ["estimatedValue"],
  },
  insurers: {
    strings: ["name", "category", "status"],
  },
  tasks: {
    strings: ["status", "priority", "dueDate"],
  },
  finance: {
    strings: ["currency"],
    numbers: ["totalRevenue", "totalExpenses", "netIncome", "pendingCommissions", "receivedCommissions"],
  },
  stats: {
    strings: [],
    numbers: ["sampledClients"],
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown, maxLength = 120): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return cleaned || undefined;
}

function cleanPage(value: unknown): string | undefined {
  const cleaned = cleanString(value, 80)?.replace(/[^\p{L}\p{N}\s/_:.-]/gu, "").trim();
  return cleaned || undefined;
}

function cleanNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 1_000_000_000_000_000) {
    return undefined;
  }
  return value;
}

function sanitizeRecord(value: unknown, rules: FieldRules): SafeContextRecord | undefined {
  if (!isRecord(value)) return undefined;
  const output: SafeContextRecord = {};

  for (const field of rules.strings) {
    const cleaned = cleanString(value[field]);
    if (cleaned !== undefined) output[field] = cleaned;
  }

  for (const field of rules.numbers ?? []) {
    const cleaned = cleanNumber(value[field]);
    if (cleaned !== undefined) output[field] = cleaned;
  }

  return Object.keys(output).length ? output : undefined;
}

function sanitizeList(value: unknown, rules: FieldRules, maxItems: number): SafeContextRecord[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const rows = value
    .slice(0, maxItems)
    .map((item) => sanitizeRecord(item, rules))
    .filter((item): item is SafeContextRecord => item !== undefined);
  return rows.length ? rows : undefined;
}

/**
 * Allow-list only the minimum context fields needed for business summaries.
 * Client IDs/names/contact details, free-form notes, policy/claim identifiers,
 * lead/customer names, task titles, and all medical/document payloads are excluded.
 */
export function sanitizeCopilotContext(value: unknown): SanitizedCopilotContext | undefined {
  if (!isRecord(value)) return undefined;
  const output: SanitizedCopilotContext = {};

  const page = cleanPage(value.page);
  if (page) output.page = page;

  const client = sanitizeRecord(value.client, FIELD_RULES.client);
  if (client) output.client = client;

  const policy = sanitizeRecord(value.policy, FIELD_RULES.policy);
  if (policy) output.policy = policy;

  const policies = sanitizeList(value.policies, FIELD_RULES.policies, 20);
  if (policies) output.policies = policies;

  const claims = sanitizeList(value.claims, FIELD_RULES.claims, 15);
  if (claims) output.claims = claims;

  const renewals = sanitizeList(value.renewals, FIELD_RULES.renewals, 15);
  if (renewals) output.renewals = renewals;

  const leads = sanitizeList(value.leads, FIELD_RULES.leads, 15);
  if (leads) output.leads = leads;

  const insurers = sanitizeList(value.insurers, FIELD_RULES.insurers, 20);
  if (insurers) output.insurers = insurers;

  const tasks = sanitizeList(value.tasks, FIELD_RULES.tasks, 15);
  if (tasks) output.tasks = tasks;

  const finance = sanitizeRecord(value.finance, FIELD_RULES.finance);
  if (finance) output.finance = finance;

  const stats = sanitizeRecord(value.stats, FIELD_RULES.stats);
  if (stats) output.stats = stats;

  return Object.keys(output).length ? output : undefined;
}
