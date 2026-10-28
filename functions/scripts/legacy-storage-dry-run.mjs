#!/usr/bin/env node
/**
 * Read-only Firebase Storage inventory. This script has no cloud write path.
 * Run from the repository root with explicit project and bucket flags.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { buildLegacyStorageInventory } from '../../scripts/legacy-storage-inventory-policy.mjs';

const DEFAULT_COLLECTIONS = ['documents', 'operationAttachments'];
const MAX_ATTEMPTS = 3;

function parseArgs(argv) {
  const result = { dryRun: false, projectId: '', bucketName: '', collections: [...DEFAULT_COLLECTIONS], out: '' };
  const value = (index, flag) => {
    const arg = argv[index];
    if (arg?.startsWith(flag + '=')) return { value: arg.slice(flag.length + 1), consumed: 0 };
    if (arg === flag && argv[index + 1] && !argv[index + 1].startsWith('--')) {
      return { value: argv[index + 1], consumed: 1 };
    }
    return null;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') { result.dryRun = true; continue; }
    if (arg === '--help' || arg === '-h') { result.help = true; continue; }
    const pairs = [
      ['--project', 'projectId'],
      ['--bucket', 'bucketName'],
      ['--collections', 'collections'],
      ['--out', 'out'],
    ];
    let matched = false;
    for (const [flag, key] of pairs) {
      const found = value(i, flag);
      if (!found) continue;
      const raw = found.value.trim();
      if (!raw) throw new Error(flag + ' cannot be empty');
      if (key === 'collections') {
        result.collections = raw.split(',').map(item => item.trim()).filter(Boolean);
      } else {
        result[key] = raw;
      }
      i += found.consumed;
      matched = true;
      break;
    }
    if (!matched) throw new Error('Unknown argument: ' + arg);
  }
  return result;
}

function help() {
  console.log(`InsurNex legacy Firebase Storage inventory (read-only)

Usage:
  node functions/scripts/legacy-storage-dry-run.mjs --dry-run --project <firebase-project-id> --bucket <firebase-storage-bucket>

Options:
  --collections documents,operationAttachments  Firestore collections to inspect
  --out <path>                                  Output JSON path (local file only)
  --help                                        Show this message

Safety:
  --dry-run is mandatory. The script only lists bucket objects and reads Firestore
  metadata; it has no cloud upload, update, migration or delete operation.
  Authentication uses Application Default Credentials (ADC). Grant read-only
  access in the target project and run from the repository root.
`);
}

function asObjectMetadata(file, raw = {}) {
  const source = Object.keys(raw).length ? raw : (file.metadata || {});
  const size = source.size == null ? null : Number(source.size);
  return {
    name: file.name,
    size: Number.isFinite(size) ? size : null,
    contentType: source.contentType || null,
    md5Hash: source.md5Hash || null,
    crc32c: source.crc32c || null,
    created: source.timeCreated || source.created || null,
    updated: source.updated || null,
  };
}

async function retryRead(label, operation, retryLog) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const code = typeof error?.code === 'string' || typeof error?.code === 'number' ? String(error.code) : null;
      if (attempt >= MAX_ATTEMPTS) {
        retryLog.push({ operation: label, attempt, outcome: 'failed', errorName: error?.name || 'Error', errorCode: code });
        throw new Error(`Read failed after ${MAX_ATTEMPTS} attempts: ${label} (${code || error?.name || 'unknown error'})`);
      }
      const delayMs = Math.min(500 * (2 ** (attempt - 1)), 4000);
      retryLog.push({ operation: label, attempt, outcome: 'retrying', delayMs, errorName: error?.name || 'Error', errorCode: code });
      await new Promise(resolveDelay => setTimeout(resolveDelay, delayMs));
    }
  }
  throw new Error('Unreachable retry state');
}

async function listBucketObjects(bucket, retryLog) {
  const objects = [];
  let query = { autoPaginate: false, maxResults: 500 };
  let page = 0;
  while (query) {
    page += 1;
    const result = await retryRead('storage.list.page.' + page, () => bucket.getFiles(query), retryLog);
    const files = result[0] || [];
    const nextQuery = result[1] || null;
    const response = result[2] || {};
    const rawByName = new Map((response.items || []).filter(item => typeof item.name === 'string').map(item => [item.name, item]));
    for (const file of files) objects.push(asObjectMetadata(file, rawByName.get(file.name) || {}));
    query = nextQuery ? { ...nextQuery, autoPaginate: false, maxResults: 500 } : null;
    if (page > 100000) throw new Error('Safety stop: unexpected storage pagination loop');
  }
  return objects;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { help(); return; }
  if (!args.dryRun) throw new Error('Safety stop: --dry-run is mandatory; this tool has no live migration mode.');
  if (!/^[a-z][a-z0-9-]{4,29}$/.test(args.projectId)) {
    throw new Error('Provide a valid explicit Firebase project ID with --project.');
  }
  if (!args.bucketName || args.bucketName.includes('://') || args.bucketName.includes('/')) {
    throw new Error('Provide the exact Cloud Storage bucket name with --bucket.');
  }
  if (!args.collections.length || args.collections.some(name => !/^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(name))) {
    throw new Error('Invalid --collections value.');
  }
  const configuredProject = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  if (configuredProject && configuredProject !== args.projectId) {
    throw new Error('Safety stop: --project does not match GCLOUD_PROJECT/GOOGLE_CLOUD_PROJECT.');
  }

  const app = initializeApp({
    credential: applicationDefault(),
    projectId: args.projectId,
    storageBucket: args.bucketName,
  }, 'insurnex-legacy-storage-dry-run');
  const firestore = getFirestore(app);
  const bucket = getStorage(app).bucket(args.bucketName);
  const retryLog = [];
  const metadataRecords = [];

  for (const collectionName of args.collections) {
    console.log('Reading Firestore metadata collection: ' + collectionName);
    const snapshot = await retryRead(
      'firestore.collection.' + collectionName,
      () => firestore.collection(collectionName).get(),
      retryLog,
    );
    for (const document of snapshot.docs) {
      const data = document.data();
      // Keep the report scoped to storage reconciliation metadata; do not copy
      // client contact, medical, claim narrative or other unrelated fields.
      metadataRecords.push({
        collection: collectionName,
        id: document.id,
        data: {
          organizationId: data.organizationId,
          storageProvider: data.storageProvider,
          storagePath: data.storagePath,
          downloadUrl: data.downloadUrl,
          originalFileName: data.originalFileName,
          name: data.name,
          size: data.size,
          contentType: data.contentType,
          md5Hash: data.md5Hash,
          md5Checksum: data.md5Checksum,
          storageMd5Hash: data.storageMd5Hash,
          createdAt: data.createdAt,
        },
      });
    }
  }

  console.log('Listing objects in explicitly selected storage bucket: ' + args.bucketName);
  const objects = await listBucketObjects(bucket, retryLog);
  const report = buildLegacyStorageInventory({
    projectId: args.projectId,
    bucket: args.bucketName,
    collections: args.collections,
    metadataRecords,
    objects,
    retryLog,
  });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const defaultOut = `artifacts/legacy-storage-dry-run-${args.projectId}-${timestamp}.json`;
  const outputPath = resolve(process.cwd(), args.out || defaultOut);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(report, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });

  console.log('\nRead-only inventory complete.');
  console.log(JSON.stringify(report.summary, null, 2));
  console.log('Report saved locally: ' + outputPath);
  console.log('Cloud changes made: none');
}

main().catch(error => {
  console.error('Legacy storage dry-run failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
  process.exitCode = 1;
});
