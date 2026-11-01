import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const ARCHIVE_ROOT = 'supabase/deployed-snapshots/2026-10-30/';
const MANIFEST_PATH = path.join(ROOT, ARCHIVE_ROOT, 'manifest.json');
const README_PATH = path.join(ROOT, ARCHIVE_ROOT, 'README.md');
const EXPECTED_FUNCTIONS = [
  'copilot-chat',
  'document-storage',
  'securepath-webhook',
  'cron-policy-check',
  'cron-document-check',
];

function gitBlobSha(bytes) {
  const header = Buffer.concat([
    Buffer.from('blob ' + bytes.length, 'utf8'),
    Buffer.from([0]),
  ]);
  return createHash('sha1').update(header).update(bytes).digest('hex');
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertSecretScreened(content, label) {
  const text = content.toString('utf8');
  const patterns = [
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'],
    [/AIza[0-9A-Za-z_-]{30,}/, 'Google API key'],
    [/sb_secret_[A-Za-z0-9_-]{20,}/, 'Supabase secret key'],
    [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, 'JWT-like token'],
  ];
  for (const [pattern, description] of patterns) {
    assert.doesNotMatch(text, pattern, label + ' contains a possible ' + description);
  }
}

function assertSafeArchivePath(filePath) {
  assert.equal(typeof filePath, 'string');
  assert.ok(filePath.startsWith(ARCHIVE_ROOT), 'snapshot path is outside the dated archive');
  assert.equal(path.isAbsolute(filePath), false, 'absolute snapshot path is forbidden');
  assert.equal(path.posix.normalize(filePath), filePath, 'snapshot path must be normalized');
  assert.equal(filePath.includes('..'), false, 'snapshot path traversal is forbidden');
  assert.ok(filePath.endsWith('.ts') || filePath.endsWith('.json'), 'unexpected snapshot file type');
}

function lineCount(text) {
  return (text.match(/\n/g) || []).length + 1;
}

const manifestBytes = await readFile(MANIFEST_PATH);
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const archiveReadme = await readFile(README_PATH, 'utf8');

assert.equal(manifest.schemaVersion, 2, 'manifest schema must be version 2');
assert.equal(manifest.deploymentState, 'snapshots-only-not-deployable');
assert.equal(manifest.source, 'Supabase Edge Function metadata/source read; read-only');
assert.match(manifest.capturedAt, /^2026-10-30T/);
assert.equal(manifest.projectRef, 'piloiwtdbtmfiyqxfbae');
assert.match(archiveReadme, /ARCHIVE ONLY — NEVER DEPLOY FROM THIS DIRECTORY/);
assert.match(archiveReadme, /not canonical deployment sources/i);
assert.match(archiveReadme, /Per-file Git blob SHA values/);

const comparison = manifest.canonicalSourceComparison;
assert.equal(comparison.repository, 'eslamshahin1087-lab/InsurNex');
assert.equal(comparison.branch, 'main');
assert.match(comparison.commitSha, /^[a-f0-9]{40}$/);
assert.match(comparison.comparedAt, /^2026-11-01$/);
assert.equal(comparison.comparisonType, 'git-blob-sha');
assert.match(comparison.scope, /not a live deployment/i);

assert.deepEqual(
  [...manifest.functions].map((fn) => fn.slug).sort(),
  [...EXPECTED_FUNCTIONS].sort(),
  'the dated snapshot must include exactly the five recorded functions',
);

const reportFunctions = [];
const summary = {
  functionCount: manifest.functions.length,
  snapshotFileCount: 0,
  canonicalMatches: 0,
  canonicalMismatches: 0,
  canonicalNotPresent: 0,
  configurationRevisionUnavailable: 0,
  secretScreenedFileCount: 0,
};

for (const fn of [...manifest.functions].sort((a, b) => a.slug.localeCompare(b.slug))) {
  assert.equal(fn.status, 'ACTIVE');
  assert.ok(Number.isInteger(fn.version) && fn.version > 0);
  assert.match(fn.deployedBundleSha256, /^[a-f0-9]{64}$/);
  assert.ok(Number.isFinite(Date.parse(fn.updatedAt)));
  assert.equal(fn.observedAt, manifest.capturedAt);
  assert.equal(typeof fn.verifyJwt, 'boolean');
  assert.equal(fn.configurationObservation.gatewayVerifyJwt, fn.verifyJwt);
  assert.equal(fn.configurationObservation.source, 'deployed function metadata at capture time');
  assert.equal(fn.configurationObservation.revision, null);
  assert.equal(
    fn.configurationObservation.revisionStatus,
    'not-returned-by-read-only-metadata-capture',
  );
  summary.configurationRevisionUnavailable += 1;
  assert.ok(Array.isArray(fn.observedRisks) && fn.observedRisks.length > 0);
  assert.ok(Array.isArray(fn.files) && fn.files.length > 0);

  const reportFiles = [];
  for (const file of [...fn.files].sort((a, b) => a.path.localeCompare(b.path))) {
    assertSafeArchivePath(file.path);
    const absolutePath = path.resolve(ROOT, file.path);
    const relativePath = path.relative(ROOT, absolutePath);
    assert.ok(!relativePath.startsWith('..') && !path.isAbsolute(relativePath));

    const bytes = await readFile(absolutePath);
    const text = bytes.toString('utf8');
    const actualGitBlobSha = gitBlobSha(bytes);
    assert.equal(actualGitBlobSha, file.gitBlobSha, 'Git blob SHA mismatch: ' + file.path);
    assert.equal(text.length, file.characters, 'character count mismatch: ' + file.path);
    assert.equal(lineCount(text), file.lines, 'line count mismatch: ' + file.path);
    assertSecretScreened(bytes, file.path);

    reportFiles.push({
      path: file.path,
      bytes: bytes.length,
      characters: text.length,
      lines: lineCount(text),
      gitBlobSha: actualGitBlobSha,
      sha256: sha256(bytes),
    });
    summary.snapshotFileCount += 1;
    summary.secretScreenedFileCount += 1;
  }

  const canonical = fn.canonicalSourceComparison;
  if (canonical.parity === 'not-present-in-main') {
    assert.equal(canonical.path, null);
    assert.equal(canonical.gitBlobSha, null);
    assert.equal(canonical.snapshotGitBlobSha, null);
    summary.canonicalNotPresent += 1;
  } else {
    assert.ok(canonical.path.startsWith('supabase/functions/'));
    assert.match(canonical.gitBlobSha, /^[a-f0-9]{40}$/);
    // Compare against the pinned canonical commit, not the current feature
    // branch working tree. This lets the same gate validate PRs that intentionally
    // change an Edge Function while preserving the historical baseline report.
    const canonicalBytes = execFileSync(
      'git',
      ['show', comparison.commitSha + ':' + canonical.path],
      { cwd: ROOT, maxBuffer: 8 * 1024 * 1024 },
    );
    const actualCanonicalSha = gitBlobSha(canonicalBytes);
    assert.equal(
      actualCanonicalSha,
      canonical.gitBlobSha,
      'canonical source changed since recorded comparison: ' + canonical.path,
    );
    const snapshotIndex = fn.files.find((file) => file.path.endsWith('/index.ts'));
    assert.ok(snapshotIndex, fn.slug + ' snapshot index.ts is missing');
    assert.equal(canonical.snapshotGitBlobSha, snapshotIndex.gitBlobSha);
    const parity = snapshotIndex.gitBlobSha === actualCanonicalSha ? 'match' : 'mismatch';
    assert.equal(canonical.parity, parity, 'canonical/source parity classification is incorrect');
    if (parity === 'match') summary.canonicalMatches += 1;
    else summary.canonicalMismatches += 1;
  }

  reportFunctions.push({
    slug: fn.slug,
    status: fn.status,
    version: fn.version,
    updatedAt: fn.updatedAt,
    observedAt: fn.observedAt,
    verifyJwt: fn.verifyJwt,
    configurationRevision: null,
    configurationRevisionStatus: fn.configurationObservation.revisionStatus,
    deployedBundleSha256: fn.deployedBundleSha256,
    canonicalSourceComparison: canonical,
    files: reportFiles,
    observedRisks: [...fn.observedRisks],
  });
}

const report = {
  reportSchemaVersion: 1,
  archiveOnly: true,
  deploymentAction: 'none',
  capturedAt: manifest.capturedAt,
  projectRef: manifest.projectRef,
  deploymentState: manifest.deploymentState,
  canonicalSourceComparison: comparison,
  summary,
  functions: reportFunctions,
};

if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(report, null, 2) + String.fromCharCode(10));
} else {
  process.stdout.write(
    [
      'Snapshot provenance validation passed (archive only; no deployment).',
      'Functions: ' + summary.functionCount,
      'Snapshot files: ' + summary.snapshotFileCount,
      'Canonical source matches: ' + summary.canonicalMatches,
      'Canonical source mismatches: ' + summary.canonicalMismatches,
      'Canonical source not present in main: ' + summary.canonicalNotPresent,
      'Configuration revisions unavailable in captured metadata: ' + summary.configurationRevisionUnavailable,
      'Secret-screened files: ' + summary.secretScreenedFileCount,
    ].join(String.fromCharCode(10)) + String.fromCharCode(10),
  );
}
