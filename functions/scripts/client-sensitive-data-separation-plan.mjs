#!/usr/bin/env node
/**
 * Local-only proposal generator for sensitive client-field separation.
 * Reads a sanitized field inventory JSON; it has no cloud SDK or write path.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildClientSensitiveDataSeparationPlan } from '../../scripts/client-sensitive-data-separation-plan.mjs';

function parseArgs(argv) {
  const result = { dryRun: false, input: '', out: '' };
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
      ['--input', 'input'],
      ['--out', 'out'],
    ].find(([flag]) => arg === flag || arg.startsWith(flag + '='));
    if (!match) throw new Error('Unknown argument: ' + arg);
    const [flag, key] = match;
    let raw;
    if (arg.startsWith(flag + '=')) raw = arg.slice(flag.length + 1).trim();
    else {
      raw = argv[index + 1]?.trim();
      if (!raw || raw.startsWith('--')) throw new Error(flag + ' requires a value');
      index += 1;
    }
    if (!raw) throw new Error(flag + ' cannot be empty');
    result[key] = raw;
  }
  return result;
}

function help() {
  console.log(`InsurNex client data separation planner (local proposal only)

Usage:
  node functions/scripts/client-sensitive-data-separation-plan.mjs --dry-run --input <inventory-report.json>

Options:
  --dry-run                       Required safety flag; no cloud-write path exists
  --input <path>                  Local output from the client sensitive-field inventory CLI
  --out <path>                    Local JSON plan path; existing files are never overwritten
  --help                          Show this message

Reads:
  A local JSON inventory containing record IDs, organization IDs, field paths and categories.

Writes:
  A local proposal-only JSON plan. It never copies client field values or performs cloud writes.

Safety:
  Record IDs and field-presence patterns are still sensitive. Keep both input and output local,
  access-restricted, and out of Git, tickets and chat. Every proposed mapping requires human approval.
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return help();
  if (!args.dryRun) throw new Error('Safety stop: --dry-run is mandatory.');
  if (!args.input) throw new Error('Provide --input with a local inventory report.');

  const inputPath = resolve(process.cwd(), args.input);
  const raw = await readFile(inputPath, 'utf8');
  let inventoryReport;
  try {
    inventoryReport = JSON.parse(raw);
  } catch {
    throw new Error('Input is not valid JSON.');
  }

  const plan = buildClientSensitiveDataSeparationPlan({ inventoryReport });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const projectId = typeof plan.projectId === 'string' ? plan.projectId : 'unknown-project';
  const defaultOut = `artifacts/client-sensitive-data-separation-plan-${projectId}-${timestamp}.json`;
  const outputPath = resolve(process.cwd(), args.out || defaultOut);
  if (outputPath === inputPath) throw new Error('Safety stop: output path must differ from the input report.');

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(plan, null, 2) + '\n', {
    encoding: 'utf8',
    flag: 'wx',
  });

  console.log('Client sensitive-data separation proposal created locally.');
  console.log(JSON.stringify({
    ...plan.summary,
    sourceRecordsScanned: plan.sourceRecordsScanned,
    sourceInventoryPotentiallyIncomplete: plan.sourceInventoryPotentiallyIncomplete,
    noCloudChangesMade: plan.noCloudChangesMade,
    noMigrationExecuted: plan.noMigrationExecuted,
    rawFieldValuesIncluded: plan.rawFieldValuesIncluded,
    humanApprovalRequired: plan.humanApprovalRequired,
  }, null, 2));
  console.log('Local plan saved to: ' + outputPath);
}

main().catch(error => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error('Client data separation plan failed: ' + message.replace(/[\r\n]/g, ' ').slice(0, 300));
  process.exitCode = 1;
});
