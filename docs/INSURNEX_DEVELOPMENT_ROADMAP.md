# InsurNex Development Roadmap

**Last updated:** 2026-10-28  
**Release posture:** continue on isolated branches and reviewed pull requests. No production deployment, data migration, or live-secret change is authorized by this roadmap.

## Current baseline

- Phase 1 RBAC and organization invitations merged to `main` in PR #48 (`611c71ef6eb94bde5a695ed32f29de5952f42f8b`).
- CI and Secrets Scan passed on the implementation commit before merge.
- Current document storage is mixed: client-linked documents may use the Supabase signed-URL gateway, while `src/features/documents/document.service.ts` still uses direct Firebase Storage upload/download/delete operations.
- The existing gateway checks caller identity, role, organization, and client, but must bind every signed operation to the exact Firestore document metadata record before it can be treated as a hardened boundary.
- Sensitive client fields remain in a combined Client 360 record, assignment-level access and append-only audit events are incomplete, and AI processing is not yet approved for sensitive customer data.

## Phase 2A — Bind signed storage access to authorized document metadata

**Status in this branch:** CI and Secrets Scan passed on head `2eaaeb63b45c5b84351579c8aaac37dd1916838e`. The PR remains draft pending code review and staging integration tests; the Edge Function has not been deployed.

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

## Phase 2B — Finish the document-storage migration without losing legacy files

Scope:
1. Route the general Documents page and `document.service.ts` through the same private gateway; remove direct Firebase Storage upload/download/delete calls from application paths.
2. Keep existing Firebase-backed records read-only while migration tooling inventories metadata, bucket/path, file existence, checksum/size and last-access status.
3. Build an explicit migration job with dry-run mode, object count/size report, checksum validation, retry log and idempotent rerun.
4. Migrate only after a verified backup/export and a tested rollback path. Preserve original IDs, filenames, timestamps, categories, relationships and uploader metadata.
5. Replace long-lived download URLs with short-lived authorized links. Avoid persisting signed URLs in Firestore.
6. Configure private bucket policies and verify that the browser's public/publishable key cannot bypass the gateway.
7. Add automated gateway integration tests and test the no-file, duplicate, corrupt-object, expired-link and interrupted-upload cases.

Acceptance gate: zero remaining direct Firebase Storage calls for document operations; migrated object counts/checksums reconcile; existing files remain retrievable only to authorized users; rollback drill succeeds. Do not delete legacy objects as part of the first migration pass.

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

1. Finish review and CI for Phase 2A in this branch.
2. If accepted, merge Phase 2A only after the storage gateway release procedure and target-project configuration are ready.
3. Open a separate PR for Phase 2B and migrate the general Documents page; do not combine a destructive legacy migration with gateway changes.
4. Execute Phase 3 before real sensitive identity, family, medical or claim narrative data is used with broad client access.
5. Complete audit and AI safeguards before claiming production-ready security.
6. Treat production deployment as a separate approval-gated operation.
