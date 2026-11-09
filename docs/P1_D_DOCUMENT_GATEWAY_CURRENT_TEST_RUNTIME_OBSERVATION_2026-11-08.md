# P1-D — Document Gateway Current Test-Runtime Observation

**Observed:** 2026-11-08  
**Scope:** owner-designated Supabase test project only  
**Project ref:** `snzfillstmkoujobknzp`

## Project and function metadata

A read-only Supabase metadata inspection returned:
- Project status: `ACTIVE_HEALTHY`
- Region: `eu-west-1`
- Edge Function: `document-storage`
- Function status: `ACTIVE`
- Deployed version: `5`
- Gateway JWT verification: `false`
- Bundle SHA-256: `f51a8d90a9e246a356a12542840dd71bee7725f336d606f4479352c5be104d50`

No production Supabase project was queried or changed.

## Storage bucket

A read-only query of `storage.buckets` returned one bucket:
- ID: `insurnex-documents`
- Public: `false`
- File-size limit: `10485760` bytes (10 MiB)
- Allowed MIME list: not explicitly set at bucket level; the Edge Function maintains its own request/file MIME allowlist.

No object names, object contents or customer records were inspected. No storage object was uploaded, downloaded, listed, modified or deleted.

## Deployed source comparison

The function metadata returned three deployed source files. Compared with the corresponding current `main` repository files:
- `access-policy.mjs`: exact byte-for-byte match after newline normalization.
- `_shared/api-key-authorization.ts`: exact byte-for-byte match after newline normalization.
- `index.ts`: one intentional deployment-layout import-path difference. The deployed flat upload uses `./_shared/api-key-authorization.ts`; the repository's canonical source under `supabase/functions/document-storage/` uses `../_shared/api-key-authorization.ts`. The files otherwise have the same length apart from that single character difference; no semantic divergence was identified in this comparison.

This is an observation of the test function at version 5, not approval to deploy the current repository source. Any future code update must preserve the correct bundle layout and be re-verified after deployment.

## Supabase advisors

The read-only security and performance advisor queries returned empty lint arrays at observation time. This is not a full penetration test or an authorization acceptance test.

## Liveness limitation

An HTTP request to the public metadata-free `?ping=1` endpoint could not be completed from the current execution environment because DNS resolution for the Supabase project hostname failed. Therefore:
- Function metadata reports the deployed function as `ACTIVE`.
- **I cannot confirm an HTTP liveness response from this environment.**
- No authenticated upload/download/delete or negative authorization flow was run.

## Remaining P1-D acceptance gates

A complete staging sign-off still requires:
1. A successful metadata-free liveness request from a network with DNS access.
2. Synthetic authenticated sign-upload, direct signed upload, metadata reconciliation, list, preview/download, delete and operation-attachment lifecycle tests.
3. Negative tests for invalid/disabled Firebase users, inactive membership, wrong tenant, wrong parent relation, forbidden roles/categories, forged document IDs/paths, unsupported MIME/size and expired URLs.
4. Verification of stored object MIME/size and observed signed URL expiry.
5. A documented rollback/recovery procedure.

All tests must use synthetic records and files. No customer document or production object may be used.

## Safety

Only project/function metadata, source snapshots, bucket metadata and Supabase advisor output were read. No secret values, provider credentials, object contents, customer records, billing changes, project settings, function deployments or storage mutations were performed.
