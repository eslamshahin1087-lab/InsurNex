import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const functionsRoot = resolve(root, 'functions');
const packageJson = JSON.parse(await readFile(resolve(functionsRoot, 'package.json'), 'utf8'));
const guardPath = resolve(functionsRoot, 'scripts/guard-spark-deploy.mjs');

assert.equal(
  packageJson.scripts?.deploy,
  'node scripts/guard-spark-deploy.mjs',
  'the legacy Functions deploy script must fail closed under the approved Spark baseline',
);

const result = spawnSync(process.execPath, [guardPath], {
  cwd: functionsRoot,
  encoding: 'utf8',
  timeout: 5_000,
});

assert.equal(result.error, undefined, 'the deployment guard must execute without spawning Firebase CLI');
assert.equal(result.status, 1, 'the deployment guard must block deployment');
assert.match(result.stderr, /BLOCKED: Firebase Cloud Functions deployment is disabled/);
assert.match(result.stderr, /approved project baseline is Firebase Spark/);
assert.match(result.stderr, /No Firebase CLI command was run/);

const packageSource = await readFile(resolve(functionsRoot, 'package.json'), 'utf8');
assert.doesNotMatch(packageSource, /"deploy"\s*:\s*"firebase deploy/);

console.log('Spark runtime deployment guard tests passed; no Firebase deployment was attempted.');
