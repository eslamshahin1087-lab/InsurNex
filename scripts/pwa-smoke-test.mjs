import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const manifest = JSON.parse(read('public/manifest.webmanifest'));
const html = read('index.html');
const entry = read('src/main.tsx');
const worker = read('public/sw.js');

assert.equal(manifest.display, 'standalone', 'PWA must support standalone display');
assert.equal(manifest.start_url, '/', 'PWA start URL must remain at app root');
assert.equal(manifest.scope, '/', 'PWA scope must include app routes');
assert.equal(manifest.lang, 'ar', 'Manifest language must be Arabic');
assert.equal(manifest.dir, 'rtl', 'Manifest direction must be RTL');

for (const size of ['192x192', '512x512']) {
  const icon = manifest.icons.find((candidate) => candidate.sizes === size);
  assert.ok(icon, `Manifest must include a ${size} icon`);
  assert.ok(existsSync(resolve(process.cwd(), 'public', icon.src.replace(/^\//, ''))),
    `Missing PWA icon file: ${icon.src}`);
}

assert.match(html, /<html lang="ar" dir="rtl">/, 'HTML document must be Arabic RTL');
assert.match(html, /rel="manifest"\s+href="\/manifest\.webmanifest"/,
  'HTML must link the web app manifest');
assert.match(entry, /navigator\.serviceWorker\.register\(['"]\/sw\.js['"]/,
  'App entry must register the service worker');
assert.match(worker, /request\.mode === 'navigate'/, 'Worker must handle offline navigation');
assert.match(worker, /url\.pathname\.startsWith\('\/assets\/'\)/,
  'Worker must restrict runtime caching to static Vite assets');
assert.match(worker, /fetch\(request\)\.catch/, 'Navigation must fail safely offline');
assert.doesNotMatch(worker, /firebaseapp\.com|supabase\.co|firestore\.googleapis\.com/,
  'Worker must not target external data/API endpoints');

console.log('PWA smoke checks passed.');
