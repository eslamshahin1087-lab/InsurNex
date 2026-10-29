import { buildCopilotContextSelector } from './copilot-context-selector.ts';

/**
 * Scopes the full Copilot conversation state to the authenticated user,
 * workspace, and minimized page/record selector. Business values from the
 * navigation state are deliberately ignored.
 */
export function getCopilotPageSessionKey(
  userId: string | null | undefined,
  workspaceId: string | null | undefined,
  context: unknown,
): string | null {
  if (!userId || !workspaceId) return null;

  const selector = buildCopilotContextSelector(context);
  const contextKey = JSON.stringify(selector ?? { page: 'general' });
  return `${userId}|${workspaceId}|${contextKey}`;
}
