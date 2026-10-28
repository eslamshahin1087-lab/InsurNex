import { getFirestore } from 'firebase-admin/firestore';
import { CopilotAuthorizationError, resolveCopilotAccess } from './access-policy';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { COPILOT_SYSTEM_PROMPT } from './prompts';
import {
  buildAuthorizedContext,
  buildContextString,
  normalizeCopilotContextSelector,
  type CopilotContext,
} from './context-builder';
import { callClaude, validateMessages } from './claude.client';

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const CLAUDE_COPILOT_MODEL = defineString('CLAUDE_COPILOT_MODEL', {
  default: 'claude-haiku-4-5',
});

export const copilotChat = onCall(
  {
    region: 'europe-west1',
    secrets: [ANTHROPIC_API_KEY],
    enforceAppCheck: true,
    timeoutSeconds: 60,
    memory: '512MiB',
    maxInstances: 5,
  },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    let messages;
    try {
      messages = validateMessages(req.data?.messages);
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'INVALID_MESSAGES';
      throw new HttpsError('invalid-argument', 'Invalid Copilot messages: ' + reason);
    }

    const db = getFirestore();
    let context: CopilotContext;
    try {
      const access = await resolveCopilotAccess({
        db,
        uid: req.auth.uid,
        requestedOrganizationId: req.data?.organizationId,
      });

      if (access.scopeType === 'platform-admin') {
        context = { page: normalizeCopilotContextSelector(req.data?.context).page };
      } else {
        context = await buildAuthorizedContext({
          db,
          organizationId: access.organizationId,
          role: access.role,
          requestedContext: req.data?.context,
        });
      }
    } catch (e) {
      if (e instanceof CopilotAuthorizationError) {
        throw new HttpsError(e.code, e.message);
      }
      console.error('copilotChat context authorization failed.');
      throw new HttpsError('unavailable', 'Authorized Copilot context is temporarily unavailable.');
    }

    const contextString = buildContextString(context);

    try {
      const result = await callClaude({
        apiKey: ANTHROPIC_API_KEY.value(),
        model: CLAUDE_COPILOT_MODEL.value(),
        systemPrompt: COPILOT_SYSTEM_PROMPT + contextString,
        messages,
      });

      return {
        reply: result.reply,
        usage: result.usage,
        model: result.model,
      };
    } catch (e) {
      console.error('copilotChat provider request failed.');
      throw new HttpsError(
        'unavailable',
        'AI Copilot is temporarily unavailable. Please try again.',
      );
    }
  },
);
