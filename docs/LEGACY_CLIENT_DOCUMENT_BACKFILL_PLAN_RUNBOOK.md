# Legacy Client Document Backfill Plan — Read-Only Runbook

## Purpose

Some older client profiles store file references in `clients.documents[]` instead of dedicated records in the top-level `documents` collection. The metadata-only inventory found three such Supabase Storage signed URLs. A previous read-only check matched each of those three object-path hashes to exactly one row in the private `insurnex-documents` bucket and found matching declared size/MIME metadata. File bytes were not downloaded or cryptographically verified.

This planner creates a deterministic local manifest of proposed first-class `documents` records. It does not perform a backfill or access either storage provider. It is designed for review and planning before any separately approved write operation.

## Safety model

- `--dry-run` is required and the script has no Firestore write code.
- The planner reads only Firestore `clients` and `documents` collections using Application Default Credentials (ADC).
- It does not access Firebase Storage or Supabase Storage APIs; object existence, downloadability, byte checksums, and content are not verified.
- Signed Supabase URLs are parsed into bucket/object paths in memory. URL query parameters (including access tokens) are never written to the manifest.
- The manifest includes organization IDs, client IDs, embedded document IDs, object paths, sizes, MIME types and proposed metadata. Keep it local and treat it as sensitive.
- No object upload, copy, deletion, Firestore write, metadata rewrite, Edge Function deployment or frontend deployment is performed.

## Prerequisites

1. Use the approved Cloud Shell / local ADC identity configured for the intended Firebase project.
2. Grant the identity read-only Firestore access to the `clients` and `documents` collections.
3. Use the exact Supabase project hostname and bucket name supplied by the project configuration; do not infer either from an old signed URL or project nickname.
4. Do not run `npm audit fix --force` or approve blocked package install scripts as part of this workflow.

## Command

From the repository root:

```sh
node functions/scripts/legacy-client-document-backfill-plan.mjs \
  --dry-run \
  --project insurnex-8a9df \
  --supabase-host piloiwtdbtmfiyqxfbae.supabase.co \
  --bucket insurnex-documents
```

The hostname and bucket above reflect the current audited project configuration as observed on 2026-10-28. Confirm they remain correct before future use. The tool writes a timestamped JSON manifest to `artifacts/` by default. It refuses to overwrite an existing report. Use `--help` for options.

The scan reads each client document and each first-class document record. Read counts can grow with the size of both collections; review expected read cost before running against a larger production dataset.

## Manifest statuses

- `candidate`: a reference resolves to the expected private Supabase bucket and tenant/client path, and no first-class metadata mapping was found. The manifest contains a deterministic proposed document ID and proposed metadata. This is not approval to write it.
- `already_mapped`: exactly one first-class `documents` row already maps the same bucket/path to the same organization/client, or the deterministic target ID already exists with the exact expected ownership/path. Do not create another record.
- `needs_review`: invalid or conflicting identifiers, unsupported host/bucket/path, duplicate source references, duplicate existing mappings, existing path ownership conflict, or a legacy claim path whose role policy must be reviewed before first-class backfill.
- `FIREBASE_REFERENCE_REQUIRES_SEPARATE_INVENTORY`: a reference explicitly declared Firebase-backed is not converted to a Supabase path by this planner. It must go through the Firebase inventory/approved migration flow separately.

The target document ID is deterministic for the project, organization, client, embedded document ID, bucket and object path. Re-running the planner should reproduce it for unchanged metadata, supporting idempotent future work. A deterministic ID does not replace duplicate/path/tenant checks.

## What the planner does not prove

- It does not query `storage.objects`, call `Storage.info`, or access the object itself.
- A valid signed URL shape does not prove the URL is still valid or the file still exists.
- Declared file size or MIME type in Firestore is not compared with current Storage metadata by this tool.
- `candidate` only means metadata is structurally eligible for review. It does not mean the candidate is safe to write or that downloads will succeed.
- The source `clients.documents[]` arrays remain unchanged. Signed URL fields are not copied into the proposed record; proposed `downloadUrl` is blank.

## Required review before any future backfill

1. Independently verify every candidate object exists in the configured private bucket and compare actual size/MIME metadata.
2. Review every `needs_review` row; do not auto-resolve conflicting references or duplicate paths.
3. Confirm role behavior, especially claim-category files whose old path does not contain the new metadata document ID. The current policy intentionally has stricter checks for unversioned client paths.
4. Decide how the application will avoid duplicate display while both an embedded legacy reference and a new first-class record exist.
5. Confirm how source timestamps, uploader identity, category/type, verification state, and notes should map into the first-class schema. Source timestamps appear as provenance in the manifest and are not silently copied into a non-Timestamp field.
6. Produce a second reviewed manifest after object verification and write a separate, idempotent migration utility with retry/resume logging, destination verification, duplicate-safe writes and a tested rollback.
7. Keep original embedded records and source objects until successful reads and staging tests prove the new record works. Do not delete originals in the first backfill phase.
8. Require explicit production approval before applying any live Firestore backfill or migrating/deleting files.

## Regression tests

Run from the repository root:

```sh
npm run test:legacy-client-backfill-plan
npm run test:storage-inventory
npm run test:storage-gateway
npm run lint
npm run build
npm run build --prefix functions
```
