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

**2026-11-09 source slice:** task relationships to clients, claims, policies, renewals (represented by policies), leads and RFQs are now checked against the parent record's organization on create and when relation fields change. New typed links require a non-empty related ID. Claims must link to a same-organization client and policy whose client relationship matches; claim parent checks run on create and when relation IDs change. Emulator tests cover same-organization success, cross-organization create/update denial, mismatched claim parents, and missing task IDs. Updating unrelated fields preserves compatibility with untouched legacy links. This does not complete the collection-wide relationship/assignment review or change role access.

Client, task and lead assignment are also validated when present: create and changed-assignee writes require an active user profile in the same organization; empty/unset assignment remains supported. Local Emulator regression cases cover valid, inactive, cross-organization, nonexistent and preserved assignees. Assignment fields on other collections remain unreviewed.

RFQ creation and changes to its client/lead links now require the client to exist in the RFQ organization; an optional lead must exist in the same organization and already link to that client. Emulator tests cover missing, nonexistent and cross-organization parents, mismatched leads, and unrelated RFQ updates. Other collection relationships remain subject to the broader reconciliation.

Lead and policy creation and changes to `clientId` now require an existing client in the same organization when a client link is supplied. The field remains optional for unconverted leads and legacy records. Synthetic Emulator coverage checks cross-organization and nonexistent clients, denied relinking, preservation during unrelated updates, and lead conversion that creates the client and links the lead in one batch.

`claimActivities.claimId`, `leadActivities.leadId`, and operation child records' `operationId` are now checked against an existing parent in the same organization on create; activity links are also checked when changed. Emulator tests cover valid links, missing and cross-organization parents, denied activity relinking, and operation event/attachment parent validation.

### 2026-11-09 — Phase 1 source verification and remaining gates

- After explicit staging-only authorization, a read-only Supabase CLI query confirmed the designated test project's `document-storage` is ACTIVE v5, `verify_jwt=false`, bundle SHA `f51a8d90a9e246a356a12542840dd71bee7725f336d606f4479352c5be104d50`. Its public liveness ping returned HTTP 200. One synthetic request with an invalid API key returned HTTP 401 `API_KEY_INVALID` before authentication or storage operations. No object, secret, setting, or function version was changed. Authenticated positive/negative E2E remains blocked pending an approved synthetic Firebase test project and caller identity; no runtime secrets were read.
- Follow-up source reconciliation found `OperationsPage` and `PolicyForm` still using the deprecated full-record `listClients` export. Both now use the role/active-user/tenant-preflight compatibility adapter and typed `ClientBaseSummary` state; focused regression assertions cover these call sites. This reduces sensitive fields retained in page state but does not change the underlying legacy Firestore read or create field-level authorization. No production imports/calls of `listClients` remain in the textual source search; the deprecated export and unresolved mixed-sensitivity writer paths remain for compatibility.
- The manual data-access review found the legacy-document resolver locally allowed Claims but then read the mixed-sensitivity `clients/{id}` root, which Firestore Rules intentionally deny to Claims. It now returns no embedded legacy references for Claims before that read; the existing current-document/claim-scoped paths are unchanged. A regression assertion prevents reintroducing the mismatch.
- A source review found `operation-cleanup` did not apply the current attachment role policy before removing an uploader-owned pending object. The handler now uses the existing operation-attachment write-role check, and a runtime contract regression guards the check. This source-only fix does not establish deployed behavior.
- The heuristic client-data-access audit was rerun locally across 258 source files (100 relevant files; 13 direct client-collection reference files; 10 client-read candidates; 8 write candidates; 6 mixed read/write candidates; 0 in-memory document-relation filter findings). It accessed no cloud/customer data and emitted no field values. Its own report says these are file-level signals, not proven call sites; direct-reference candidates now have a documented source review, but indirect/dynamic call paths remain unproven.
- Source export inspection found three Firebase Functions entry points: `medicalClaudeAnalysis` and `copilotChat` are callable functions, and `ingestINexLead` is the HTTP ingress. No references to these function names or Firebase callable APIs were found under `src`; this is not evidence that external Workers or deployed clients do not call them. They remain build-only; no endpoint was disabled or replaced. `functions/package.json` still targets Node 20 while the current local host is Node 24 and repository web CI targets Node 22; the Functions source build passes, but runtime alignment/deployment remains unresolved.
- Local verification passed: root web build; Functions TypeScript build; `npm run test:rules` against the `demo-insurnex` Emulator; client access audit/review/contracts/projections, sensitive-access resolver and default-deny tests; document gateway source/runtime and storage policy tests; Copilot privacy/context/safe-error tests; cron guards; Spark deploy guard; and iNex ingress/lifecycle source contracts. `npm run lint` exited 0 with existing warnings. Deno was not available locally, so the Deno type-check was not run here.
- Phase 1 is **not accepted as complete**. Remaining gates include exact-head CI and Secrets Scan, complete indirect/dynamic client call-graph and assignment reconciliation across collections, authenticated Document Gateway E2E using synthetic Firebase identities, live iNex receiver and Worker/IAM verification, an approved Spark-compatible endpoint decision for Firebase callable/HTTP consumers, and owner/legal decisions for purpose, consent/basis, retention, export and deletion. No production resource was touched.

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
