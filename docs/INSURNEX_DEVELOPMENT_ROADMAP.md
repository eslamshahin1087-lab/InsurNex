# InsurNex Development Roadmap

**Last updated:** 2026-10-30  
**Audited baseline:** `main` at `5c9c924fdf2033215f94c5c1b64d71ede7ff70ee`.  
**Release posture:** isolated branches and reviewed pull requests. No production deployment, billing-plan change, live-secret change or data migration is authorized by this roadmap.

## Phase 0 — Repository governance and technical baseline

**Status:** baseline captured in [Phase 0 Technical Baseline](PHASE_0_TECHNICAL_BASELINE_2026-10-30.md); execution plan in [Master Execution Backlog](MASTER_EXECUTION_BACKLOG.md). This phase is documentation and planning only; it does not change application behavior, visual identity, runtime configuration or production data.

Verified checks on the audited `main` SHA:
- [CI](https://github.com/eslamshahin1087-lab/InsurNex/actions/runs/40878308477) — passed.
- [Secrets Scan](https://github.com/eslamshahin1087-lab/InsurNex/actions/runs/40878308224) — passed.

Outstanding Phase 0 verification:
- Confirm the local Cloud Shell branch/SHA and working tree before any pull or branch switch.
- Verify live Firebase/Supabase project plan, deployed Edge Function revisions/secrets, bucket state and quotas in their consoles; source code and CI do not establish deployed parity.
- Resolve the iNex receiving identity and endpoint export/deploy mismatch only after owner confirmation.
- Rebase/review open PRs #31 and #36; classify old Draft documentation PRs #40 and #46 before closing or archiving.



## Current baseline

- Phase 1 RBAC and organization invitations are merged to `main` in PR #48; see [PR #48](https://github.com/eslamshahin1087-lab/InsurNex/pull/48).
- Phase 2A document storage gateway hardening, Phase 2B general/client document migration, and Phase 2C operation attachment gateway code are merged through PRs #49–#51. The gateway source is present, but the updated Supabase Edge Function has not been deployed; staging integration acceptance remains outstanding.
- Read-only legacy inventory and its Spark-compatible metadata-only mode are merged through PRs #52–#55. Embedded client document references are included by PR #56, and Supabase signed-URL classification by PR #57. These changes passed CI and Secrets Scan on the latest `main` commit `414ca205711944cd06d453834ac8601950cb18c6`.
- Live metadata-only Firestore inventory covered `documents`, `operationAttachments`, and `clients`: 24 Firestore records scanned; 10 records were explicitly marked Supabase-backed in the first two collections; three embedded client document URLs were identified as signed Supabase Storage references.
- Read-only inspection of the active Supabase project confirmed the private `insurnex-documents` bucket has eight object metadata rows, and each of the three embedded client references has exactly one matching object row with matching declared size and MIME type. Object bytes were not downloaded or cryptographically verified.
- Firebase Storage itself could not be inventoried because the Firebase Console for this project requires a plan upgrade. Do not infer that Firebase Storage is empty, and do not upgrade billing without explicit approval.
- A compatibility gateway and Client Documents UI for safe on-demand access to the three embedded legacy Supabase references are being developed in the current PR branch. They are not merged or deployed yet. No production deployment, Firestore metadata backfill, file copy, migration, or deletion has occurred.
- Sensitive client-field separation, assignment-level access, append-only audit events and AI safeguards remain incomplete; see Phases 3–5.

## Phase 2A — Bind signed storage access to authorized document metadata

**Status:** implemented and merged to `main` through PR #49 (merge commit `a6f6d0e983b4909f37749715b9e6d6a562130342`). The Edge Function has not been deployed as part of this roadmap.

Scope:
1. Require a document ID for signed upload, signed download, and delete requests.
2. Read document metadata using the caller's Firebase ID token so Firestore Rules continue to apply.
3. Require exact equality between the requested path and the path stored in that metadata record; also bind organization, client relationship, storage provider, category/area, content type and size.
4. Persist metadata before requesting a signed upload URL so the gateway can validate the intended path first.
5. Apply category/area checks and restrict the claims role to claim-category documents; claims cannot delete through the gateway.
6. Add focused regression tests for path traversal, cross-organization paths, metadata/path mismatches, role checks, category mismatches, content type and size mismatches.

Acceptance gate:
- CI/lint/build passes.
- Storage policy regression tests pass.
- Firestore Emulator tests pass.
- Manual staging test proves upload, preview/download and authorized deletion work for each allowed role, while cross-tenant, wrong-category and mismatched-document attempts are denied.
- Verify and configure the Supabase private bucket's maximum object size and allowed MIME types; the signed-upload request's claimed size/type is not a substitute for storage-side enforcement.
- Do not enable or deploy this code until the Supabase Edge Function on the target project is updated in a separately reviewed release step.

## Phase 2B — Migrate the general Documents page and lifecycle operations

**Status:** implemented and merged to `main` through PR #50 (merge commit `19c178aee493df8e2f105e39719aeb0c16f48120`).
1. Route `document.service.ts` upload, temporary URL and delete operations through the shared private gateway; remove direct Firebase Storage imports from the general document service.
2. Route lifecycle delete operations through the same service and preserve old Firebase-backed objects rather than deleting their metadata prematurely.
3. Use short-lived signed URLs on demand in the Documents page; do not persist signed URLs in Firestore.
4. Extend path authorization to both client-linked paths and general-document paths, binding the general path's embedded document ID to its Firestore metadata ID.
5. Validate related client, policy or claim records against the same organization before signing general-document access.
6. Add regression tests for both path layouts, ID mismatch, tenant mismatch, invalid relation types and role restrictions.

Still required before release:
- Verify and configure private bucket max size and allowed MIME types at storage level; the signed-upload request's claimed size/type is not substitute for storage-side enforcement.
- Use the read-only inventory command in `functions/scripts/legacy-storage-dry-run.mjs` to reconcile Firestore metadata with Firebase Storage object listings before creating a migration manifest. The inventory is scoped to the selected collections and never mutates cloud data.
- A separate migration/copy utility is still required, including idempotent reruns, checksum verification, retry/resume log and a tested rollback that preserves original IDs, filenames, timestamps, categories, relations and uploader metadata.
- Add staging integration tests for actual upload/preview/download/delete and expired URLs.
- Do not enable the client-side Phase 2C path until the matching Edge Function is deployed in a separately approved release and passes staging tests. Existing Firebase-backed operation attachments remain untouched pending inventory and migration.

Acceptance gate: Phase 2B CI and Emulator suite pass; staging confirms upload/download/delete and expiry behavior; legacy objects remain available until migrated; no source object is deleted as part of the gateway rollout. Remaining direct Storage call sites must be audited separately.

## Phase 2C — Migrate operation attachments as a separate resource

**Gateway status:** implemented and merged to `main` through PR #51 (merge commit `69ef5bb28faf4afa5d1795777082f1e56c656fa0`); CI and Secrets Scan passed on the merged implementation head. The Edge Function has not been deployed, staging acceptance is outstanding, and existing Firebase objects remain in place. **Inventory status:** read-only inventory merged through PR #52 (merge commit `33a38b117b832db410c15b6c173569d34fe6a659`) with CI and Secrets Scan passing; it has not yet been run against live data.

Scope:
1. Inventory all `firebase/storage` imports and call sites and classify them by collection, path layout, owner relationship and user workflow.
2. Define a dedicated metadata-first gateway resource for operation attachments (or migrate them to the unified `documents` collection only if references and IDs can be preserved).
3. Bind each attachment to the exact operation/organization record, validate the operation's tenant, and apply role-specific read/write/delete rules.
4. Use private objects and short-lived URLs; do not persist fresh download URLs.
5. Preserve existing operation IDs, attachment metadata and workflow references. The read-only inventory in PR #52 reports object existence, size, available provider checksums, duplicate references and retry history; a separate migration/copy utility with resume and rollback is still required.
6. The operation attachment service no longer uses direct Firebase Storage SDK calls. Do not enable the new client path until the matching Edge Function passes staging integration tests.
7. Gateway policy and Firestore Emulator regressions cover cross-organization operation IDs, missing operations, role access, metadata versioning and pending-upload cleanup; manual staging acceptance remains required.

Acceptance gate: no remaining direct Firebase Storage calls in the audited modules; every legacy object is catalogued and recoverable; signed upload/preview/download/delete passes staging. Do not declare whole-app storage unification complete until the repository-wide Storage call-site audit and migration gate pass.

## Phase 2D — Secure compatibility access for embedded legacy client documents

**Status:** source implementation merged in PR #58 (`10e1996`) and subsequent legacy reference inventory/backfill planning changes merged in PRs #56, #57 and #59. The updated Edge Function has not been accepted in Staging; preserve this distinction between merged code and deployed service.

Scope:
1. Detect older `clients.documents[]` entries that contain Supabase signed URLs but lack an explicit storage provider.
2. Resolve the object key only on the server from the caller-visible client record; never accept a client-supplied object path or stored signed URL as the authorization input.
3. Verify active user, role, organization, client ownership, exact embedded document ID, configured Supabase host, private bucket, allowed object path shape, and optional declared size/content-type metadata before issuing a new 15-minute signed URL.
4. Keep the compatibility route read-only. It cannot update client metadata, delete the legacy record, copy the object, or migrate files.
5. Show embedded legacy documents in the Client Documents panel without returning their stored signed URL to the UI; generate a new signed URL only on view/download.
6. Preserve stricter role boundaries: owner/admin/broker can read compatible client legacy files; claims can read only explicitly claim-category references; platform admin and other roles receive no implicit storage access.
7. Add pure policy tests for host/bucket/org/client/path checks, traversal rejection, provider mismatch, conflicting stable path and URL, and role restrictions.

Release gate:
- CI, storage gateway policy tests, inventory regression tests, lint, build and secrets scan pass on the exact PR head.
- Deploy the updated `document-storage` Edge Function first, confirm the ping endpoint lists `legacy-client-sign-download`, then deploy the matching frontend hosting build in a separately approved release.
- Staging proves both allowed and denied cases, including claims-vs-identity access, cross-tenant attempts, missing objects, size/content-type mismatch, expired old URLs, and refreshed signed URL behavior.
- No legacy document record is rewritten or deleted by this compatibility route.
- After successful access testing, design a separate idempotent backfill from embedded references into first-class `documents` metadata; review and approve its dry-run manifest before any production writes.

## Phase 3B — Inventory sensitive client field presence before schema separation

**Status:** read-only inventory code is merged through [PR #60](https://github.com/eslamshahin1087-lab/InsurNex/pull/60); CI and Secrets Scan passed on head `c1d268571c2ae1da394fb9f69ff5160628c3db02`. The code merge did not execute a live inventory.

Scope:
1. Read only the `clients` collection with a capped Firestore query.
2. Emit field-path presence and aggregate counts for identity/KYC, individual/corporate profiles, health/family risk data, financial fields, derived risk/AI fields, documents, contact/address and free-form notes.
3. Never include raw field values, names, phone/email values, national/tax IDs, medical values, notes, document URLs, signed URL tokens or file contents in the report.
4. Keep local reports ignored by Git; treat them as sensitive because they contain organization/client document IDs and field-presence patterns.
5. Add synthetic regression tests proving sensitive sentinels cannot appear in the output; add CI and CLI help checks.
6. Use results as design input only. No Firestore write, Rules change, schema split, storage access, backfill or deployment is performed.

Acceptance gate:
- CI, lint, browser build, Firebase Functions build, and Secrets Scan pass on the exact PR head.
- A read-only scan runs on the intended project with a reviewed record cap; if the cap is reached, it must be rerun with a reviewed higher cap.
- The data owner reviews field-path categories and agrees on the schema/role matrix before write or migration work.
- Audit every client-field reader/writer and add Emulator denial tests before removing fields from the legacy client record.

## Phase 3C — Proposal-only sensitive-data separation planner

**Status:** proposal-only planner merged in PR #79; nested health/family classification corrected in PR #80. The operator ran a bounded read-only inventory for 14 client records and generated a local proposal/review report. No live records were migrated or changed.

Scope:
1. Consume the sanitized Phase 3B inventory JSON locally, not Firestore or Storage.
2. Propose logical destinations for field paths only; never copy field values.
3. Mark composite parent objects for leaf-level splitting to prevent duplicate/mixed-sensitivity copies.
4. Keep document references, free-form narrative and unknown paths on an explicit manual-review path.
5. Require human approval for every mapping and preserve whether the inventory reached its record cap.
6. Add synthetic regression tests that reject malformed report shape and invalid field-path tokens, plus CI and CLI help checks.

Acceptance gate:
- Current PR head passes the complete CI and Secrets Scan.
- The inventory is intentionally run by an authorized operator against the correct project; the report remains local and access-restricted.
- Review all mapping counts and unclassified paths. If the inventory was capped, do not treat it as complete.
- No migration writer is implemented in Phase 3C; any future writer needs a separate reviewed PR, reversible plan, emulator denial tests and explicit authorization.

## Phase 3D — RBAC proposal and plan review

**Status:** proposed role/data-class matrix and local structural plan reviewer merged in PR #81. This remains a design proposal; runtime permissions for sensitive collections are not thereby granted.

## Phase 3E — Default-deny regression coverage

**Status:** emulator regression coverage merged in PR #82 for proposed sensitive collections. Current test gate confirms default denial; collection-specific allow rules are still unimplemented.

## Phase 3F — Client data-access source audit

**Status:** static audit and query-minimization changes merged in PR #83. Client document listing now queries by tenant and client relation before download. This narrows data retrieval but does not replace Firestore authorization.

## Phase 3 — Separate sensitive customer data and enforce relationship/assignment access

Scope:
1. Define separate records/projections for basic client contact data, identity/KYC, family details, medical information and claim narratives.
2. Keep the default client profile free of fields that Sales, Finance, Staff and ordinary platform operators do not need.
3. Enforce role + tenant + assignment + relationship checks for claim → policy/client, policy → client, document → client/claim and lead/task ownership.
4. Validate foreign keys in rules or a trusted API; do not trust browser-supplied relationship IDs.
5. Migrate existing records with a reversible, idempotent script; verify data counts and permissions with synthetic fixtures before any real-data migration.
6. Add negative tests for swapped IDs, deleted parents, unassigned records, cross-tenant links and role escalation.

Acceptance gate: no broad-role path can read sensitive fields by fetching the full Client 360 record; every sensitive path has positive and negative authorization tests.

## Phase 4 — Auditing, consent, retention and lifecycle controls

Scope:
1. Implement append-only audit events for invitations, role changes, document operations, sensitive record access, exports and administrative access.
2. Record actor, organization, action, resource ID, timestamp, outcome and request/correlation ID; exclude document contents, tokens and unnecessary sensitive values.
3. Restrict audit writes to a trusted path and make client identities unable to rewrite or delete historical events.
4. Define data retention, soft-delete, legal holds, verified export/deletion and backup/restore procedures.
5. Add consent and legal-basis tracking before medical or other sensitive processing, with policy review appropriate to the operating jurisdiction.
6. Add operational alerts for repeated denied access, abnormal downloads and repeated invitation failures.

Acceptance gate: audit trail tamper-resistance tested, retention/deletion behavior documented, restore drill completed, and legal/privacy sign-off recorded before sensitive production use.

## Phase 5 — AI/Copilot safety and cost/runtime readiness

Scope:
1. Inventory every AI provider, API key, function, prompt, log, retention setting and data path.
2. Keep sensitive customer/medical/claim content out of AI providers until data-processing terms, consent/legal basis, regional handling, retention, redaction and access controls are approved.
3. Enforce server-side role/tenant filtering before prompt construction; never rely on the model to authorize tool or record access.
4. Remove secrets from client bundles and check logs/errors for prompt, token, claim or document leakage.
5. Decide explicitly between disabled-by-default AI, a verified no-cost-capable runtime/provider, or a budget-approved paid runtime. Do not describe the stack as free-tier compatible until deployment and quota limits are verified in the target account.
6. Add abuse/rate controls, token budgets, redaction tests and provider outage handling.

Acceptance gate: provider/runtime choice documented, no secret in browser code, redaction and cross-tenant tests pass, and product owner approves the residual AI data risk.

## Phase 6 — Role-aware product experience and regression coverage

Scope:
1. Align navigation, route guards, action buttons, dashboards, searches, exports and empty/error states with the capability matrix.
2. Keep backend rules as the security boundary; UI hiding is only usability, not authorization.
3. Add role-based tests for Owner, Admin, Broker, Sales, Claims, Finance, Staff and Platform Admin.
4. Test invitation expiry/replay, deactivated accounts, email mismatch, wrong organization, self-role escalation and concurrent acceptance.
5. Add regression tests for mobile/PWA flows and keyboard/accessibility behavior.
6. Add schema/index migration checks and query tests for each feature's required Firestore indexes.

Acceptance gate: all roles tested against allowed and denied actions; no console/runtime errors in critical flows; existing owner onboarding, billing/plan boundaries and PWA flows remain green.

## Phase 7 — Release engineering, monitoring and recovery

Scope:
1. Separate development/staging/production configuration and verify secrets are scoped to the intended environment.
2. Add a release checklist covering build provenance, CI status, change summary, database/rules/index dependencies, feature flags, backup and rollback.
3. Run staging smoke tests for sign-in, invitations, role enforcement, document upload/preview/delete, renewals, claims, finance and PWA installability.
4. Establish basic error reporting, uptime checks, failed-job alerts and storage/AI usage monitoring.
5. Deploy rules/functions/storage configuration only after code is merged and an explicit release approval is recorded.
6. Verify production post-deploy behavior with non-sensitive test data; document rollback trigger and owner.

Acceptance gate: green CI on the exact release commit, completed staging acceptance, backup/rollback proof and explicit production approval.

## Immediate execution order

1. Complete Phase 0 baseline and reconcile open PRs and architecture documents.
2. Resolve Spark-compatible backend/runtime design and verify the deployed Supabase storage gateway in Staging.
3. Correct the iNex endpoint identity/export/deploy contract after confirming the approved receiving UID and organization.
4. Build the backwards-compatible Client Data Access Layer and inventory every reader/writer.
5. Implement collection-specific role/tenant/relationship rules while preserving default-deny for proposed sensitive collections.
6. Complete audit/consent/retention/export/delete decisions before introducing sensitive-data writes.
7. Only then design a reversible migration with source/target reconciliation, idempotency, resume and rollback; production writes require separate approval.
8. Continue to treat deployment, Rules/index/function changes, secret changes and data migration as separate approval-gated operations.

## Phase 3A — Architecture and data contracts (2026-10-28)

**Status:** documentation merged to `main` through PR #61. The Master Architecture, Firestore Schema v2 proposal and AI Module Contracts remain design contracts; they do not change Firestore schema, runtime behavior, secrets or deployment configuration.

- [Master Architecture](MASTER_ARCHITECTURE.md): module boundaries, data flows, trust boundaries, integration and release posture.
- [Firestore Schema v2 Proposal](FIRESTORE_SCHEMA_V2_PROPOSAL.md): additive target record model and sensitive-data separation proposal; not yet a live schema.
- [AI Module Contracts](AI_MODULE_CONTRACTS.md): safe input/output contracts and guardrails for Document, Medical, Coverage, Claims, Sales and Copilot.
- [Phase 3 Acceptance Plan](PHASE_3_ACCEPTANCE_PLAN.md): baseline, field separation, authorization, AI, storage staging and release acceptance gates.

**Current gate:** review PR #60 and the open Phase 2D work; verify CI on exact candidate commits; complete privacy-safe inventory and staging acceptance before modifying production records or deploying the gateway. No production operation is authorized by this documentation update.
