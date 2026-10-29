# Phase 3 Acceptance Plan — Security-First Product Completion
**Current position as of 2026-10-28:** use this plan as an execution checklist, not a claim that all listed work is completed.

## Gate A — Establish exact baseline
- [x] Review PR #60 (privacy-safe sensitive field-presence inventory) and CI on its current head; the code is merged. The actual inventory run remains a separate operator task.
- [ ] Confirm phase-2D legacy client document access PR status and tests; compare deployed endpoint state separately.
- [ ] Run CI on the exact candidate commit: access, plans, PWA, document-storage policy, storage inventory, legacy backfill plan, sensitive inventory, lint, app build, Functions build, Firestore emulator suite, Deno type-check and secrets scan.
- [ ] Capture exact commit SHA and CI run URL in the release record.
- [ ] Keep production deploy, bulk data migration and secret changes out of this gate.

## Gate B — Field separation design (no data writes)
- [ ] Complete privacy-safe field inventory with a bounded scan and sanitized local report. No live scan is presumed completed by CI.
- [ ] Map each legacy client field path to: base contact profile, identity/KYC, family, medical, claim-sensitive, financial, derived AI finding, document metadata or discard/retention-review.
- [ ] Record per-field legitimate purpose, least-privilege roles, retention classification, export/delete behavior and owner.
- [ ] Build a compatibility adapter so existing pages can continue reading safe projections while migration is reviewed.
- [ ] Define schema version, dry-run mapping, collision handling, missing references, retry/resume and rollback.
- [ ] Generate a local proposal-only mapping with `client-sensitive-data-separation-plan.mjs`; manually review destinations, parent splits and unclassified field paths.
- [ ] Run `client-sensitive-data-separation-review.mjs`; require a `review_only` structural result, then manually review every flagged path and the proposed RBAC matrix. A `review_only` result is not migration approval.
- [ ] Approve the [proposed client sensitive-data RBAC matrix](CLIENT_SENSITIVE_DATA_RBAC_MATRIX.md) against actual role requirements before implementing Rules or migration writers.
- [ ] Do not migrate real records until counts, checksums where applicable, relationship integrity and emulator denial cases pass.

## Gate C — Authorization regression suite
- [x] Add Emulator regression checks proving all proposed sensitive collections remain default-denied for Owner, Broker, Sales, Claims, Finance, Staff and a foreign-organization owner until explicit collection-specific rules are implemented.
- [ ] Tenant: user A cannot read/query/write/update/delete organization B records, including by known document ID.
- [ ] Relationship integrity: client/policy/claim/document IDs must all resolve inside the same organization; swapped IDs and missing parents are denied.
- [ ] Sensitive split: Sales, Staff and Finance cannot access KYC/family/medical/narrative documents by ID or broad query.
- [ ] Claims: claims role sees only authorized claims and claim-category documents; no unrelated identity files.
- [ ] Assignment: once assignment policy is implemented, unassigned lead/claim paths are denied consistently at Rules and trusted endpoints.
- [ ] Platform Admin: no routine direct tenant content access; support escalation is time-bound and audited if explicitly added.
- [ ] User cannot assign self/others a role, change own organization, accept expired/replayed invitations, or write audit logs.
- [ ] Storage: no URL signing from client-supplied paths; strict metadata and organization binding; no persisted signed URL.

## Gate D — Evidence-safe AI
- [ ] Inventory AI providers, functions, secrets, prompt sources, logs, data retention and geographic routing.
- [ ] Confirm provider terms/legal basis/consent and current quotas before sending personal or medical data.
- [ ] Server-side tenant/RBAC filter before prompt construction, with field allow-list and data minimization.
- [ ] JSON output schema and evidence reference validation; no evidence => explicit insufficiency.
- [ ] Deterministic code calculates all financial/utilization metrics; LLM is interpretive only.
- [ ] Human-review state required for extracted policy facts, potential coverage gaps, claims action suggestions and sales content.
- [ ] Disable by default when provider is not approved or quota exhausted; no paid fallback unless separately approved.

## Gate E — Document storage staging acceptance
- [ ] Verify private bucket limits/allowed MIME types at storage level.
- [ ] Deploy Edge Function to a staging project only after approval; verify `?ping=1` reports expected actions.
- [ ] Test upload, preview/download, expiry, delete, pending upload cleanup and denied scenarios.
- [ ] Cover all three storage layouts: general document, client-linked document, operation attachment, plus embedded legacy references.
- [ ] Confirm source objects remain recoverable and no stale signed URL is persisted.
- [ ] Run cross-tenant and role/category negative cases against staging identities.
- [ ] Deploy matching frontend only after endpoint acceptance; production remains separately gated.

## Gate F — Release readiness
- [ ] RTL mobile smoke test: auth, onboarding, clients, leads, quote/policy, claim, renewal, document, finance and task workflows.
- [ ] Admin isolation smoke test; direct URLs and backend requests as a normal user.
- [ ] Accessibility: keyboard order, visible focus, reduced motion, semantic labels and contrast.
- [ ] Data export/delete/retention process reviewed and exercised on synthetic data.
- [ ] Incident response and restore/rollback drill documented.
- [ ] Privacy/legal review recorded for Egypt Personal Data Protection Law 151/2020, including sensitive/medical data and third-party processing; this checklist does not itself certify compliance.
- [ ] Owner approves production release in a separate explicit step.

## Exit criteria
Phase 3 can be called complete only when field separation and permissions are enforced in runtime code, not just in design docs; test evidence is attached to the PR; and staging/rollback gates are satisfied. Documentation alone does not make the app production-ready.
