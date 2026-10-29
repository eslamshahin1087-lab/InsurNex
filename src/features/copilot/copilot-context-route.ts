import type { CopilotContextSelector } from "./copilot-context-selector.ts";

type DetailSelectorKey = "client" | "lead" | "policyRef" | "claimRef";

interface RouteExpectation {
  page: string;
  detail?: { key: DetailSelectorKey; id: string };
}

function decodeRouteId(raw: string): string | undefined {
  try {
    const decoded = decodeURIComponent(raw);
    return /^[A-Za-z0-9_-]{1,160}$/.test(decoded) ? decoded : undefined;
  } catch {
    return undefined;
  }
}

function expectedContextForPath(pathname: string): RouteExpectation | "preserve" | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;

  // The dedicated Copilot page is a continuation of the page from which it was opened.
  if (path === "/copilot") return "preserve";
  if (path === "/" || path === "/dashboard") return { page: "dashboard" };

  const collectionRoutes: Array<[string, string]> = [
    ["/clients", "clients"],
    ["/policies", "policies"],
    ["/claims", "claims"],
    ["/renewals", "renewals"],
    ["/leads", "leads"],
    ["/tasks", "tasks"],
    ["/insurers", "insurers"],
    ["/finance", "finance"],
  ];
  for (const [route, page] of collectionRoutes) {
    if (path === route) return { page };
  }

  const clientMatch = /^\/clients\/([^/]+)(?:\/insurance-analysis)?$/.exec(path);
  if (clientMatch && clientMatch[1] !== "new") {
    const id = decodeRouteId(clientMatch[1]);
    return id ? { page: "client-details", detail: { key: "client", id } } : undefined;
  }

  const detailRoutes: Array<{ pattern: RegExp; page: string; key: DetailSelectorKey }> = [
    { pattern: /^\/leads\/([^/]+)$/, page: "lead-details", key: "lead" },
    { pattern: /^\/policies\/([^/]+)$/, page: "policy-details", key: "policyRef" },
    { pattern: /^\/claims\/([^/]+)$/, page: "claim-details", key: "claimRef" },
  ];
  for (const route of detailRoutes) {
    const match = route.pattern.exec(path);
    if (!match) continue;
    const id = decodeRouteId(match[1]);
    return id ? { page: route.page, detail: { key: route.key, id } } : undefined;
  }

  // Routes without a server-backed context must never inherit a previous page's selector.
  return undefined;
}

function detailIdFromContext(context: CopilotContextSelector, key: DetailSelectorKey): string | undefined {
  const value = context[key];
  if (!value || typeof value !== "object" || !("id" in value)) return undefined;
  return typeof value.id === "string" ? value.id : undefined;
}

/**
 * Binds the stored selector to the current route. It never invents context and
 * rejects a selector from another page or another detail record.
 */
/**
 * Stable scope key for the floating conversation. Record pages are isolated by
 * exact ID; the full Copilot route returns undefined to preserve its source
 * conversation when navigation comes from an open panel.
 */
export function getCopilotConversationScopeKey(pathname: string): string | undefined {
  const expected = expectedContextForPath(pathname);
  if (expected === "preserve") return undefined;

  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (!expected) return "route:" + normalizedPath;
  if (!expected.detail) return expected.page;
  return expected.page + ":" + expected.detail.id;
}

export function resolveCopilotContextForRoute(
  pathname: string,
  context: CopilotContextSelector | undefined,
): CopilotContextSelector | undefined {
  if (!context) return undefined;

  const expected = expectedContextForPath(pathname);
  if (expected === "preserve") return context;
  if (!expected || context.page !== expected.page) return undefined;
  if (!expected.detail) return context;

  return detailIdFromContext(context, expected.detail.key) === expected.detail.id
    ? context
    : undefined;
}
