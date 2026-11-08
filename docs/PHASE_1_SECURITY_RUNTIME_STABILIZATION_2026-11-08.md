# Phase 1 — Security & Runtime Stabilization

**Started:** 2026-11-08  
**Base:** `main` at `13ea56f693edeb3047cf90917ab88fa2723f15c5`  
**Working branch:** `feat/phase1-security-runtime-stabilization-20261108`  
**Status:** in progress — source audit and implementation sequencing

## 1. Safety boundary

- Work only on the Phase 1 feature branch and submit reviewed pull requests.
- Do not merge to `main`, deploy, change Firebase/Supabase project settings, edit secrets, alter billing, or access production customer records as part of this phase.
- Use synthetic fixtures and Firebase Emulator project ID `demo-insurnex` for local/CI tests.
- Keep Firebase Spark and zero-paid-AI constraints. Do not introduce a paid runtime or provider dependency.
- Do not remove existing features or compatibility paths without a separately reviewed migration and rollback plan.

## 2. Verified starting point

- Phase 0 PR #136 is merged. Its PR-specific CI and Secrets Scan both completed successfully.
- The existing P1-E compatibility adapter is already merged in PR #96. The Clients index uses an allowlisted summary projection; Client 360 remains restricted to active Owner/Admin/Broker users because the legacy `clients` document contains mixed-sensitivity fields.
- Proposed collections `clientSensitiveProfiles`, `clientMedicalProfiles`, `claimSensitiveDetails`, `aiFindings`, and `auditLogs` remain default-denied. Existing Emulator regression tests enforce this boundary.
- The document-storage Supabase Edge Function and its source-level runtime contract tests already exist. Source tests do not prove that the deployed Edge Function, secrets, private bucket, CORS, or storage configuration match the repository.
- Firebase Functions source remains in the repository, but the selected Firebase Spark plan is not a supported deployment target for Cloud Functions. Keep those endpoints build-only until a no-cost, approved replacement path is proven.

## 3. Phase 1 workstreams

### P1-A — Client data-access inventory and compatibility boundary

1. Run and review the static client-data-access audit across `src`, `functions/src`, and `supabase/functions`.
2. Classify every client reader/writer, including legacy exports, nested individual/corporate data, risk/health, documents, notes, and AI-derived fields.
3. Separate verified call sites from heuristic signals; no automated field migration or broad role expansion.
4. Preserve the existing Owner/Admin/Broker restriction on legacy mixed-sensitivity client records.
5. Add focused regression tests for any call-site migration before changing application behavior.

### P1-B — Firestore authorization and tenant relationship checks

1. Map collection/action/role/tenant/relationship/assignment checks to the current Firestore Rules.
2. Identify mismatches between UI preflight, trusted service checks, and Rules.
3. Add Emulator tests with synthetic users and records for both allowed and denied paths.
4. Keep proposed sensitive collections default-denied. Any future grant requires a separate reviewed Rules change with positive and negative tests.
5. Do not perform schema migration or bulk backfill in this workstream.

### P1-C — Document Gateway security and runtime readiness

1. Review the Edge Function, shared API-key validation, storage provider, and policy tests as one trust boundary.
2. Verify request size, MIME/size constraints, path-to-metadata binding, caller-token Firestore reads, tenant/client relationship checks, signed URL TTL, and fail-closed behavior.
3. Add tests only for concrete uncovered cases discovered during review.
4. Treat deployed function version, Supabase secrets, bucket privacy, CORS, and upload/download/delete behavior as **unverified** until an approved staging environment is available.
5. No production file migration, object deletion, or storage deployment is included.

### P1-D — Runtime and free-tier compatibility

1. Inventory every Firebase Functions export and its frontend/backend callers.
2. Resolve the current Node runtime split without silently changing package engines.
3. Identify which existing flows have an already-implemented Supabase Edge Function equivalent and which do not.
4. Do not replace endpoints or disable features until behavior, authorization, error handling, quotas, and rollback are covered by tests.
5. Do not link billing or deploy Firebase Functions under the Spark constraint.

## 4. Acceptance gates

Phase 1 is not complete until:
- all changed code passes the repository CI and Secrets Scan on the exact PR head;
- static audit findings have been reviewed and classified, not merely generated;
- Firestore Emulator positive/negative tests cover each changed authorization path;
- document gateway source tests pass and staging-only unknowns are explicitly listed;
- no sensitive collection is granted access without an independently reviewed security PR;
- no production deployment, customer-data migration, billing change, or secret change has occurred.

## 5. First implementation order

1. Complete P1-A call-site inventory and classify findings.
2. Review P1-B Rules against the inventory; close concrete authorization gaps with synthetic Emulator tests.
3. Review P1-C gateway for specific testable gaps.
4. Complete P1-D runtime caller map before any endpoint replacement.

This document is a work plan and evidence register. It does not authorize production access, deployment, data migration, billing changes, or changes to live security configuration.
