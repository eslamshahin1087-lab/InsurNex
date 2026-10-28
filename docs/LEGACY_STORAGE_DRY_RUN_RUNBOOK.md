# Legacy Firebase Storage Inventory — Dry-Run Runbook

## Purpose

The inventory tool compares metadata in Firestore with object listings from one explicitly selected Firebase Storage bucket. It is a read-only discovery step before any later migration. It is not a migration utility and does not modify cloud data.

## Safety boundaries

- The command requires `--dry-run`, an explicit `--project`, and an explicit `--bucket`.
- The script contains only Firestore reads and Storage object-listing calls. It has no upload, update, copy, or delete path.
- Use Application Default Credentials (ADC) with read-only access to the intended project. Do not pass or commit service-account JSON, tokens, or secrets as command-line arguments.
- A local JSON report is created. It contains organization IDs, Firestore document IDs, object paths, filenames, object sizes and provider checksum metadata. Treat it as operationally sensitive and store it in an approved local location.
- This runbook does not authorize production deployment, object migration, source deletion, or changes to a live bucket.

## Prerequisites

1. Node.js 22 (matching repository CI).
2. From the repository root, install root and Functions dependencies:
   ```sh
   npm ci
   npm ci --prefix functions
   ```
3. Authenticate ADC using your organization's approved workflow. Confirm the identity has only the read permissions needed to read Firestore metadata and list/read object metadata in the selected bucket.
4. Copy the exact Firebase project ID and Storage bucket name from the Firebase / Google Cloud console. Do not assume the bucket name from the project ID.

## Run locally

From the repository root, substitute the actual target identifiers:

```sh
node functions/scripts/legacy-storage-dry-run.mjs --dry-run --project <firebase-project-id> --bucket <exact-storage-bucket-name>
```

By default the tool scans `documents` and `operationAttachments` and writes a timestamped file beneath `artifacts/`. To change the collection set or output path:

```sh
node functions/scripts/legacy-storage-dry-run.mjs --dry-run --project <firebase-project-id> --bucket <exact-storage-bucket-name> --collections documents,operationAttachments --out artifacts/storage-inventory-review.json
```

The output path must not already exist; this avoids silently overwriting an earlier inventory. The output file is written locally and is not uploaded to Firebase or Supabase.

## Report interpretation

- `matched`: one legacy metadata record resolves to an object in the selected bucket, and declared size / available MD5 metadata agree.
- `needs_review`: a mismatch or incomplete reference requires investigation. Inspect the `issues` array; examples include `OBJECT_NOT_FOUND`, `SIZE_MISMATCH`, `MD5_MISMATCH`, `STORAGE_PATH_URL_MISMATCH`, `DUPLICATE_METADATA_REFERENCE`, `BUCKET_MISMATCH` and `UNSUPPORTED_URL`.
- `unreferencedObjects`: bucket objects with no legacy metadata reference from the selected collections. Do not delete them based only on this classification; they could be referenced elsewhere or retained intentionally.
- `ignoredSupabaseRecords`: records already marked as Supabase-backed, excluded from Firebase legacy reconciliation.
- `retryLog`: failed read attempts and bounded retries; a final read failure stops the inventory instead of producing a falsely complete report.

The tool lists provider-reported MD5 and CRC32C values when available. It does not download file contents or calculate a new byte-level SHA-256 hash. A checksum mismatch can be conclusively resolved only after verifying which checksum algorithm and metadata source are authoritative.

## Review and next gates

1. Retain the original report unchanged and record the project, bucket, time, and operator in the change record.
2. Investigate missing, duplicate, unresolved and unreferenced records before designing a migration manifest.
3. Repeat the dry run after any metadata fixes and compare reports; reruns do not change cloud data.
4. Build the migration phase separately with an explicit manifest, idempotent copy, destination verification, retry/resume log and tested rollback. Never delete a source object in the initial migration phase.
5. Before any real migration, test using a dedicated staging project and synthetic files, then require explicit release approval.
