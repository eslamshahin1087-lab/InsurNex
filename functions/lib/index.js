"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.medicalClaudeAnalysis = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const app_1 = require("firebase-admin/app");
(0, app_1.initializeApp)();
const ANTHROPIC_API_KEY = (0, params_1.defineSecret)('ANTHROPIC_API_KEY');
const CLAUDE_MODEL = (0, params_1.defineString)('CLAUDE_MEDICAL_MODEL', { default: 'claude-haiku-4-5' });
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
function valid(x) { return x && ['ar', 'en'].includes(x.language) && finite(x.records) && finite(x.gross) && Array.isArray(x.costDrivers) && x.costDrivers.length <= 12 && x.providersRanked.length <= 12 && x.membersRanked.length <= 12 && x.activities.length <= 15 && x.trend.length <= 36; }
const schema = { type: 'object', properties: { executiveSummary: { type: 'string' }, keyFindings: { type: 'array', items: { type: 'string' } }, costDrivers: { type: 'array', items: { type: 'string' } }, memberInsights: { type: 'array', items: { type: 'string' } }, providerInsights: { type: 'array', items: { type: 'string' } }, trendInsights: { type: 'array', items: { type: 'string' } }, riskSignals: { type: 'array', items: { type: 'string' } }, caseManagementOpportunities: { type: 'array', items: { type: 'string' } }, renewalConsiderations: { type: 'array', items: { type: 'string' } }, recommendedActions: { type: 'array', items: { type: 'string' } }, dataLimitations: { type: 'array', items: { type: 'string' } } }, required: ['executiveSummary', 'keyFindings', 'costDrivers', 'memberInsights', 'providerInsights', 'trendInsights', 'riskSignals', 'caseManagementOpportunities', 'renewalConsiderations', 'recommendedActions', 'dataLimitations'], additionalProperties: false };
exports.medicalClaudeAnalysis = (0, https_1.onCall)({ region: 'europe-west1', secrets: [ANTHROPIC_API_KEY], enforceAppCheck: true, timeoutSeconds: 60, memory: '512MiB', maxInstances: 5 }, async (req) => { if (!req.auth)
    throw new https_1.HttpsError('unauthenticated', 'Authentication required.'); const ctx = req.data?.context; if (!valid(ctx))
    throw new https_1.HttpsError('invalid-argument', 'Invalid or oversized medical analytics context.'); const client = new sdk_1.default({ apiKey: ANTHROPIC_API_KEY.value(), timeout: 45000, maxRetries: 2 }); const language = ctx.language === 'ar' ? 'Arabic' : 'English'; const payload = JSON.stringify(ctx); try {
    const message = await client.messages.create({ model: CLAUDE_MODEL.value(), max_tokens: 2200, temperature: 0.2, system: `You are InsurNex Medical Insurance Intelligence. Analyze insurance utilization and portfolio cost only. Never diagnose, recommend treatment, or infer missing facts. Treat all numeric metrics in the supplied JSON as authoritative deterministic calculations. Clearly distinguish evidence from interpretation. Respond in ${language}. Return only JSON matching this schema: ${JSON.stringify(schema)}`, messages: [{ role: 'user', content: `Analyze this aggregated medical insurance context. Do not recalculate or invent values. Context: ${payload}` }] });
    const text = message.content.filter(x => x.type === 'text').map(x => x.text).join('').trim().replace(/^```json\s*/, '').replace(/```$/, '').trim();
    let analysis;
    try {
        analysis = JSON.parse(text);
    }
    catch {
        throw new https_1.HttpsError('internal', 'Claude returned invalid structured output.');
    }
    return { analysis, usage: message.usage, model: message.model };
}
catch (e) {
    if (e instanceof https_1.HttpsError)
        throw e;
    console.error('medicalClaudeAnalysis failed', e);
    throw new https_1.HttpsError('unavailable', 'AI analysis is temporarily unavailable. Deterministic analytics remain available.');
} });
