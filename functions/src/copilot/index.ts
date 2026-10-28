import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { COPILOT_SYSTEM_PROMPT } from './prompts';
import {
  buildAuthorizedContext,
  buildContextString,
  normalizeCopilotContextSelector,
  type CopilotRole,
} from './context-builder';
import { callClaude, validateMessages } from './claude.client';

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const CLAUDE_COPILOT_MODEL = defineString('CLAUDE_COPILOT_MODEL', {
  default: 'claude-haiku-4-5',
});

const ALLOWED_ORGANIZATION_ROLES = new Set<CopilotRole>([
  'owner', 'admin', 'broker', 'sales', 'claims', 'finance', 'staff',
]);

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

    const requestedOrganizationId = req.data?.organizationId;
    if (
      requestedOrganizationId !== undefined &&
      (typeof requestedOrganizationId !== 'string' || requestedOrganizationId.length > 160)
    ) {
      throw new HttpsError('invalid-argument', 'Invalid organization scope.');
    }

    const db = getFirestore();
    let context;
    try {
      const uid = req.auth.uid;
      // Platform Admin membership is provisioned out-of-band. Check it first
      // so an admin with a stale tenant profile cannot use the tenant context.
      const adminMembership = await db.collection('admin').doc(uid).get();
      if (adminMembership.exists) {
        if (requestedOrganizationId && requestedOrganizationId !== uid) {
          throw new HttpsError('permission-denied', 'Workspace access denied.');
        }
        context = { page: normalizeCopilotContextSelector(req.data?.context).page };
      } else {
        const profileSnapshot = await db.collection('users').doc(uid).get();
        if (!profileSnapshot.exists) {
          throw new HttpsError('permission-denied', 'Workspace access denied.');
        }

        const profile = profileSnapshot.data() ?? {};
        const organizationId = typeof profile.organizationId === 'string'
          ? profile.organizationId
          : '';
        const role = profile.role;
        if (
          profile.status !== 'active' ||
          !organizationId ||
          typeof role !== 'string' ||
          !ALLOWED_ORGANIZATION_ROLES.has(role as CopilotRole)
        ) {
          throw new HttpsError('permission-denied', 'Workspace access denied.');
        }
        if (requestedOrganizationId && requestedOrganizationId !== organizationId) {
          throw new HttpsError('permission-denied', 'Workspace access denied.');
        }

        context = await buildAuthorizedContext({
          db,
          organizationId,
          role: role as CopilotRole,
          requestedContext: req.data?.context,
        });
      }
    } catch (e) {
      if (e instanceof HttpsError) throw e;
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
