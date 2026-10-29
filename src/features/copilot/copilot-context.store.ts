import type { CopilotContextPayload } from './copilot.types';
import { buildCopilotContextSelector, type CopilotContextSelector } from './copilot-context-selector';

export const COPILOT_CONTEXT_CHANGE_EVENT = 'insurnex:copilot-context-change';

const STORAGE_KEY = 'insurnex-copilot-context-v2';

function notifyContextChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(COPILOT_CONTEXT_CHANGE_EVENT));
}
const LEGACY_STORAGE_KEY = 'insurnex-copilot-context-v1';

function clearStoredContext(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    /* ignore storage errors */
  }
}

/**
 * Persist only a page selector, never the page's business data.
 * This intentionally also removes data stored under the older v1 key.
 */
export function setCurrentContext(context: CopilotContextPayload): void {
  try {
    const storage = window.sessionStorage;
    const selector = buildCopilotContextSelector(context);
    storage.removeItem(LEGACY_STORAGE_KEY);

    if (!selector) {
      storage.removeItem(STORAGE_KEY);
      notifyContextChanged();
      return;
    }

    storage.setItem(STORAGE_KEY, JSON.stringify(selector));
    notifyContextChanged();
  } catch {
    clearStoredContext();
    notifyContextChanged();
  }
}

/**
 * Migrate any existing v1 payload by reducing it to the approved selector,
 * then delete the previous entry so private client/business data is not kept.
 */
export function getCurrentContext(): CopilotContextSelector | undefined {
  try {
    const storage = window.sessionStorage;
    const raw = storage.getItem(STORAGE_KEY) ?? storage.getItem(LEGACY_STORAGE_KEY);
    storage.removeItem(LEGACY_STORAGE_KEY);

    if (!raw) {
      storage.removeItem(STORAGE_KEY);
      return undefined;
    }

    const selector = buildCopilotContextSelector(JSON.parse(raw) as unknown);
    if (!selector) {
      storage.removeItem(STORAGE_KEY);
      return undefined;
    }

    storage.setItem(STORAGE_KEY, JSON.stringify(selector));
    return selector;
  } catch {
    clearStoredContext();
    return undefined;
  }
}

export function clearCurrentContext(): void {
  clearStoredContext();
  notifyContextChanged();
}
