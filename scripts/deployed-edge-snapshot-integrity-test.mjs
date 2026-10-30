import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(await readFile(resolve(root, 'supabase/deployed-snapshots/2026-10-30/manifest.json'), 'utf8'));

assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.deploymentState, 'snapshots-only-not-deployable');
assert.equal(manifest.projectRef, 'piloiwtdbtmfiyqxfbae');
assert.equal(manifest.functions.length, 5);
const slugs = new Set(manifest.functions.map((item) => item.slug));
for (const slug of ['copilot-chat', 'document-storage', 'securepath-webhook', 'cron-policy-check', 'cron-document-check']) {
  assert.ok(slugs.has(slug), 'missing deployed source snapshot: ' + slug);
}

for (const fn of manifest.functions) {
  assert.equal(fn.status, 'ACTIVE');
  assert.ok(Number.isInteger(fn.version) && fn.version > 0);
  assert.ok(typeof fn.deployedBundleSha256 === 'string' && fn.deployedBundleSha256.length === 64);
  assert.ok(Array.isArray(fn.files) && fn.files.length > 0);
  for (const file of fn.files) {
    assert.ok(file.path.startsWith('supabase/deployed-snapshots/2026-10-30/'));
    const content = await readFile(resolve(root, file.path));
    const gitBlob = createHash('sha1').update('blob ' + content.length + '\0').update(content).digest('hex');
    assert.equal(gitBlob, file.gitBlobSha, 'snapshot integrity mismatch: ' + file.path);
    assert.doesNotMatch(content.toString('utf8'), /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/);
    assert.doesNotMatch(content.toString('utf8'), /AIza[0-9A-Za-z_-]{30,}/);
    assert.doesNotMatch(content.toString('utf8'), /sb_secret_[A-Za-z0-9_-]{20,}/);
  }
}
for (const fn of manifest.functions.filter((item) => item.slug.startsWith('cron-'))) {
  assert.ok(fn.observedRisks.some((risk) => risk.includes('SUPABASE_SERVICE_ROLE_KEY')));
}
console.log('Deployed Edge Function snapshot integrity passed (5 active functions; archive only, no deployment).');
