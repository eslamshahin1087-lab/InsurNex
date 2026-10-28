# Legacy Firebase Storage Inventory — Dry-Run Runbook

## Purpose

The tool supports two read-only modes. Full mode compares Firestore metadata with object listings from one explicitly selected Firebase Storage bucket. Metadata-only mode audits references in Firestore without contacting Cloud Storage; it is useful while a Spark-plan project cannot access Storage, but cannot verify object existence, identify unreferenced objects, or compare metadata with actual object attributes. Neither mode is a migration utility or modifies cloud data.

## Safety boundaries

- Both modes require `--dry-run` and an explicit `--project`.
- Full mode also requires `--bucket` with the exact bucket name.
- Metadata-only mode requires `--metadata-only` and must not include `--bucket`.
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
3. Authenticate ADC using your organization's approved workflow. For metadata-only mode, grant only the read permissions needed for the selected Firestore collections. For full mode, the identity also needs permission to list/read object metadata in the selected bucket.
4. If the project is on the Spark plan and the Storage screen says an upgrade is required, do not guess a bucket name. Run metadata-only mode unless a billing-plan change is explicitly approved. Firebase documents that Storage buckets and their data are inaccessible while the project remains on Spark.

## Run locally

From the repository root, metadata-only mode works without a Storage bucket name:

```sh
node functions/scripts/legacy-storage-dry-run.mjs --dry-run --project <firebase-project-id> --metadata-only
```

This reads only Firestore metadata in the default `documents` and `operationAttachments` collections and writes a timestamped local report under `artifacts/`. It does not call Cloud Storage APIs and cannot confirm whether a referenced object exists.

Full reconciliation requires an accessible Storage bucket and is a separate command:

```sh
node functions/scripts/legacy-storage-dry-run.mjs --dry-run --project <firebase-project-id> --bucket <exact-storage-bucket-name>
```

To change the collection set or output path:

```sh
node functions/scripts/legacy-storage-dry-run.mjs --dry-run --project <firebase-project-id> --bucket <exact-storage-bucket-name> --collections documents,operationAttachments --out artifacts/storage-inventory-review.json
```

The output path must not already exist; this avoids silently overwriting an earlier inventory. The output file is written locally and is not uploaded to Firebase or Supabase. Metadata-only reports label each row as `metadata_consistent` only when the references are internally consistent; this is not a claim that the object exists. In metadata-only mode, `DUPLICATE_METADATA_REFERENCE`, path/URL mismatch, organization/path mismatch, unsupported URL, or unresolved-reference results still require review.

## Report interpretation

- `matched`: one legacy metadata record resolves to an object in the selected bucket, and declared size / available MD5 metadata agree.
- `needs_review`: a mismatch or incomplete reference requires investigation. Inspect the `issues` array; examples include `OBJECT_NOT_FOUND`, `SIZE_MISMATCH`, `MD5_MISMATCH`, `STORAGE_PATH_URL_MISMATCH`, `DUPLICATE_METADATA_REFERENCE`, `BUCKET_MISMATCH` and `UNSUPPORTED_URL`.
- `unreferencedObjects` (full mode only): bucket objects with no legacy metadata reference from the selected collections. Do not delete them based only on this classification; they could be referenced elsewhere or retained intentionally.
- Metadata-only reports do not contain an object listing, do not label any object as missing, and do not identify unreferenced objects.
- `ignoredSupabaseRecords`: records already marked as Supabase-backed, excluded from Firebase legacy reconciliation.
- `retryLog`: failed read attempts and bounded retries; a final read failure stops the inventory instead of producing a falsely complete report.

The tool lists provider-reported MD5 and CRC32C values when available. It does not download file contents or calculate a new byte-level SHA-256 hash. A checksum mismatch can be conclusively resolved only after verifying which checksum algorithm and metadata source are authoritative.

## Review and next gates

1. Retain the original report unchanged and record the project, bucket, time, and operator in the change record.
2. Investigate missing, duplicate, unresolved and unreferenced records before designing a migration manifest.
3. Repeat the dry run after any metadata fixes and compare reports; reruns do not change cloud data.
4. Build the migration phase separately with an explicit manifest, idempotent copy, destination verification, retry/resume log and tested rollback. Never delete a source object in the initial migration phase.
5. Before any real migration, test using a dedicated staging project and synthetic files, then require explicit release approval.
