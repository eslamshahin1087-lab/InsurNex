# P1-A — Runtime Provenance and Drift Control

**Date:** 2026-11-01  
**Branch:** `feat/phase1-runtime-provenance-drift-control-20261101`  
**Base:** `main` after merged PR #96 and PR #97  
**Status:** repository provenance candidate; live provider configuration revision remains unavailable.

## 1. Scope and evidence boundary

The archived source set under `supabase/deployed-snapshots/2026-10-30` is a read-only capture of five deployed Supabase Edge Functions. It is historical evidence, not a deployable source tree and not proof of current live provider state.

This work adds reproducible repository evidence. It does not query, deploy, invoke, pause or reconfigure Supabase functions and does not read or change provider secrets.

## 2. Manifest v2

The existing manifest is upgraded from schema version 1 to version 2 without changing the captured source bytes or capture timestamp.

The manifest now records, per function:
- Capture-time observation timestamp.
- Deployed version, status, bundle SHA-256 and gateway JWT setting.
- The source of the gateway JWT observation (deployed function metadata).
- An explicit `configurationRevision: null` with reason: the read-only metadata capture did not return a provider configuration revision.
- Canonical repository source path and Git blob SHA at the compared `main` commit, where that path exists.
- A comparison classification of `match`, `mismatch` or `not-present-in-main`.

The current main comparison is anchored to commit `ca08aaeee376855d839111d1cf711506452bb6c7` and dated 2026-11-01. It is a repository source comparison only; it does not re-confirm any live deployment or provider configuration.

## 3. Current drift classification

| Function | Deployed version in archive | Current repository comparison | Interpretation |
|---|---:|---|---|
| `copilot-chat` | 37 | Mismatch | Archived deployed source differs from current `main` canonical source |
| `document-storage` | 22 | Mismatch | Archived deployed source differs from current `main` canonical source |
| `securepath-webhook` | 20 | Not present in main | Archived source exists, but there is no corresponding canonical function source path in compared `main` |
| `cron-policy-check` | 7 | Mismatch | Archived deployed source differs from the current hardened candidate in `main` |
| `cron-document-check` | 7 | Mismatch | Archived deployed source differs from the current hardened candidate in `main` |

A mismatch is not a recommendation to deploy the repository source. It is a drift signal requiring P1-C/P1-D or the relevant endpoint's own review and staging acceptance.

## 4. Reproducible provenance report

New commands:
- `npm run audit:runtime-provenance` — validates the manifest against committed bytes and prints a deterministic JSON/text report.
- `npm run test:runtime-provenance` — runs the report twice and verifies byte-for-byte identical output and the expected archive/drift classifications.

The generated report calculates both:
- Git blob SHA-1 for each archived file, matching Git object identity.
- SHA-256 over the raw committed file bytes.

It also verifies:
- File path confinement to the dated archive and rejects traversal/absolute paths.
- File size/character/line counts against the manifest.
- Secret-screen patterns for private keys, Google API keys, Supabase secret keys and JWT-like tokens.
- Canonical source hashes against the explicitly recorded `main` baseline.
- The archive-only / no-deployment invariant.

CI now runs the report and reproducibility tests immediately after the deployed-snapshot integrity check.

## 5. Acceptance status

**Completed in this repository candidate:**
- Manifest records function identity/version/status/bundle hash/gateway JWT setting.
- Per-function observation timestamp and explicit configuration-revision limitation are recorded.
- Canonical source provenance is pinned to a specific repository commit.
- Drift is deterministically classified for all five archived functions.
- Committed snapshot files are checked by Git blob SHA-1 and SHA-256.
- Secret-screen, archive-path, determinism and no-deployment regression tests are added to CI.

**Still blocked / not claimed complete:**
- The original read-only capture did not return a provider configuration revision; it remains `null`.
- No fresh Supabase read-only metadata query was run in this change.
- The canonical comparison does not prove the currently deployed function still has the archived version.
- Live gateway settings, scheduler headers, secret names, project health and deployed source parity must be re-observed by an authorized operator before staging.
- No staging deployment or function invocation is authorized by this PR.

## 6. Safety

- Snapshot files remain unchanged and archive-only.
- No deploy command is exposed by the provenance script.
- No service-role key, cron secret, Firebase credential or customer data is read or modified.
- No live Edge Function, scheduler, bucket, database, Firestore Rules, index, billing plan or production route is changed.

## 7. Next work packages

1. P1-B operational confirmation: independently verify that the configured scheduler can send `x-cron-secret`; do not rotate the secret or deploy until the operator supplies approval and a verified path.
2. P1-C Copilot runtime parity: reconcile deployed v37 behavior with current trusted-context/auth/provider/privacy source using synthetic positive and negative fixtures.
3. P1-D document gateway runtime parity: reconcile deployed v22 with canonical metadata-bound operations and complete a separate staging upload/download/delete/tenant-denial acceptance.
4. P1-E data separation: continue inventorying every legacy reader/writer; do not grant access to proposed sensitive collections until the Rules and trusted writer contracts pass Emulator tests.
