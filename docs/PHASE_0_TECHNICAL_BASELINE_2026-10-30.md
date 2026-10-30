# InsurNex Phase 0 — Technical Baseline & Repository Audit

**Audit date:** 2026-10-30  
**Audited repository:** `eslamshahin1087-lab/InsurNex`  
**Audited remote ref:** `main` at `5c9c924fdf2033215f94c5c1b64d71ede7ff70ee`  
**Latest verified checks on this ref:** [CI #40878308477](https://github.com/eslamshahin1087-lab/InsurNex/actions/runs/40878308477) — success; [Secrets Scan #40878308224](https://github.com/eslamshahin1087-lab/InsurNex/actions/runs/40878308224) — success.  
**Change scope for Phase 0:** documentation and planning only. No application source, theme, assets, Firestore Rules, indexes, secrets, infrastructure, customer data or deployment behavior is changed by this baseline PR.

## 1. Audit scope and limits

This baseline is based on the GitHub remote source tree, repository configuration, merged/open pull-request metadata, and GitHub Actions results available on 2026-10-30.

It does **not** claim that:
- the local Cloud Shell working tree has been verified to match the audited remote SHA;
- the active Firebase billing plan, quotas, deployed Functions, live Firestore Rules, live indexes, or Hosting release were inspected in the cloud console during this audit;
- the Supabase Edge Functions currently deployed to the configured project match the source tree;
- the document bucket is fully backed up, recoverable, or accepted by a production-like staging test;
- every module has passed end-to-end testing with real users and production-like records.

The Cloud Shell screenshot previously supplied showed Node.js v24.22.1. The repository README and CI use Node.js 22 for the web project; `functions/package.json` declares Node.js 20. Use the CI runtime as the reproducible baseline for root-project checks and resolve the Functions runtime separately before choosing a deploy target. No local build was run as part of this remote-only Phase 0 audit.

## 2. Verified repository baseline

| Area | Verified current source | Audit conclusion |
|---|---|---|
| Web application | React 19, TypeScript, Vite, React Router; root build is `tsc -b && vite build` | Existing application is the product foundation. Preserve its routes, feature modules and current user workflows. |
| PWA / visual identity | PWA smoke tests and a visual identity/responsive-layout regression test are in CI | Existing RTL and visual identity are protected by tests; Phase 0 does not modify them. |
| Identity | Firebase Authentication | Remains the identity provider. |
| Core business data | Cloud Firestore with tenant-owned top-level records and `organizationId` conventions | Existing collection layout must be preserved while call sites, rules and relationships are audited. |
| Authorization | Firestore Rules plus route/feature checks and trusted service code | UI guards are not a security boundary. Role + tenant + relationship + assignment checks must be verified per collection/action. |
| Private documents | Frontend document service uses the Supabase storage provider; a Supabase `document-storage` Edge Function source exists; legacy document references remain supported | Source exists; deployed endpoint parity and staging acceptance are not verified. |
| Edge Copilot | `supabase/functions/copilot-chat` source; server-side Firebase token and organization-context checks; Gemini/Groq provider configuration | The source includes multiple providers. Zero-cost behavior and sensitive-data handling need explicit release policy and live configuration verification. |
| Firebase Functions | `functions/src/index.ts` exports medical Claude analysis, Copilot export and iNex lead ingestion; `firebase.json` declares a Functions source | Code can be built in CI, but a successful build does not mean it can be deployed under Firebase Spark. |
| Tests | Root CI covers access, entitlements, PWA, document storage policy, Copilot safeguards, sensitive-data tooling, lint/build, Functions build, Deno checks and Firestore Emulator tests | Stronger than a compile-only pipeline; feature-specific end-to-end and staging acceptance remain outstanding. |
| Documentation | Master Architecture, Firestore schema proposal, AI contracts, RBAC matrix, storage runbooks and Phase 3 acceptance checklist exist | Documents need status synchronization to distinguish merged code, local operator checks, deployed configuration and target design. |

## 3. Merged work now present in main

The following is the current status of the relevant recent work. “Merged” refers to source changes only; it does not imply a production deployment.

| PR | Merged capability | What remains |
|---|---|---|
| #48 | Organization roles and invitation/RBAC baseline | Full per-collection capability and relationship enforcement remains an acceptance task. |
| #49–#51 | Document gateway hardening and general/client/operation-attachment source migration | Deploy the matching Edge Function only to an approved staging environment and complete upload/download/delete/denial acceptance. |
| #52–#57 | Read-only storage and legacy-reference inventory tooling | Inventory results do not establish that all object bytes are available or backed up. |
| #58 | Secure compatibility access for legacy embedded client documents | Staging validation and endpoint deployment remain separate. |
| #60 | Privacy-safe client-field inventory tool | An authorized local read-only inventory was run against 14 client records; the generated file remains local. |
| #61 | Master Architecture, Firestore Schema v2 proposal, AI module contracts and Phase 3 acceptance documentation | These are design contracts, not a live schema migration or proof every AI module is implemented. |
| #74–#77 | Copilot route/context isolation, message ownership checks, safe errors and browser-build test isolation | Keep regression coverage and verify deployed Edge Function parity separately. |
| #78 | Phase 3 security gates and roadmap documentation | The roadmap must be kept current as work is merged. |
| #79–#80 | Proposal-only client-sensitive-data plan and health/family classification correction | No records have been migrated. |
| #81 | Proposed sensitive-data RBAC matrix and local plan reviewer | Runtime authorization for proposed collections remains default-denied. |
| #82 | Emulator tests asserting proposed sensitive collections remain default-denied | Tests protect the current deny boundary; they do not implement future grants. |
| #83 | Static client-data-access audit and client-document query scoping by organization + client relationship | Query scoping reduces unnecessary retrieval but does not replace Firestore Rules. |

## 4. Open pull-request inventory

These PRs were open when the audit was captured. They are deliberately not merged or edited by Phase 0.

| PR | Current title | Phase 0 disposition |
|---|---|---|
| #46 | Free-tier architecture audit and implementation plan (Draft) | Older documentation branch. Fold useful findings into the current baseline/backlog; do not merge as an unreviewed duplicate. |
| #40 | Architecture and Firestore schema baseline (Draft) | Older documentation branch superseded by merged PR #61 and current docs. Compare for unique content, then close or archive after owner review; do not merge wholesale. |
| #36 | Restore tenant notification access safely | Rebase/review against current Rules and NotificationsPage; do not assume the old patch is still required or safe. |
| #31 | Prevent blank lead details for unknown stages | Review against current Lead service, add focused regression tests and rerun CI on a current branch before merge. |

No conclusion about GitHub branch-protection settings is made here; those repository settings were not inspected.

## 5. Phase 0 findings and blockers

### P0-01 — Firebase Spark / backend deployment compatibility

Current source includes Firebase Functions v2 endpoints and `firebase.json` still declares a Functions source. Firebase's current pricing documentation states that Spark cannot deploy new or existing Cloud Functions; switching to Blaze requires linking billing and can introduce pay-as-you-go charges. Firebase Cloud Storage is also unavailable to Spark projects from 2026-02-03, including existing buckets. References:
- [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- [Cloud Storage for Firebase billing requirements](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024)

**Decision for the current product constraint:** keep Firebase Spark as the selected baseline. Do not link billing or move to Blaze without a separate explicit owner decision. Inventory each Firebase Function caller and define a deployable alternative before removing or replacing any source code. The existing Supabase Edge Function gateway is a candidate, not yet proof of deployed parity.

### P0-02 — iNex endpoint export / deployment mismatch

Verified source facts:
- `functions/src/index.ts` exports `ingestINexLead`.
- `functions/package.json` deploy script names `ingestSecurePathLead`.
- The receiver email constant in source is `securepath@nex.com`.

The older Draft free-tier audit records a proposed receiving identity of `leads@insurnex.com` and a UID, but a draft branch is not proof that this identity is still approved or active in the target Firebase project.

**Required action:** verify the approved receiver UID, email, active profile and organization in the intended project, then align endpoint export, deployment/configuration, source-app URL and credential contract in one separately tested PR. Do not change credentials, receiver identity or production routing during Phase 0.

### P0-03 — AI provider and data-handling policy

Current source includes Anthropic usage in the Firebase medical-analysis Function and Gemini/Groq provider configuration in the Supabase Copilot Edge Function. This does not satisfy a “zero paid AI spend” guarantee by source inspection alone.

The current Gemini API Unpaid Services terms explicitly say submitted prompts, files and responses may be used to improve Google products and that users must not submit sensitive, confidential or personal information. Reference: [Gemini API Additional Terms — Unpaid Services](https://ai.google.dev/gemini-api/terms).

**Required action:** default sensitive-data AI paths to disabled until the provider, privacy terms, lawful basis, retention, region, quotas and backend authorization have been reviewed. Preserve deterministic analytics and no-AI fallbacks. Do not send identifiable client, medical, policy or claim content to consumer free-tier AI.

### P0-04 — Storage code is merged; runtime acceptance is not

The current frontend document service imports the Supabase storage provider and requests temporary access through the gateway; old legacy references remain part of compatibility behavior. The Supabase Edge Function source uses server-side storage credentials and verifies Firebase identity/context in code.

Supabase currently documents that Free projects may pause after a week of insufficient activity and that Edge Functions have resource/time limits. References:
- [Supabase Free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Supabase Edge Function limits](https://supabase.com/docs/guides/functions/limits)

**Required action:** verify deployed function version, secrets, bucket privacy, CORS, file-type/size limits, signed URL TTL, cross-tenant denials, backup/export and recovery in an approved staging project. No production file migration is authorized.

### P0-05 — Client data remains legacy-shaped

The current `createExtendedClient` writes identity, individual/corporate profile, risk data, embedded document references and notes to the legacy `clients` record. Sensitive-data inventory and proposal-only splitting tools are available, but no runtime split or bulk migration is implemented.

**Required action:** implement a backwards-compatible data-access layer and collection-specific Rules only after mapping every reader/writer and approving the field-purpose/role/retention matrix. Keep proposed sensitive collections default-denied until those rules and trusted endpoints are implemented and tested.

### P1-01 — Dashboard and analytics sample limits

The current dashboard/analytics services use bounded queries for some collections. A bounded sample must never be labelled as a complete portfolio total. Define exact metric semantics, full-coverage aggregation strategy, currency convention and freshness indicator before executive reporting is expanded.

### P1-02 — Open PR hygiene and documentation drift

Older Draft PRs #40/#46 contain documentation that has been superseded by merged architecture/security documents. The roadmap still contains historical status lines that no longer match merged PRs. Phase 0 updates the current docs and preserves open PRs for explicit review instead of auto-merging them.

## 6. Runtime and release baseline

| Concern | Current evidence | Required release gate |
|---|---|---|
| Root Node runtime | README and CI use Node 22 | Reproduce root install/lint/build on Node 22. |
| Functions runtime | Functions package declares Node 20 | Decide whether legacy Functions remain build-only or are migrated to an approved endpoint runtime. |
| CI | Latest audited main CI passed on the exact SHA above | Every PR must pass the complete current CI on its exact head. |
| Secrets Scan | Latest audited main Secrets Scan passed on the exact SHA above | Re-run on each candidate head; successful scan does not establish runtime secret configuration. |
| Firestore Rules | Emulator suite runs in CI | Add role/action/relationship negative and permitted-path tests with each Rules change. |
| Storage | Edge Function type-check + policy tests run in CI | Staging integration tests must validate the deployed endpoint and real provider configuration. |
| Deployments | Firebase Hosting and Functions deployment configuration exists | No deployment from development branches; separate approval for Hosting, Rules, indexes, Edge Functions and secrets. |
| Local clone | Cloud Shell was previously shown running from `~/InsurNex` on Node 24.22.1 | Verify local branch, SHA and `git status` before pulling or switching; do not overwrite local changes. |

## 7. Non-functional invariants

- No Phase 0 change alters app behavior, routes, visual identity, theme tokens, assets, layout, Firestore data, Rules, indexes, secrets or deployment targets.
- Firebase Spark and zero AI spend remain constraints; no billing plan changes are authorized.
- Existing app modules and PWA are extended, not replaced.
- Organization isolation, role/assignment/relationship authorization and default-deny for unknown sensitive collections are mandatory.
- AI remains advisory, evidence-linked and subject to human review; it must not diagnose, bind coverage, issue policies or decide claims.
- Data migration, provider deployment and production release each require separate reviewed changes and explicit approval.

## 8. Phase 0 exit criteria

Phase 0 is complete when:
1. the exact remote baseline SHA and CI/Secrets Scan evidence are recorded;
2. module/runtime/storage/AI/integration dependencies are documented;
3. open PRs are classified without unsafe automatic merges;
4. roadmap and architecture documents match merged repository state;
5. the Master Execution Backlog has owners/dependencies/acceptance gates (owner assignment may remain pending);
6. no production or runtime behavior change is included in the Phase 0 PR.

## 9. Immediate next step

Proceed to Phase 1 only after this documentation PR is reviewed and merged. Phase 1 begins with runtime compatibility and the client-data access adapter, while keeping all proposed sensitive collections denied until collection-specific authorization has passing Emulator tests.
