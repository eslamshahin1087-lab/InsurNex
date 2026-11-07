import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (file) => readFileSync(resolve(root, file), 'utf8');
const edge = read('supabase/functions/copilot-chat/index.ts');
const token = read('supabase/functions/copilot-chat/firebase-token-verification.ts');
const routing = read('supabase/functions/copilot-chat/provider-routing.ts');
const client = read('src/features/copilot/copilot.service.ts');
const floatingPanel = read('src/features/copilot/CopilotFloatingPanel.tsx');
const fullPage = read('src/pages/CopilotPage.tsx');

assert.match(edge, /verifyFirebaseIdToken\(\{ apiKey: FIREBASE_API_KEY, idToken \}\)/,
  'Copilot must use the dedicated Firebase ID token verifier');
assert.match(token, /user\.disabled === true/,
  'disabled Firebase accounts must fail closed');
assert.match(token, /AbortSignal\.timeout\(timeoutMs\)/,
  'Firebase token verification must have a bounded timeout');
assert.match(edge, /const PROVIDER_TIMEOUT_MS = 15_000/,
  'AI provider timeout must remain bounded');
assert.equal((edge.match(/signal: AbortSignal\.timeout\(PROVIDER_TIMEOUT_MS\)/g) || []).length, 2,
  'both configured AI providers must use the bounded timeout');

assert.match(edge, /resolveCopilotPrivacyPolicy/,
  'Copilot must resolve its free-tier privacy policy before forwarding business context');
assert.match(edge, /COPILOT_PRIVACY_POLICY\.allowBusinessContext\s*\? await buildAuthorizedCopilotContext/,
  'Firestore business context must be disabled unless both privacy gates are approved');
assert.doesNotMatch(edge, /FIREBASE_PROJECT_ID[^\n]*insurnex-8a9df/,
  'Copilot must not silently fall back to the production Firebase project');
assert.match(edge, /FIREBASE_PROJECT_ID_NOT_CONFIGURED/,
  'missing Firebase project configuration must fail closed');
assert.match(edge, /providerOrder\.includes\('groq'\)/,
  'Groq calls must follow the privacy policy provider order');
assert.match(edge, /providerOrder\.includes\('gemini'\)/,
  'Gemini calls must follow the privacy policy provider order');
assert.match(edge, /buildCopilotProviderUnavailableReply\(messages\)/,
  'all provider failures must return the local language-aware fallback');
assert.match(routing, /provider: "local-fallback"/,
  'local fallback must be clearly distinguishable from a generated answer');
assert.match(routing, /No analysis was generated/,
  'fallback must explicitly state that no AI analysis was generated');
assert.match(routing, /لم يتم إنشاء تحليل/,
  'Arabic fallback must explicitly state that no AI analysis was generated');

assert.match(client, /AUTHENTICATION_TEMPORARILY_UNAVAILABLE/,
  'client must allow-list the new safe token-verification outage code');
assert.match(floatingPanel, /تعذر الاتصال بالمساعد\. حاول مرة أخرى\./,
  'floating panel must retain generic user-facing errors');
assert.match(fullPage, /تعذر الاتصال بالمساعد الذكي الآن/,
  'full Copilot page must retain generic user-facing errors');

for (const source of [edge, token, routing]) {
  assert.equal(source.includes('console.error(err)'), false, 'raw errors must not be logged');
  assert.equal(source.includes('console.error(error)'), false, 'raw errors must not be logged');
}

console.log('Copilot runtime parity source contract checks passed.');
