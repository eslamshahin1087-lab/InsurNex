import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const page = read('src/pages/CopilotPage.tsx');
const scope = read('src/features/copilot/copilot-page-session.ts');
const scopeTests = read('src/features/copilot/copilot-page-session.test.ts');

assert.match(page, /getCopilotPageSessionKey\(user\?\.uid, scope, incomingContext\)/, 'full Copilot page must bind state to user, workspace, and context');
assert.match(page, /sessionScopeRef\.current = sessionScopeKey/, 'workspace or context changes must replace the active session key');
assert.match(page, /setConversations\(\[\]\)/, 'session changes must clear the prior account conversation list');
assert.match(page, /setMessages\(\[\]\)/, 'session changes must clear prior conversation messages');
assert.match(page, /requestSequence !== responseSequenceRef\.current/, 'stale assistant responses must be ignored');
assert.match(page, /requestSequence === responseSequenceRef\.current/, 'response completion must be guarded by the current request sequence');
assert.match(page, /requestSequence !== conversationListSequenceRef\.current/, 'late conversation-list reads must not overwrite the current account');
assert.match(page, /activeConversationIdRef\.current === conversationId/, 'message loads must be bound to the selected conversation');
assert.match(page, /if \(sending\) \{\s*setLoadingMsgs\(false\);\s*return;/, 'message reloads must not race an in-flight assistant response');
assert.match(page, /function handleSelectConversation\(id: string\)/, 'switching conversations must use the guarded selection handler');
assert.match(page, /onSelect=\{handleSelectConversation\}/, 'conversation sidebar must use the guarded selection handler');
assert.match(page, /if \(!isCurrentSession\(requestScope\)\) return;/, 'async completion handlers must verify the active session');
assert.equal(page.includes('console.error('), false, 'full Copilot page must not write raw exceptions to browser console');
assert.match(scope, /buildCopilotContextSelector\(context\)/, 'session key must use the minimized selector, not business payloads');
assert.match(scope, /return \$\{userId\}\|\$\{workspaceId\}\|\$\{contextKey\}/, 'session key must include identity, workspace, and context');
assert.match(scopeTests, /different records on one route/, 'session-scope tests must separate record pages');
assert.match(scopeTests, /never private page fields/, 'session-scope tests must avoid sensitive business data in keys');

console.log('Copilot full-page session isolation regression checks passed.');
