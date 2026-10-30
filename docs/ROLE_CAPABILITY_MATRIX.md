# InsurNex — Proposed Role Capability Matrix

**Status:** approved starting matrix; Phase 1 RBAC implementation merged to `main` in PR #48 on 2026-10-27. Production readiness is still blocked by the residual risks below.  
**Baseline:** repository roles in `src/types/auth.ts`: `owner`, `admin`, `broker`, `sales`, `claims`, `finance`, `staff`. Platform Admin is a separate platform-operator identity and is not an organization role.

## Security principles

1. Tenant membership and role capability are both required. A matching `organizationId` alone does not authorize every action.
2. UI route guards are not a security boundary; Firestore Rules and each trusted endpoint must enforce access.
3. Platform Admin has platform-management access by default, not routine access to tenant customer, policy, claim, document, or medical contents. Any emergency support access must be explicitly approved, time-bounded and audited.
4. Firestore document rules cannot remove selected fields from a readable document. Sensitive attributes such as national ID, date of birth, family details, health data and claim narratives must be separated into independently authorized documents or served through a trusted projection/API.
5. Delete rights are narrower than read/update rights. Critical business records should be archived/soft-deleted with audit events rather than silently removed.
6. Assigned-record restrictions (for example, only assigned Leads or Claims) are a second layer to consider after organization-level capabilities are working and covered by tests.

## Proposed capabilities

| Capability area | Owner | Org Admin | Broker | Sales | Claims | Finance | Staff | Platform Admin |
|---|---|---|---|---|---|---|---|---|
| Organization profile/settings | Full | Manage | Read | Read | Read | Read | Read | Platform settings only |
| Members and role assignment | Full | Manage members, not owner transfer | None | None | None | None | None | Platform account support only |
| Client CRM / basic contact | Full | Full | Full | Create/update business contacts and leads | Read minimum necessary for claims | Read minimum necessary for finance | Read assigned/minimum necessary | No routine tenant-content access |
| Sensitive client identity/family/medical data | Full, audited | Based on necessity and audit | Based on assigned case/necessity | No | Only claim/medical cases assigned to role | No | No | No routine access |
| Leads / sales pipeline / RFQ | Full | Full | Full | Full | Read linked lead context only | Read quote values only if needed | Assigned tasks only | No routine tenant-content access |
| Policies / coverage metadata | Full | Full | Full | Read relevant summary; no issuance authority by default | Read policies linked to claims | Read premium/commission fields needed for finance | Read limited assigned records | No routine tenant-content access |
| Claims workflow | Full | Full | Full | No claim narrative/documents by default | Full on assigned claims | Read financial status/amount fields only | Assigned tasks only | No routine tenant-content access |
| Documents | Full | Full | Full by role/relationship | Proposal/correspondence only; no ID/claim/medical categories | Linked claim documents only | Finance-related documents only | No document content by default | No routine tenant-content access |
| Tasks / notifications | Full | Full | Full | Own/assigned work | Own/assigned work | Own/assigned work | Own/assigned work | Platform operational tasks only |
| Finance: revenue/expenses/commissions | Full | Full | Read brokerage-relevant commission summaries by policy | No | No | Full | No | Platform subscription revenue only; never brokerage finance data by default |
| Insurer directory | Full | Full | Full | Read | Read | Read | Limited read | Platform directory/admin data only |
| AI Copilot / analytics | Organization-wide operational use, subject to role/data filtering | Same | Role-filtered | Sales data only | Claim data only | Finance data only | Assigned tasks/basic summaries | Platform metrics only |
| Export / delete customer data | Manage through audited workflow | Authorized export; deletion policy controlled | Request/limited to scope | No bulk export | Claim-related export only | Finance-related export only | No | No tenant data export by default |
| Audit logs | Organization audit view | Organization audit view | Own sensitive actions as appropriate | Own actions | Own actions | Own actions | Own actions | Platform audit view; no medical/customer payloads |

## Suggested Firestore capability model

Use explicit helpers rather than a single broad same-organization allow rule:

- `canReadCollection(role, collection)`
- `canCreateCollection(role, collection)`
- `canUpdateCollection(role, collection)`
- `canDeleteCollection(role, collection)`
- `canAccessRecord(role, action, record)` for relationship/assignment checks where supported.
- Platform Admin permissions are evaluated separately and never used as an automatic bypass for tenant collections.
- Unknown collections remain denied to client identities.
- Copilot conversations/messages are scoped to the owning user unless an explicit shared-conversation feature is implemented.

## Member provisioning implementation in Phase 1

