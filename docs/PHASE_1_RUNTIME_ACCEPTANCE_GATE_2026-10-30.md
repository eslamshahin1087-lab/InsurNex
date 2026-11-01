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

1. Compare deployed `copilot-chat` behavior to canonical source at request, auth, context selection, authorization, provider and response boundaries.
2. Verify that browser-supplied business context is never trusted as authorization evidence.
3. Validate Firebase identity, active organization membership, capability and record relationship before context loading.
4. Confirm sensitive data is excluded from consumer free-tier AI requests and logs.
5. Reproduce gateway JWT configuration only in a dedicated staging project.

**Acceptance:** positive and negative synthetic tests cover expired/invalid tokens, wrong organization, role restrictions, forged IDs, route changes and provider-off/quota-exhausted fallback.

### P1-D — Document-storage runtime parity

1. Compare deployed and canonical implementations before replacement.
2. Require document ID input; resolve bucket/path and metadata server-side.
3. Bind every operation to tenant, actor, resource relationship and category.
4. Enforce file size/type, upload lifecycle, signed URL TTL and deletion semantics.
5. Exercise upload, list, preview/download, delete, legacy reference and cross-tenant denial.

**Acceptance:** staging evidence proves correct object binding and denial cases; no reusable signed URL or arbitrary storage path is persisted or accepted.

### P1-E — Client data-access compatibility

**Initial source adapter candidate:** documented in `docs/P1_E_CLIENT_DATA_ACCESS_ADAPTER_2026-11-01.md` on the current feature branch. It adds an allowlisted base summary and guarded Client 360 compatibility read; it does not change Firestore Rules or claim field-level redaction.

1. Inventory all readers and writers of legacy mixed-sensitivity client records.
2. Define explicit typed projections for base contact, identity/KYC, family, medical, finance, claim-sensitive, document metadata and AI findings.
3. Introduce read-only adapters first, using synthetic fixtures.
4. Preserve legacy writes until the destination authorization contract is implemented and reviewed.
5. Keep proposed collections default-denied.

**Acceptance:** role-based projections return only permitted fields, existing pages keep required safe behavior, and no customer records are migrated.

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
