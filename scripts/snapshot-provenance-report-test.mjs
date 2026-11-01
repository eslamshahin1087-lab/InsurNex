import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const reportScript = path.resolve(root, 'scripts/snapshot-provenance-report.mjs');
const run = () => execFileSync(process.execPath, [reportScript, '--json'], {
  cwd: root,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

const first = run();
const second = run();
assert.equal(first, second, 'provenance report must be byte-for-byte reproducible');
const report = JSON.parse(first);

assert.equal(report.reportSchemaVersion, 1);
assert.equal(report.archiveOnly, true);
assert.equal(report.deploymentAction, 'none');
assert.equal(report.deploymentState, 'snapshots-only-not-deployable');
assert.equal(report.summary.functionCount, 5);
assert.equal(report.summary.snapshotFileCount, 6);
assert.equal(report.summary.secretScreenedFileCount, 6);
assert.equal(report.summary.canonicalMatches, 0);
assert.equal(report.summary.canonicalMismatches, 4);
assert.equal(report.summary.canonicalNotPresent, 1);
assert.equal(report.summary.configurationRevisionUnavailable, 5);
assert.equal(report.canonicalSourceComparison.commitSha, 'ca08aaeee376855d839111d1cf711506452bb6c7');

const expectedParity = {
  'copilot-chat': 'mismatch',
  'document-storage': 'mismatch',
  'securepath-webhook': 'not-present-in-main',
  'cron-policy-check': 'mismatch',
  'cron-document-check': 'mismatch',
};

for (const fn of report.functions) {
  assert.equal(fn.canonicalSourceComparison.parity, expectedParity[fn.slug]);
  assert.equal(fn.observedAt, report.capturedAt);
  assert.equal(fn.configurationRevision, null);
  assert.equal(fn.configurationRevisionStatus, 'not-returned-by-read-only-metadata-capture');
  for (const file of fn.files) {
    assert.match(file.gitBlobSha, /^[a-f0-9]{40}$/);
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
    assert.ok(file.bytes > 0);
  }
}

const serialized = JSON.stringify(report);
assert.equal(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(serialized), false);
assert.equal(/AIza[0-9A-Za-z_-]{30,}/.test(serialized), false);
assert.equal(/sb_secret_[A-Za-z0-9_-]{20,}/.test(serialized), false);
assert.equal(report.functions.some((fn) => fn.files.some((file) => file.path.includes('..'))), false);

const stdout = execFileSync(process.execPath, [reportScript], {
  cwd: root,
  encoding: 'utf8',
});
assert.match(stdout, /archive only; no deployment/i);
assert.match(stdout, /Canonical source mismatches: 4/);
assert.match(stdout, /Configuration revisions unavailable in captured metadata: 5/);

console.log('Runtime snapshot provenance is reproducible, integrity-checked, drift-aware and archive-only.');
