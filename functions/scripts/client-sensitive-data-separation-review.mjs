#!/usr/bin/env node
/**
 * Local-only validation of a proposal-only client-data separation plan.
 * It does not connect to Firebase, Supabase, Storage, or any network service.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { reviewClientSensitiveDataSeparationPlan } from '../../scripts/client-sensitive-data-separation-review.mjs';

function parseArgs(argv) {
  const result = { dryRun: false, input: '' };
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
    if (arg === '--input' || arg.startsWith('--input=')) {
      const raw = arg.startsWith('--input=')
        ? arg.slice('--input='.length).trim()
        : argv[index + 1]?.trim();
      if (!raw || raw.startsWith('--')) throw new Error('--input requires a local file path');
      if (arg === '--input') index += 1;
      result.input = raw;
      continue;
    }
    throw new Error('Unknown argument: ' + arg);
  }
  return result;
}

function help() {
  console.log(`InsurNex client separation-plan reviewer (local, no cloud access)

Usage:
  node functions/scripts/client-sensitive-data-separation-review.mjs --dry-run --input <plan.json>

The reviewer checks:
  - plan safety flags and strict schema (unexpected fields fail closed)
  - source record counts and inventory completeness
  - composite-parent split invariants
  - destination/class consistency
  - health/family path classification
  - manual-review requirements for document references and free-form notes

It prints aggregate metrics and stable violation codes only. It does not print record IDs,
organization IDs, field paths, free-form reasons or field values. It never migrates data.
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return help();
  if (!args.dryRun) throw new Error('Safety stop: --dry-run is mandatory.');
  if (!args.input) throw new Error('Provide --input with a local separation plan.');

  let plan;
  try {
    plan = JSON.parse(await readFile(resolve(process.cwd(), args.input), 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') throw new Error('The local plan file was not found.');
    if (error instanceof SyntaxError) throw new Error('The local plan is not valid JSON.');
    throw new Error('Could not read the local plan file.');
  }

  const review = reviewClientSensitiveDataSeparationPlan({ plan });
  console.log(JSON.stringify(review, null, 2));
  console.log('Approved for migration: false');
  console.log('Cloud changes made: none');
  console.log('Migration executed: no');
  if (review.status !== 'review_only') process.exitCode = 2;
}

main().catch(error => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error('Separation-plan review failed: ' + message.replace(/[
]/g, ' ').slice(0, 240));
  process.exitCode = 1;
});
