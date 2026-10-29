import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const service = readFileSync(resolve(root, 'src/features/copilot/copilot.service.ts'), 'utf8');
const edge = readFileSync(resolve(root, 'supabase/functions/copilot-chat/index.ts'), 'utf8');
const panel = readFileSync(resolve(root, 'src/features/copilot/CopilotFloatingPanel.tsx'), 'utf8');

assert.match(service, /const SAFE_COPILOT_ERROR_CODES = new Set\(/, 'client must use an explicit safe error allow-list');
assert.match(service, /COPILOT_TEMPORARILY_UNAVAILABLE/, 'unknown failures must become a generic public error');
assert.match(service, /safeCopilotErrorCode\(\(body as \{ error\?: unknown \}\)\.error\)/, 'only a recognized error code may be copied from the function response');
assert.match(service, /const publicCode = await readSafeCopilotErrorCode\(error\)/, 'SDK errors must be normalized before they reach UI code');
assert.equal(service.includes('ctx.clone().text()'), false, 'raw error response text must never be read for user-facing errors');
assert.equal(service.includes('realMessage'), false, 'untrusted message text must not be forwarded');
assert.equal(service.includes('error.message'), false, 'SDK/provider message text must not be forwarded');
assert.equal(service.includes('String(body.message)'), false, 'backend message bodies must not be shown verbatim');

assert.match(edge, /const publicError = authenticationError \|\| scopeErrors\.has\(message\) \|\| clientErrors\.has\(message\)/, 'Edge Function must return only recognized public errors');
assert.match(edge, /console\.error\('copilot-chat request failed', \{ status, code: publicError \}\)/, 'request logs must include only status and safe error code');
assert.equal(edge.includes('console.error(err)'), false, 'raw request exception objects must not be logged');
assert.equal(panel.includes('console.'), false, 'floating Copilot must not write raw client exceptions or context to the browser console');
assert.equal(panel.includes('catch (e)'), false, 'floating Copilot should not bind raw exception objects when it does not inspect them');
assert.match(panel, /setError\('تعذر تحميل الرسائل\.'\)/, 'message-load failures need a generic Arabic user-facing error');
assert.match(panel, /setError\('تعذر حذف المحادثة الحالية\.'\)/, 'delete failures need a generic Arabic user-facing error');

console.log('Copilot gateway safe-error regression checks passed.');
