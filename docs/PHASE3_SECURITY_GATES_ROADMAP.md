# InsurNex Phase 3 Security Gates and Delivery Roadmap

**Status:** Development planning artifact. This document does not authorize production deployment, data migration, or provider configuration changes.

## Current verified baseline

- Repository default branch: `main`.
- Baseline inspected: `4b53fd680ff3002f6366a8334bed84d03b519c10` (2026-10-29).
- CI on the baseline failed in `npm run build` because `src/features/copilot/copilot-page-session.test.ts` imports Deno's remote assertion module and refers to the `Deno` global, while the browser TypeScript project includes the whole `src` tree.
- The isolated fix on `fix/copilot-session-test-build-isolation-20261029` excludes only this Deno test from `tsconfig.app.json`; CI and Secrets Scan both passed on commit `03417c4602660ac54d0c2153bc87eabef6b6875d`. That PR was still open at the time of review.
- Latest observed main CI and Secrets Scan: CI failed at build; Secrets Scan succeeded.
- Existing architecture proposal: `docs/MASTER_ARCHITECTURE.md`. It defines Firebase Auth, immutable tenant `organizationId`, server-side authorization, private document gateway, evidence-linked AI, and separate Platform Admin access.

## 1. Release and merge gates

1. Fix the known main TypeScript build failure and confirm the PR CI and Secrets Scan are green.
2. Review and merge Copilot route/session isolation changes only after confirming the PR base is current and no stale context can survive route or identity changes.
3. Merge the Firestore Copilot parent-message authorization change only after Emulator tests demonstrate:
   - own conversation writes succeed;
   - another member's conversation, missing conversation and foreign-organization conversation are denied;
   - `conversationId` cannot be changed after creation.
4. Never treat GitHub CI success as proof that the deployed Supabase Edge Function, Firestore Rules, indexes, or Firebase Hosting match the source. Verify each deployed surface independently.
5. Production release remains manual and requires explicit approval. No automatic deployment, migration, bulk backfill, or change to live data is covered by this roadmap.

## 2. Target architecture and tenant contract

- Client: existing React + TypeScript + Vite installable PWA, Arabic RTL default, responsive mobile-first layout.
- Identity: Firebase Authentication UID is canonical identity. Resolve active organization membership and role from trusted records; never trust browser-supplied role or tenant IDs by themselves.
- Tenant boundary: every tenant-owned business record must include immutable `organizationId`. Verify membership, capability and same-tenant relationships at Firestore Rules and at every privileged server endpoint.
- Data services: Firestore for structured business data and metadata; private object storage via the authorized document gateway for binary content; server-side AI orchestration only after authentication, authorization and data minimization.
- AI output must include evidence/source references and scope/limitations; it must never diagnose, bind policies, decide suitability/underwriting, approve/reject claims, or make final broker decisions.
- Platform Admin stays separate from tenant roles and must not gain automatic access to tenant contents.
- Free-tier and AI-provider availability is not assumed: document quotas, regional availability and failure fallback before enabling a provider.

## 3. Data model invariants

Canonical top-level tenant collections should use `organizationId` plus typed relationships and timestamps. The target model includes:

- Identity/tenancy: `users`, `organizations`, `organizations/{orgId}/members`, invitations and role/capability mappings.
- CRM and pipeline: `clients`, `clientSensitiveProfiles`, `leads`, `activities`, `tasks`.
- Insurance operations: `quotes`, `policies`, `renewals`, `claims`, `claimActivities`, `insurers`.
- Documents: `documents`, `operationAttachments`, immutable audit metadata; file bytes remain private in object storage, not embedded in Firestore records.
- Intelligence/finance: `medicalImportJobs`, `medicalClaims`, `medicalReports`, `coverageAssessments`, `aiJobs`, `aiFindings`, `commissions`, `revenue`, `expenses`, `notifications`.
- Copilot: `copilotConversations` and `copilotMessages` scoped by `organizationId` and owning `userId`; each message references an existing conversation owned by the same user and organization.
- All monetary fields carry an explicit currency. Persisted effective dates remain distinct from server-generated audit timestamps.

This list is a target inventory, not a command to migrate or create collections all at once. Reconcile it against the actual schema and indexes before implementation.

## 4. Sensitive-data segregation and audit

1. Complete a field-presence-only inventory for current `clients` records; report field paths and aggregate counts only, without values or document URLs.
2. Separate highly sensitive identity/KYC, family, medical, financial, risk and AI-derived content into independently authorized records/projections. Firestore Rules do not provide field-level hiding for fields in one readable document.
3. Maintain organization scope and relationship validation during each read/write. Add rules tests for cross-user and cross-tenant attempts.
4. Keep an append-only audit trail for access to sensitive records, document downloads/deletions, privilege changes, exports and AI processing, with minimal personal content in logs.
5. Implement export/deletion workflows only after retention, legal holds, ownership links, backup impact and downstream copies are defined. Do not execute a bulk migration or deletion as part of a feature PR.
6. Use private storage and server-issued short-lived access for documents. Never persist signed URLs or tokens in Firestore or logs.
7. Treat compliance with Egyptian Personal Data Protection Law No. 151 of 2020 as a legal-review workstream; a technical checklist alone does not certify compliance.