The draft implementation now adds a client-side Firestore Rules-constrained invitation flow:
1. Owner/Admin creates a random, unguessable invitation ID bound to a normalized email, role, organization, creator, and expiry no later than seven days.
2. The invitee signs in or registers, verifies their Firebase Auth email, and accepts only an invitation addressed to that verified email.
3. Acceptance updates the invitation and atomically creates `users/{uid}` plus `organizations/{orgId}/members/{uid}`. Firestore `getAfter` checks validate the combined post-write state; role and organization fields cannot be self-edited afterwards.
4. Owner/Admin can revoke pending invitations. Invitation email delivery is manual/copy-link for the free-only MVP; no paid email provider is assumed.
5. Owner/Admin can update roles and enable/disable membership by atomically changing both profile and membership records. Owner role transfer is intentionally excluded.

Phase 1 CI and Firestore Emulator regression tests passed for PR #48. This is not a claim of complete production security. There is no append-only audit-log implementation yet; invitation and role changes are not fully audited until a trusted audit sink is implemented.

## Current Firestore Rules read-capability coverage (2026-10-30)

The merged Rules currently enforce the following same-organization top-level read capabilities. This table describes current runtime Rules, not the broader target policy above. Assignment-level restrictions are not yet enforced for every collection.

| Collection | Current allowed roles |
|---|---|
| `clients` | Owner, Admin, Broker |
| `policies` | Owner, Admin, Broker, Claims |
| `claims`, `claimActivities` | Owner, Admin, Broker, Claims |
| `leads`, `leadActivities`, `rfqs` | Owner, Admin, Broker, Sales |
| `tasks`, `notifications` | All organization roles |
| `insurers` | All organization roles |
| `operations`, `operationEvents`, `operationAttachments`, `operationsEmailDirectory` | Owner, Admin, Broker, Claims |
| `documents` | Owner, Admin, Broker; Claims only when `category == claim` |
| `revenue`, `expenses`, `commissions` | Owner, Admin, Finance |
| Copilot conversations/messages | Owning user only, with parent-conversation checks |

Sales and Claims do not have direct access to the legacy mixed-sensitivity `clients` record. Claims access to linked policy metadata and claim-category documents is currently organization-scoped; per-claim assignment checks are a future gate. Finance can read finance collections, not full client profiles or claim narratives.

A current Emulator read matrix is being expanded to test each allowed/denied direct get and tenant-scoped query, as well as role-appropriate create paths. A green test means these exact Rules passed against the demo emulator; it does not certify staging/production configuration.

## Required tests

- Every role: allowed and denied reads/writes for every data collection.
- Cross-organization direct-document read, query, create, update and delete denials.
- Attempt to forge/change `organizationId`, role, status or owner ID.
- Platform Admin cannot read tenant clients/claims/documents through generic collection rules.
- Copilot user A cannot read user B's conversation/messages in the same organization.
- Document access requires authorized client/resource linkage and short-lived signed URLs.
- Unverified, inactive, profile-less users and expired/replayed invitations are denied.
- Onboarding existing owner account remains functional.
- Run all checks against the Firestore Emulator; no production security-rule deployment before review.

## Review and release decisions

This matrix remains the baseline for subsequent phases. Any material role-boundary change must update this document and the matching automated tests together. Never rely on frontend-only route hiding for authorization.

## Implemented capability boundaries and known gaps (Phase 1 merged)

The current rule changes enforce organization membership plus action/collection capability on the main business collections. They remove the generic Platform Admin bypass for tenant business records, scope Copilot conversation/message access to the current user, restrict document metadata by role/category, and add a one-time verified-email invitation flow.

Important residual risks before production:
- The current `clients/{clientId}` document still contains mixed-sensitivity fields. Firestore Rules cannot hide selected fields in a readable document. Claims is now denied direct reads, queries and client-timeline reads on this legacy record; its claim workspace uses the client/policy snapshot and claim-category document metadata instead. Owner/Admin/Broker remain the only roles with full Client 360 access until a safe base-client projection and per-class records are implemented. Sales/Finance/Staff remain denied.
- Current policies/claims/documents remain organization-scoped rather than fully assignment-scoped. A later phase must validate every foreign-key relationship (claim→policy/client, document→client/claim) server/rules-side and add assigned-record restrictions.
- Platform Admin still has deliberate access to platform-management collections such as users, organization metadata, plans and subscription records. It must not be used as a general tenant-record access role.
- auditLogs, data export/deletion, retention enforcement, and client-consent flows are not implemented by the current code changes.
- The legacy general document service still contains direct Firebase Storage upload/download/delete code. It remains incompatible with a strict Spark-only operation model until all call sites are migrated to the canonical private storage gateway and the complete workflow is tested.
- Firebase Functions/Anthropic AI deployment is not made free-tier compatible by this PR. Sensitive AI calls stay out of scope until a suitable runtime and data-handling posture are approved.

No production rules, hosting, function, or storage deployment was performed as part of PR #48.