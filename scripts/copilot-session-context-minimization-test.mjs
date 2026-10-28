import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const store = read('src/features/copilot/copilot-context.store.ts');
const selector = read('src/features/copilot/copilot-context-selector.ts');
const panel = read('src/features/copilot/CopilotFloatingPanel.tsx');
const service = read('src/features/copilot/copilot.service.ts');

assert.equal(store.includes("insurnex-copilot-context-v2"), true, 'minimized context must use a new storage key');
assert.equal(store.includes("insurnex-copilot-context-v1"), true, 'legacy storage key must be known for migration cleanup');
assert.equal(store.includes('buildCopilotContextSelector(context)'), true, 'setCurrentContext must minimize before storage');
assert.equal(store.includes('buildCopilotContextSelector(JSON.parse(raw) as unknown)'), true, 'legacy stored data must be minimized on read');
assert.equal(store.includes('storage.removeItem(LEGACY_STORAGE_KEY)'), true, 'legacy raw context must be deleted during migration');
assert.equal(store.includes('getCurrentContext(): CopilotContextSelector | undefined'), true, 'store must expose the minimized context shape');
assert.equal(store.includes('JSON.stringify(context)'), false, 'full page payload must never be written directly to session storage');
assert.equal(selector.includes('return { page, client: { id: clientId } }'), true, 'Client 360 selector may retain only the document ID');
assert.equal(selector.includes('return { page }'), true, 'non-detail context must retain only its page selector');
assert.equal(panel.includes('useMemo<CopilotContextSelector | undefined>'), true, 'floating panel must consume the minimized context type');
assert.equal(service.includes('context: buildCopilotContextSelector(params.context)'), true, 'gateway calls must re-minimize context before network transfer');

console.log('Copilot session context minimization checks passed.');
