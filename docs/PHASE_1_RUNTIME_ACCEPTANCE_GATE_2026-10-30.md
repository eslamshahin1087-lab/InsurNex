# InsurNex — Phase 1 Runtime Acceptance Gate

**Prepared:** 2026-10-30  
**Branch:** `security/phase1-runtime-acceptance-gates-20261030`  
**Base:** `82aecdbe33e3f28c89e28a0bd25c7564687285ff`  
**Status:** planning and test contract only; not a deployment authorization.

## Purpose

Turn the Phase 1 runtime compatibility findings into a verifiable, operator-led acceptance sequence. The application, current routes, PWA, themes, Firestore Rules, production data, secrets, billing and deployed services are out of scope for this change.

## Verified repository facts

- GitHub `main` currently passes CI and Secrets Scan at `82aecdbe33e3f28c89e28a0bd25c7564687285ff`.
- The deployed Supabase Edge Function source recovery and cron hardening exist on a separate branch. That branch has CI and Secrets Scan success, but is five commits behind current `main`; it is intentionally not used as this branch's base.
- The Phase 1 report records five active Edge Functions with source/config parity gaps: `copilot-chat`, `document-storage`, `securepath-webhook`, `cron-policy-check`, and `cron-document-check`.
- Candidate cron implementations are source-only. They accept `x-cron-secret` and must not be deployed until the live scheduler contract is independently verified.
- The Firebase Spark guard is already in the current baseline. No billing change is authorized.
- Client sensitive-data separation remains a design/adapter task. Proposed sensitive collections must remain default-denied.

## Acceptance work packages

### P1-A — Runtime provenance and drift control

**Implementation candidate:** see `docs/P1_A_RUNTIME_PROVENANCE_2026-11-01.md` and branch `feat/phase1-runtime-provenance-drift-control-20261101`. Manifest v2 records per-function observation time, gateway JWT observation source, explicit unavailable configuration revision, and canonical source comparison anchored to main commit `ca08aaeee376855d839111d1cf711506452bb6c7`. Deterministic Git blob/SHA-256 reporting, secret-screening and archive-only regression tests are added to CI.

**Remaining acceptance limitation:** the captured provider metadata did not return a configuration revision, and no fresh live metadata query or staging operation is part of this PR. P1-A repository provenance is implemented as a candidate; provider configuration provenance remains pending authorized read-only observation.

1. Preserve deployed source archives as historical evidence only.
2. Record function slug, deployed version, deployment bundle hash, source-file hashes, gateway JWT setting, configuration revision and observation timestamp.
3. Distinguish canonical source, deployed snapshot and candidate replacement in every report.
4. Fail checks when required snapshot files are absent or hashes do not match.
5. Never execute deployment commands from snapshot paths.

**Acceptance:** the manifest is complete, deterministic, secret-screened and reproducible from committed bytes.

### P1-B — Cron authorization and idempotency

1. Accept only the dedicated `x-cron-secret`; reject missing, blank, wrong and service-role bearer credentials.
2. Confirm the scheduler can send the dedicated header before any rollout.
3. Revalidate tenant/resource state at execution time.
4. Use deterministic notification identifiers and transactionally prevent duplicate reminders.
5. Test date boundaries, invalid dates, duplicate invocations and concurrent invocations with synthetic fixtures.

**Acceptance:** tests demonstrate fail-closed authorization and exactly-once notification creation under retry/concurrency semantics. No live schedule or secret is changed in this repository phase.

### P1-C — Copilot runtime parity

**Source implementation candidate:** `docs/P1_C_COPILOT_RUNTIME_PARITY_2026-11-01.md` on branch `feat/p1c-copilot-runtime-parity-20261101`. It adds explicit disabled-account rejection, bounded Firebase token verification, 15-second provider timeouts, a deterministic bilingual local fallback and Deno tests for provider-off, quota/transport failure and disabled accounts. No provider secret/configuration or deployed function is changed.

1. Compare deployed `copilot-chat` behavior to canonical source at request, auth, context selection, authorization, provider and response boundaries.
2. Verify that browser-supplied business context is never trusted as authorization evidence.
3. Validate Firebase identity, active organization membership, capability and record relationship before context loading.
4. Confirm sensitive data is excluded from consumer free-tier AI requests and logs.
5. Reproduce gateway JWT configuration only in a dedicated staging project.

**Acceptance:** positive and negative synthetic tests cover expired/invalid/disabled tokens, wrong organization, role restrictions, forged IDs, route changes and provider-off/quota-exhausted fallback. Staging parity and provider privacy/cost approval remain separate gates.

