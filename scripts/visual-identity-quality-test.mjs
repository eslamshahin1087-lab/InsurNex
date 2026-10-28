import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const layout = read('src/layouts/AppLayout.tsx');
const clients = read('src/pages/ClientsPage.tsx');
const styles = read('src/theme/visual-identity-quality.css');
const main = read('src/main.tsx');

assert.match(layout, /window\.innerWidth >= 1024/, 'desktop layout must be selected using the real wide viewport');
assert.match(layout, /window\.addEventListener\('resize', syncViewportMode/, 'layout must respond when the browser viewport changes');
assert.match(layout, /window\.removeEventListener\('resize', syncViewportMode/, 'viewport listeners must be cleaned up');
assert.match(layout, /viewModeOverride \?\? \(isWideViewport \? 'desktop' : 'mobile'\)/, 'manual phone preview must override responsive mode without forcing it by default');
assert.match(layout, /INTERNAL_DISPLAY_NAMES/, 'internal route/role slugs must not be used as a personal greeting');
assert.match(layout, /return 'بك'/, 'invalid display names must fall back to a natural Arabic greeting');
for (const role of ['وسيط تأمين', 'فريق المبيعات', 'فريق المطالبات', 'الإدارة المالية']) {
  assert.ok(layout.includes(role), 'role label must be localized: ' + role);
}

const start = clients.indexOf('{/* KPI GRID */}');
const end = clients.indexOf('{/* CHARTS */}', start);
assert.ok(start >= 0 && end > start, 'client KPI block must remain available');
const kpiBlock = clients.slice(start, end);
for (const emoji of ['👥', '✅', '🎯', '🏢']) {
  assert.equal(kpiBlock.includes(emoji), false, 'KPI icon must use the product icon system instead of emoji: ' + emoji);
}
for (const icon of ['<Users size={17}', '<CheckCircle2 size={17}', '<Target size={17}', '<Building2 size={17}']) {
  assert.ok(kpiBlock.includes(icon), 'expected Lucide KPI icon is missing: ' + icon);
}

assert.match(styles, /@media \(min-width: 1024px\)/, 'wide workspace styles must be breakpoint-gated');
assert.match(styles, /grid-template-columns: 240px minmax\(0, 1fr\)/, 'desktop should have a real navigation rail and flexible workspace');
assert.match(styles, /width: 124px !important/, 'desktop brand lockup must be legible');
assert.match(styles, /box-shadow: none !important/, 'logo itself must not receive a decorative frame shadow');
assert.ok(main.indexOf('visual-identity-quality.css') > main.indexOf('insurnex-design-system.css'), 'identity refinements must load after shared design-system overrides');

console.log('Visual identity and responsive layout regression checks passed.');
