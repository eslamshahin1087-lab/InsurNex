import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const manifest = JSON.parse(read('public/manifest.webmanifest'));
const html = read('index.html');
const entry = read('src/main.tsx');
const worker = read('public/sw.js');
const favicon = read('public/favicon.svg');

assert.equal(manifest.display, 'standalone', 'PWA must support standalone display');
assert.equal(manifest.start_url, '/', 'PWA start URL must remain at app root');
assert.equal(manifest.scope, '/', 'PWA scope must include app routes');
assert.equal(manifest.lang, 'ar', 'Manifest language must be Arabic');
assert.equal(manifest.dir, 'rtl', 'Manifest direction must be RTL');

for (const [size, source] of [
  ['192x192', '/pwa-icon-192.png'],
  ['512x512', '/pwa-icon-512.png'],
]) {
  const icon = manifest.icons.find((candidate) => candidate.sizes === size);
  assert.ok(icon, `Manifest must include a ${size} icon`);
  assert.equal(icon.src, source, `Manifest must use the dedicated ${size} PWA icon`);
  assert.equal(icon.type, 'image/png', `${size} PWA icon must be PNG`);
  assert.ok(existsSync(resolve(process.cwd(), 'public', icon.src.replace(/^\//, ''))),
    `Missing PWA icon file: ${icon.src}`);
}

assert.match(html, /<html lang="ar" dir="rtl">/, 'HTML document must be Arabic RTL');
assert.match(html, /name="viewport"[^>]*viewport-fit=cover/,
  'Viewport must extend into safe areas on supported mobile devices');
assert.match(html, /rel="manifest"\s+href="\/manifest\.webmanifest"/,
  'HTML must link the web app manifest');
assert.match(html, /rel="icon"\s+type="image\/svg\+xml"\s+href="\/favicon\.svg"/,
  'browser tabs must use the new blue InsurNex favicon');
assert.doesNotMatch(html, /branding\/logo-light\.png/,
  'page metadata must not expose the retired gold logo');
assert.match(html, /og:image[\s\S]*pwa-icon-512\.png/,
  'social previews must use the refreshed InsurNex brand icon');
assert.match(favicon, /#126cf3/i, 'favicon must use the new InsurNex blue');
assert.doesNotMatch(favicon, /#ffe6a0|#f0c35c|#b9801d/i,
  'favicon must not contain the retired gold palette');
assert.match(html, /rel="apple-touch-icon"\s+href="\/pwa-icon-192\.png"/,
  'HTML must provide an Apple home-screen icon');
assert.match(html, /name="apple-mobile-web-app-title"\s+content="InsurNex"/,
  'Apple standalone title must be configured');
assert.match(entry, /navigator\.serviceWorker\.register\(['"]\/sw\.js['"]/,
  'App entry must register the service worker');
assert.match(worker, /request\.mode === 'navigate'/, 'Worker must handle offline navigation');
assert.match(worker, /url\.pathname\.startsWith\('\/assets\/'\)/,
  'Worker must restrict runtime caching to static Vite assets');
assert.match(worker, /fetch\(request\)\.catch/,
  'Navigation must fail safely offline');
assert.doesNotMatch(worker, /firebaseapp\.com|supabase\.co|firestore\.googleapis\.com/,
  'Worker must not target external data/API endpoints');

for (const iconPath of ['/pwa-icon-192.png', '/pwa-icon-512.png']) {
  assert.match(worker, new RegExp(iconPath.replaceAll('/', '\\/')),
    `Service worker must precache ${iconPath}`);
}

console.log('PWA installability, privacy and blue InsurNex identity checks passed.');