### P1-D — Document-storage runtime parity

**Source implementation candidate:** `docs/P1_D_DOCUMENT_GATEWAY_RUNTIME_PARITY_2026-11-01.md` on branch `feat/p1d-document-gateway-runtime-parity-20261101`. The candidate makes `verify_jwt=false` explicit and validates the trusted Supabase API-key allowlist in the handler, retains Firebase-token Firestore authorization reads, adds 10-second Firebase/Firestore timeouts, caps control requests at 64 KiB and Firebase tokens at 16 KiB, and limits new download URLs to 15 minutes. Source and policy regression tests are added to CI.

1. Compare deployed and canonical implementations before replacement.
2. Require document ID input; resolve bucket/path and metadata server-side.
3. Bind every operation to tenant, actor, resource relationship and category.
4. Enforce file size/type, upload lifecycle, signed URL TTL and deletion semantics.
5. Exercise upload, list, preview/download, delete, legacy reference and cross-tenant denial.

**Still pending:** the dated snapshot records deployed v22, but no fresh read-only live metadata check is part of this PR. Staging must verify actual uploaded object MIME/size against metadata after upload, real URL expiry, role/tenant denials, legacy and operation lifecycle, and rollback before a separate deployment proposal.

**Acceptance:** staging evidence proves correct object binding and denial cases; no reusable signed URL or arbitrary storage path is persisted or accepted.

### P1-E — Client data-access compatibility

**Initial adapter merged (PR #96):** `docs/P1_E_CLIENT_DATA_ACCESS_ADAPTER_2026-11-01.md` records the allowlisted Clients base summary and guarded Client 360 compatibility read. It does not change Firestore Rules or create field-level security.

**Call-site inventory merged (PR #101):** `docs/P1_E_CLIENT_DATA_ACCESS_CALLSITE_INVENTORY_2026-11-01.md` extends the static audit with file-level read/write signals and line-number identifiers, and adds a default-deny guard for proposed sensitive collections.

**Typed contracts merged (PR #102):** `docs/P1_E_TYPED_CLIENT_DATA_CONTRACTS_2026-11-01.md` provides versioned types and a pure safe metadata projector, without collection access.

**Current sensitive-access policy candidate:** `docs/P1_E_SENSITIVE_ACCESS_GRANT_POLICY_2026-11-01.md` on branch `feat/p1e-sensitive-access-policy-20261101` adds a pure deny-by-default evaluator requiring trusted capability context, verified relationship, independent approval, purpose, pre-recorded audit evidence and a grant lifetime of at most 15 minutes. It does not open collection rules or create a data reader.

1. Review every production read/write call-site from the static inventory; the report is heuristic and not AST/data-flow proof.
2. Review the merged typed contracts against the real Firestore source schema and obtain data-owner approval for each field.
3. Approve purpose, legal basis, retention, export/delete handling and the exact role-to-capability matrix.
4. Implement an append-only trusted audit sink and a trusted grant/capability resolver.
5. Define collection-specific Rules/trusted reader endpoints only after the preceding approvals and audit path are tested.
6. Add read-only adapters one class at a time using synthetic fixtures; preserve legacy writes until each destination authorization contract is reviewed.
7. Keep proposed collections default-denied.

**Acceptance:** role-based projections return only permitted fields, existing pages keep required safe behavior, every known read/write path is reviewed, Emulator positive/negative tests cover each approved role and no customer records are migrated.

## Required evidence before any staging deployment

- Exact source SHA and CI/Secrets Scan URLs.
- Deployed function metadata and source parity comparison.
- Staging project identity, runtime configuration and rollback plan.
- Authenticated positive and negative test results for each role and tenant.
- Secret/header contract verification without exposing secret values.
- File/document tests using synthetic files only.
- AI provider terms, privacy and cost approval; otherwise the sensitive AI workflow remains disabled.
- Separate owner approval for the specific staging operation.

## Explicit non-goals

- No production deployment or staging deployment.
- No Firebase/Supabase secret read, write or rotation.
- No Firebase billing-plan change.
- No live Firestore Rules/index change.
- No customer-data inventory, export, migration, deletion or rewrite.
- No change to React components, routes, PWA, UI identity or application workflows.

## Recommended next execution order

1. P1-A snapshot provenance.
2. P1-B cron tests and scheduler contract confirmation.
3. P1-C Copilot parity tests.
4. P1-D document gateway staging acceptance.
5. P1-E client data compatibility adapter.
6. Only after all relevant evidence exists, submit a separate staging-deployment proposal.
