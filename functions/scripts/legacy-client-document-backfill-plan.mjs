#!/usr/bin/env node
/**
 * Read-only backfill planner for legacy embedded client documents.
 *
 * This tool reads Firestore metadata only and emits a local review manifest.
 * It does not query Storage, write Firestore, upload/copy files, or delete data.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { buildLegacyClientDocumentBackfillPlan } from '../../scripts/legacy-client-document-backfill-policy.mjs';

function parseArgs(argv) {
  const result = { dryRun: false, projectId: '', supabaseHost: '', bucket: '', out: '' };
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
    const fields = [
      ['--project', 'projectId'],
      ['--supabase-host', 'supabaseHost'],
      ['--bucket', 'bucket'],
      ['--out', 'out'],
    ];
    const match = fields.find(([flag]) => arg === flag || arg.startsWith(flag + '='));
    if (!match) throw new Error('Unknown argument: ' + arg);
    const [flag, key] = match;
    let value;
    if (arg.startsWith(flag + '=')) value = arg.slice(flag.length + 1).trim();
    else {
      value = argv[index + 1]?.trim();
      if (!value || value.startsWith('--')) throw new Error(flag + ' requires a value');
      index += 1;
    }
    if (!value) throw new Error(flag + ' cannot be empty');
    result[key] = value;
  }
  return result;
}

function help() {
  console.log(`InsurNex legacy client document backfill planner (read-only)

Usage:
  node functions/scripts/legacy-client-document-backfill-plan.mjs --dry-run --project <firebase-project-id> --supabase-host <exact-project-host> --bucket <exact-bucket>

Options:
  --dry-run                         Required safety flag; no cloud writes are implemented
  --project <id>                    Exact Firebase project ID
  --supabase-host <host>             Exact hostname from the configured Supabase project URL
  --bucket <name>                    Exact private Supabase Storage bucket name
  --out <path>                       Local JSON path (must not already exist)
  --help                             Show this message

Reads:
  Firestore clients and documents metadata only.

Does not:
  Access Cloud Storage APIs, access Supabase Storage, modify Firestore, write signed URLs,
  upload/copy/delete objects, or execute a backfill.

The local manifest contains client/organization IDs and storage paths; treat it as sensitive.
`);
}

function safeClientProjection(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    data: {
      organizationId: data.organizationId,
      createdBy: data.createdBy,
      documents: Array.isArray(data.documents) ? data.documents.map(item => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
        return {
          id: item.id,
          storageProvider: item.storageProvider,
          storageBucket: item.storageBucket,
          storagePath: item.storagePath,
          url: item.url,
          downloadUrl: item.downloadUrl,
          label: item.label,
          name: item.name,
          fileName: item.fileName,
          originalFileName: item.originalFileName,
          category: item.category,
          type: item.type,
          contentType: item.contentType,
          mimeType: item.mimeType,
          size: item.size,
          uploadedAt: item.uploadedAt,
          uploadedBy: item.uploadedBy,
          notes: item.notes,
          verified: item.verified,
        };
      }) : [],
    },
  };
}

function safeDocumentProjection(snapshot) {
  const data = snapshot.data();
  return {
    id: snapshot.id,
    data: {
      organizationId: data.organizationId,
      relatedType: data.relatedType,
      relatedId: data.relatedId,
      storageProvider: data.storageProvider,
      storageBucket: data.storageBucket,
      storagePath: data.storagePath,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    help();
    return;
  }
  if (!args.dryRun) throw new Error('Safety stop: --dry-run is mandatory.');
  if (!/^[a-z][a-z0-9-]{4,29}$/.test(args.projectId)) {
    throw new Error('Provide a valid explicit Firebase project ID.');
  }
  if (!/^[a-z0-9.-]+$/.test(args.supabaseHost) || args.supabaseHost.includes('..')) {
    throw new Error('Provide the exact Supabase hostname only, without scheme or path.');
  }
  if (!/^[a-z0-9][a-z0-9_-]{1,62}$/.test(args.bucket)) {
    throw new Error('Provide the exact Supabase Storage bucket name.');
  }

  const configuredProject = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (configuredProject && configuredProject !== args.projectId) {
    throw new Error('Safety stop: --project does not match GCLOUD_PROJECT/GOOGLE_CLOUD_PROJECT.');
  }

  const app = initializeApp({
    credential: applicationDefault(),
    projectId: args.projectId,
  }, 'insurnex-legacy-client-backfill-plan');
  try {
    const firestore = getFirestore(app);
    console.log('Reading Firestore client metadata...');
    const clientsSnapshot = await firestore.collection('clients').get();
    console.log('Reading existing document metadata...');
    const documentsSnapshot = await firestore.collection('documents').get();

    const plan = buildLegacyClientDocumentBackfillPlan({
      projectId: args.projectId,
      supabaseHost: args.supabaseHost,
      bucket: args.bucket,
      clientRecords: clientsSnapshot.docs.map(safeClientProjection),
      documentRecords: documentsSnapshot.docs.map(safeDocumentProjection),
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultOut = `artifacts/legacy-client-document-backfill-plan-${args.projectId}-${timestamp}.json`;
    const outputPath = resolve(process.cwd(), args.out || defaultOut);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, JSON.stringify(plan, null, 2) + '\\n', { encoding: 'utf8', flag: 'wx' });

    console.log('Read-only backfill plan complete.');
    console.log(JSON.stringify(plan.counts, null, 2));
    console.log('Plan saved locally: ' + outputPath);
    console.log('Cloud changes made: none');
    console.log('Storage objects verified: none; plan requires independent object verification.');
  } finally {
    await app.delete();
  }
}

main().catch(error => {
  console.error('Legacy client backfill plan failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
  process.exitCode = 1;
});
