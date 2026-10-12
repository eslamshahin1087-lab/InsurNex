import type { CopilotContextPayload } from './copilot.types';

const STORAGE_KEY = 'insurnex-copilot-context-v1';

/**
 * Store the current page context so the global FAB can pick it up.
 * Each page calls setCurrentContext() on mount with its data.
 */
export function setCurrentContext(context: CopilotContextPayload): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(context));
  } catch {
    /* ignore storage errors */
  }
}

export function getCurrentContext(): CopilotContextPayload | undefined {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as CopilotContextPayload;
  } catch {
    return undefined;
  }
}

export function clearCurrentContext(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}