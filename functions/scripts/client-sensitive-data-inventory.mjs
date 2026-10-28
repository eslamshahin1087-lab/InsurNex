#!/usr/bin/env node
/**
 * Read-only inventory of sensitive/private field presence in clients.
 * Does not emit field values and contains no Firestore write path.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { buildClientSensitiveDataInventory } from '../../scripts/client-sensitive-data-inventory-policy.mjs';

function parseArgs(argv) {
  const result = { dryRun: false, projectId: '', out: '', maxRecords: 1000 };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      result.dryRun = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      result.help = true;
      continue;
    }
    const match = [
      ['--project', 'projectId'],
      ['--out', 'out'],
      ['--max-records', 'maxRecords'],
    ].find(([flag]) => arg === flag || arg.startsWith(flag + '='));
    if (!match) throw new Error('Unknown argument: ' + arg);
    const [flag, key] = match;
    let raw;
    if (arg.startsWith(flag + '=')) {
      raw = arg.slice(flag.length + 1).trim();
    } else {
      raw = argv[index + 1]?.trim();
      if (!raw || raw.startsWith('--')) throw new Error(flag + ' requires a value');
      index += 1;
    }
    if (!raw) throw new Error(flag + ' cannot be empty');
    if (key === 'maxRecords') {
      const parsed = Number(raw);
      if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 100000) {
        throw new Error('--max-records must be an integer between 1 and 100000');
      }
      result.maxRecords = parsed;
    } else {
      result[key] = raw;
    }
  }
  return result;
}

function help() {
  console.log(`InsurNex client sensitive-field inventory (read-only)

Usage:
  node functions/scripts/client-sensitive-data-inventory.mjs --dry-run --project <firebase-project-id>

Options:
  --dry-run                         Required safety flag; no cloud writes are implemented
  --project <id>                    Exact Firebase project ID
  --max-records <number>            Maximum client records to read (default 1000; 1..100000)
  --out <path>                      Local JSON report path; existing reports are never overwritten
  --help                            Show this message

Reads:
  Firestore clients metadata only, capped by --max-records.

Reports:
  Document IDs, organization IDs, sensitive field-path presence and aggregate counts.
  No field values, client names, contact values, document URLs, or signed URL tokens.

Does not:
  Write Firestore, change rules, split fields, inspect Storage objects, or migrate data.
  If the record cap is reached, the report explicitly marks the scan as potentially incomplete.

The output contains organization/client identifiers; keep it local and treat it as sensitive.
`);
}

function projectLooksValid(projectId) {
  return /^[a-z][a-z0-9-]{4,29}$/.test(projectId);
}

function isLikelyCredentialError(error) {
  const message = String(error?.message || '').toLowerCase();
  return /default credentials|application default credentials|could not load.*credentials/.test(message);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return help();
  if (!args.dryRun) throw new Error('Safety stop: --dry-run is mandatory.');
  if (!projectLooksValid(args.projectId)) throw new Error('Provide an explicit, valid Firebase project ID.');

  const configuredProject = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (configuredProject && configuredProject !== args.projectId) {
    throw new Error('Safety stop: the requested project does not match the active GCLOUD_PROJECT/GOOGLE_CLOUD_PROJECT.');
  }

  const app = initializeApp({
    credential: applicationDefault(),
    projectId: args.projectId,
  }, 'insurnex-client-sensitive-field-inventory');

  try {
    const db = getFirestore(app);
    console.log('Reading clients metadata (read-only; limit ' + args.maxRecords + ')...');
    let snapshot;
    try {
      snapshot = await db.collection('clients').orderBy('__name__').limit(args.maxRecords).get();
    } catch (error) {
      if (isLikelyCredentialError(error)) {
        throw new Error('Could not load Application Default Credentials (ADC). Authenticate in Cloud Shell or configure ADC for this project.');
      }
      throw error;
    }

    const records = snapshot.docs.map(document => ({
      id: document.id,
      data: document.data(),
    }));
    const report = buildClientSensitiveDataInventory({
      projectId: args.projectId,
      records,
    });

    report.scan = {
      maxRecords: args.maxRecords,
      recordsReturned: records.length,
      potentiallyIncomplete: records.length === args.maxRecords,
      note: records.length === args.maxRecords
        ? 'The record cap was reached. Re-run with a higher --max-records to determine whether additional client records exist.'
        : 'The configured record cap was not reached.',
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultOut = `artifacts/client-sensitive-data-inventory-${args.projectId}-${timestamp}.json`;
    const outputPath = resolve(process.cwd(), args.out || defaultOut);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n', {
      encoding: 'utf8',
      flag: 'wx',
    });

    console.log('Client sensitive-field inventory complete.');
    console.log(JSON.stringify({
      ...report.summary,
      maxRecords: report.scan.maxRecords,
      recordsReturned: report.scan.recordsReturned,
      potentiallyIncomplete: report.scan.potentiallyIncomplete,
    }, null, 2));
    console.log('Report saved locally: ' + outputPath);
    console.log('Cloud changes made: none');
    console.log('Raw field values included: false');
  } finally {
    await app.delete();
  }
}

main().catch(error => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error('Client sensitive-field inventory failed: ' + message.replace(/[\r\n]/g, ' ').slice(0, 300));
  process.exitCode = 1;
});
