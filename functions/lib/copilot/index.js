"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.copilotChat = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const prompts_1 = require("./prompts");
const context_builder_1 = require("./context-builder");
const claude_client_1 = require("./claude.client");
const ANTHROPIC_API_KEY = (0, params_1.defineSecret)('ANTHROPIC_API_KEY');
const CLAUDE_COPILOT_MODEL = (0, params_1.defineString)('CLAUDE_COPILOT_MODEL', {
    default: 'claude-haiku-4-5',
});
exports.copilotChat = (0, https_1.onCall)({
    region: 'europe-west1',
    secrets: [ANTHROPIC_API_KEY],
    enforceAppCheck: true,
    timeoutSeconds: 60,
    memory: '512MiB',
    maxInstances: 5,
}, async (req) => {
    if (!req.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required.');
    }
    let messages;
    try {
        messages = (0, claude_client_1.validateMessages)(req.data?.messages);
    }
    catch (e) {
        const reason = e instanceof Error ? e.message : 'INVALID_MESSAGES';
        throw new https_1.HttpsError('invalid-argument', `Invalid messages: ${reason}`);
    }
    const context = req.data?.context;
    const contextString = (0, context_builder_1.buildContextString)(context);
    try {
        const result = await (0, claude_client_1.callClaude)({
            apiKey: ANTHROPIC_API_KEY.value(),
            model: CLAUDE_COPILOT_MODEL.value(),
            systemPrompt: prompts_1.COPILOT_SYSTEM_PROMPT + contextString,
            messages,
        });
        return {
            reply: result.reply,
            usage: result.usage,
            model: result.model,
        };
    }
    catch (e) {
        console.error('copilotChat failed', e);
        throw new https_1.HttpsError('unavailable', 'AI Copilot is temporarily unavailable. Please try again.');
    }
});
