import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const layout = read('src/layouts/AppLayout.tsx');
const clients = read('src/pages/ClientsPage.tsx');
const styles = read('src/theme/visual-identity-quality.css');
const mobileExperience = read('src/theme/mobile-experience.css');
const main = read('src/main.tsx');
const app = read('src/App.tsx');
const logo = read('src/components/Logo.tsx');
const manifest = JSON.parse(read('public/manifest.webmanifest'));
const { statSync } = await import('node:fs');

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
assert.ok(app.indexOf('mobile-experience.css') > app.indexOf('landing.css'), 'mobile ergonomics layer must load after legacy page themes');
assert.match(mobileExperience, /env\(safe-area-inset-top, 0px\)/,
  'mobile header must respect the top safe area on supported devices');
assert.match(mobileExperience, /min-width: 44px !important/,
  'mobile header actions must meet the 44px minimum touch width');
assert.match(mobileExperience, /min-height: 44px !important/,
  'mobile header actions and primary navigation must meet the 44px minimum touch height');
assert.match(mobileExperience, /prefers-reduced-motion:\\s*reduce/,
  'mobile navigation must respect reduced-motion preferences');


const refreshSectionStart = styles.indexOf('INSURNEX BRAND REFRESH V3');
assert.ok(refreshSectionStart >= 0, 'the premium brand refresh section must be present');
const refreshedStyles = styles.slice(refreshSectionStart);
assert.ok(refreshedStyles.length > 0, 'the premium brand refresh layer must be present');
assert.match(refreshedStyles, /--inx-brand-navy:\s*#071b37/i, 'brand navy token must remain explicit');
assert.match(refreshedStyles, /--inx-brand-gold:\s*#c99a44/i, 'restrained gold accent token must remain explicit');
assert.match(refreshedStyles, /:root\[data-theme="dark"\]/, 'the refreshed palette must define dark-mode tokens');
assert.match(refreshedStyles, /grid-template-columns:\s*264px minmax\(0, 1fr\)/, 'desktop must use a dedicated RTL navigation rail and flexible workspace');
assert.match(refreshedStyles, /display:\s*grid !important/, 'desktop view must override the legacy flex-only shell');
assert.match(refreshedStyles, /position:\s*sticky !important/, 'desktop navigation must remain in the application rail');
assert.match(refreshedStyles, /@media \(max-width: 1023px\)/, 'mobile and tablet navigation must retain a responsive bottom bar');
assert.match(refreshedStyles, /prefers-reduced-motion:\s*reduce/, 'motion preferences must be respected');

assert.match(logo, /BRAND_ARTWORK = '\/branding\/logo-light\.png'/,
  'the exact supplied transparent brand artwork must be the shared logo source');
assert.match(logo, /inx-logo-mark-artwork/,
  'compact header and sidebar marks must use the supplied shield artwork');
assert.equal(manifest.icons.length, 2, 'PWA manifest must expose both required icon sizes');
for (const [size, assetPath, pixels] of [
  ['192x192', '/pwa-icon-192.png', 192],
  ['512x512', '/pwa-icon-512.png', 512],
]) {
  const icon = manifest.icons.find((candidate) => candidate.sizes === size);
  assert.ok(icon, `PWA manifest must include ${size}`);
  assert.equal(icon.src, assetPath,
    `PWA install icon must use the dedicated branded ${size} app icon`);
  assert.equal(icon.type, 'image/png', `PWA ${size} icon must be PNG`);
  const iconFile = resolve(root, 'public', assetPath.slice(1));
  assert.ok(statSync(iconFile).size > 1_000, `PWA ${size} icon asset must exist and be non-empty`);
  const png = readFileSync(iconFile);
  assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a', `PWA ${size} icon must be a valid PNG`);
  assert.equal(png.readUInt32BE(16), pixels, `PWA icon width must be ${pixels}px`);
  assert.equal(png.readUInt32BE(20), pixels, `PWA icon height must be ${pixels}px`);
}
assert.ok(statSync(resolve(root, 'public/branding/logo-light.png')).size > 100_000,
  'the supplied transparent logo asset must remain available for in-app branding');

console.log('Visual identity, supplied logo, PWA branding and responsive layout regression checks passed.');
