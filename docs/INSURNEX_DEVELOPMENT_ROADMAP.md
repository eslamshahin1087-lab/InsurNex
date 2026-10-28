# InsurNex Development Roadmap

**Last updated:** 2026-10-28  
**Release posture:** continue on isolated branches and reviewed pull requests. No production deployment, data migration, or live-secret change is authorized by this roadmap.

## Current baseline

- Phase 1 RBAC and organization invitations merged to `main` in PR #48 (`611c71ef6eb94bde5a695ed32f29de5952f42f8b`).
- CI and Secrets Scan passed on the implementation commit before merge.
- Phase 2A and Phase 2B storage gateway work is merged to `main` (Phase 2B merge commit `19c178aee493df8e2f105e39719aeb0c16f48120`). General and client-linked document operations use exact metadata-bound paths behind the private Supabase signed-URL gateway.
- Phase 2C is being implemented on `feat/insurnex-operation-attachment-gateway-20261028`: operation attachments are being migrated through a separate resource policy so they remain bound to the exact operation and organization.
- Sensitive client fields remain in a combined Client 360 record, assignment-level access and append-only audit events are incomplete, and AI processing is not yet approved for sensitive customer data.

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
- Keep `operationAttachments` on Firebase Storage until its own metadata/authorization path is designed and migrated; do not call the entire product storage-unified yet.

Acceptance gate: Phase 2B CI and Emulator suite pass; all new general documents use the gateway and short-lived URLs; all legacy objects remain available through their existing read-only URL until migrated; no legacy object is deleted by this PR. A separate acceptance gate is required for migrating `operationAttachments` and other remaining direct Storage call sites.

## Phase 2C — Migrate operation attachments as a separate resource

**Status:** implementation in progress on `feat/insurnex-operation-attachment-gateway-20261028`. CI and Secrets Scan passed on exact head `73bcae32c7c0404768fc87b67774c0b82c652f19`; code review and staging verification remain required. No Edge Function deployment or live object migration has been performed.

Scope:
1. Inventory all `firebase/storage` imports and call sites and classify them by collection, path layout, owner relationship and user workflow.
2. Define a dedicated metadata-first gateway resource for operation attachments (or migrate them to the unified `documents` collection only if references and IDs can be preserved).
3. Bind each attachment to the exact operation/organization record, validate the operation's tenant, and apply role-specific read/write/delete rules.
4. Use private objects and short-lived URLs; do not persist fresh download URLs.
5. Preserve existing operation IDs, attachment metadata and workflow references. Implement dry-run inventory, object existence checks, byte-size/checksum reconciliation, retries and rollback.
6. Remove direct `uploadBytes`, `getDownloadURL` and `deleteObject` calls only after the new path passes staging integration tests.
7. Add regression tests for cross-organization operation IDs, missing operations, wrong-role access, duplicate attachments and cleanup after interrupted upload.

Acceptance gate: no remaining direct Firebase Storage calls in the audited file/document/attachment modules; all legacy objects are catalogued and can be restored; operation workflows pass staging acceptance. Do not declare whole-app storage unification complete until this gate passes.

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

1. Review and verify Phase 2B on the exact PR head; do not deploy the updated Supabase Edge Function from this branch yet.
2. Run staging integration tests for upload, temporary URL and delete, including mismatched IDs, cross-tenant relations, claims role and expired signed URL handling.
3. Plan a separate Phase 2C PR for `operationAttachments` and audit all remaining `firebase/storage` imports before declaring storage migration complete.
4. Run the read-only legacy storage inventory against an explicitly selected project/bucket; then build a separate migration/copy tool with a verified rollback. Never delete legacy objects during the first pass.
5. Execute Phase 3 before sensitive identity, family, medical or claim narrative data is used with broad client access.
6. Complete audit and AI safeguards before claiming production-ready security.
7. Treat production deployment as a separate approval-gated operation.
