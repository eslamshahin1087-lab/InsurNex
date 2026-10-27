# InsurNex — Proposed Role Capability Matrix

**Status:** proposed for product-owner review; not yet enforced by Firestore Rules.  
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

## Required member provisioning flow before role rules are enabled

Current onboarding writes an owner profile and owner membership. It does not establish a verified invitation/acceptance flow for the other roles.

Implement a least-privilege, auditable path before enabling role-specific access:
1. Owner/Admin creates a time-limited invitation containing organization ID, normalized invitee email, allowed role, inviter UID, expiration, one-time token hash and status.
2. The invitee signs in with Firebase Authentication and proves ownership of the invited email (where email verification is required).
3. A trusted endpoint or tightly constrained invite-acceptance transaction validates expiry, token, email, active organization, inviter capability and one-time use.
4. Provision `users/{uid}` and `organizations/{orgId}/members/{uid}` consistently; never let a user write their own role or organization ID.
5. Record invitation creation/acceptance/revocation in the organization audit log.
6. Test expired/replayed invitations, wrong email, cross-organization assignment, role escalation, deactivated members and concurrent acceptance.

Under the currently selected Firebase Spark constraint, any server endpoint for this flow must run on a verified no-cost-capable runtime; Firebase Cloud Functions cannot be assumed deployable on Spark. Do not ship invitation writes before that runtime and token design are reviewed.

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

## Review decision needed

This matrix is intentionally conservative for sensitive data. Please review the proposed role boundaries before we enforce them. If changed, update this document first, then implement rules + invitation provisioning + emulator tests in the same reviewed phase.