## 5. Copilot and AI validation contract

Before every model call:
- Verify Firebase ID token, active membership, organization, action capability and exact record relationship server-side.
- Accept only allow-listed selector fields from the browser; fetch business facts server-side and project only necessary fields.
- Cap prompt size, record sample sizes and message lengths; redact direct identifiers and medical details unless the operation explicitly needs them and is authorized.
- Treat user-provided documents, record fields and chat history as untrusted data, not as system instructions.
- Use structured output validation; map every finding to evidence (document/page/field/date or source record) and explicitly label missing evidence and sample limitations.
- Return generic public errors; logs may contain safe error codes/statuses only, not raw SDK exception objects, PII, medical details, API keys, tokens or prompts.
- Provide a non-AI fallback if no permitted provider/quota is available; do not promise a provider is free without checking current terms/quotas.

## 6. Phase plan

### Phase 0 — Build and release baseline
- Fix Deno test exclusion from the browser TypeScript project.
- Require green build + Secrets Scan; inspect exact commit and workflow jobs.
- Confirm PR base/head are current before merge.

**Acceptance:** app build, lint, current smoke tests, Firebase Functions build, Deno checks and Firestore Emulator rules tests pass.

### Phase 1 — Security foundation
- Complete RBAC matrix and tenant query/index audit.
- Enforce Copilot conversation-parent authorization and route/session isolation.
- Review floating panel for raw exception logging and stale responses.
- Verify document gateway authorization and cross-tenant download denial.

**Acceptance:** positive and negative automated tests cover each role, tenant boundary and conversation scope. No production deploy in this phase.

### Phase 2 — MVP broker operations
- Stabilize CRM, leads, policies, renewals, claims, documents, tasks, notifications, insurer directory and financial commission tracking.
- Dashboard metrics derive from tenant-scoped persisted data; distinguish sample-derived AI insights from exact aggregate totals.
- Complete mobile and desktop RTL regression, PWA installability, loading/empty/error states and accessibility.

**Acceptance:** lifecycle smoke test from lead to quote/policy and from policy to renewal; claims transition audit; document privacy tests; mobile/desktop regression.

### Phase 3 — Privacy and document intelligence
- Inventory sensitive fields, document relationships and legacy storage.
- Create document registry + authorized storage gateway contracts.
- Introduce separately protected sensitive client profiles using reversible, dry-run migration design.

**Acceptance:** no sensitive values in inventory output or logs; migration dry-run reconciliation and rollback tested; no bulk write until separate approval.

### Phase 4 — Medical and portfolio intelligence
- CSV/XLSX/PDF parsing in a bounded pipeline with schema validation, duplicate detection and provenance.
- Medical cost/frequency/severity and trend calculations from supplied data only.
- Coverage/exclusions/limits analysis from cited policy evidence, with explicit unknowns.

**Acceptance:** synthetic fixtures, calculation tests, invalid-file tests, missing-data tests and evidence traceability; no clinical diagnosis.

### Phase 5 — AI Sales Assistant and Copilot
- Needs-analysis prompts, safe follow-up drafts, summaries, renewal/claim assistance and bounded workspace queries.
- Field-masked server context, per-session isolation and robust safe errors.
- Validate prompt-injection handling and verify that outputs do not invent data.

**Acceptance:** Deno/Node contract tests, cross-tenant negative tests, route/session regression, output evidence checks and provider failure fallback.

### Phase 6 — Client Portal
- Separate client identity and access model; allow only the client's own policy/document/claim views and document submission.
- Verify access via ownership links, consent and scoped storage access.
- No direct access to broker-only finance/underwriting/AI notes.

### Phase 7 — Insurer Comparison Engine
- Normalize quotations and compare premium, limits, exclusions, deductibles, waiting periods and conditions.
- Display data sources, missing fields and non-comparable terms.
- Recommendations remain explanatory; broker makes final choice.

## 7. Required PR checklist

- [ ] Problem and scope are explicit; no unrelated visual/function rewrite.
- [ ] Tests cover expected success and denial paths.
- [ ] Tenant ownership is derived/validated server-side.
- [ ] No sensitive values in logs, test fixtures outside synthetic data, or audit summaries.
- [ ] Firestore Rules, indexes, Edge Functions and browser types compile.
- [ ] Mobile RTL and desktop layout smoke tests pass.
- [ ] CI + Secrets Scan green for the exact PR head.
- [ ] Deployment and migration are explicitly excluded unless separately approved.
