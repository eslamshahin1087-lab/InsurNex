export interface CopilotContextSelector {
  page: string;
  client?: { id: string };
  lead?: { id: string };
  policyRef?: { id: string };
  claimRef?: { id: string };
}

const ALLOWED_PAGES = new Set([
  "dashboard",
  "clients",
  "client-details",
  "lead-details",
  "policy-details",
  "claim-details",
  "policies",
  "claims",
  "leads",
  "tasks",
  "insurers",
  "finance",
  "renewals",
  "general",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Minimize context before it leaves the browser. Only the requested page and
 * a validated Client 360 document ID are sent; all displayed/business values
 * are fetched independently by the Edge Function.
 */
export function buildCopilotContextSelector(value: unknown): CopilotContextSelector | undefined {
  if (!isRecord(value)) return undefined;

  const requestedPage = typeof value.page === "string" ? value.page : "general";
  const page = ALLOWED_PAGES.has(requestedPage) ? requestedPage : "general";

  if (page === "client-details") {
    const clientId = isRecord(value.client) ? value.client.id : undefined;
    if (typeof clientId === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(clientId)) {
      return { page, client: { id: clientId } };
    }
    return { page };
  }

  if (page === "lead-details") {
    const leadId = isRecord(value.lead) ? value.lead.id : undefined;
    if (typeof leadId === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(leadId)) {
      return { page, lead: { id: leadId } };
    }
    return { page };
  }

  if (page === "policy-details") {
    const policyId = isRecord(value.policyRef) ? value.policyRef.id : undefined;
    if (typeof policyId === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(policyId)) {
      return { page, policyRef: { id: policyId } };
    }
    return { page };
  }

  if (page === "claim-details") {
    const claimId = isRecord(value.claimRef) ? value.claimRef.id : undefined;
    if (typeof claimId === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(claimId)) {
      return { page, claimRef: { id: claimId } };
    }
    return { page };
  }

  return { page };
}
