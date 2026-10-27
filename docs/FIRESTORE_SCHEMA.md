# InsurNex — Firestore Schema Baseline

> **Status:** schema inventory and target proposal, 24 October 2026. Existing collection names and field conventions must be preserved until call sites, rules, indexes and migration tests are reviewed. Proposed collections below are not deployed by this document.

## 1. Global conventions

- Firestore is the system of record for CRM and brokerage metadata.
- Tenant-owned top-level records carry `organizationId: string`.
- Existing services normally query by `where('organizationId', '==', activeOrganizationId)`; keep this filter in every list query.
- Use `createdAt` / `updatedAt` server timestamps for audit ordering. Current domain business dates such as policy expiry, incident date and due date are commonly stored as `YYYY-MM-DD` strings; do not silently convert existing values to Timestamp.
- `createdBy` and actor UID fields identify the user. The server/rules must validate them; they are not authorization by themselves.
- Store references as stable document IDs (`clientId`, `policyId`, `insurerId`, `leadId`) and duplicate display names only when the UI needs a historical snapshot.
- No secrets, raw payment credentials, AI-provider keys or service-account keys belong in Firestore documents or the browser bundle.
- Use Firestore Rules tests for direct document reads and queries. A query should include organization scoping, but the rule must still reject forged/cross-tenant records.

## 2. Current collections and observed fields

| Path / collection | Current fields evidenced in code | Relationship / notes |
|---|---|---|
| `users/{uid}` | `email`, `displayName`, `organizationId`, `role`, `status`, timestamps | Auth profile. Current roles: `owner`, `admin`, `broker`, `sales`, `claims`, `finance`, `staff`. |
| `organizations/{orgId}` | `name`, `type`, `ownerId`, `country`, timestamps | `type`: `individual`, `office`, `company`. |
| `organizations/{orgId}/members/{uid}` | `uid`, `email`, `displayName`, `role`, `status`, `createdAt` | Membership subcollection. Current onboarding creates owner membership. |
| `admin/{uid}` | Platform-admin membership document; exact payload provisioned out-of-band | Client-side create/update/delete are denied by rules. |
| `clients/{clientId}` | `organizationId`, `type`, `status`, `name`, `email`, `phone`, optional `nationalId`, `taxId`, `industry`, `city`, `address`, `notes`, `createdBy`, timestamps | `type`: individual/company; `status`: active/prospect/inactive. Wizard flow adds extended fields; inventory those before schema migration. |
| `clients/{clientId}/timeline/{eventId}` | Timeline event with actor field `by`; full event schema needs source-level audit | Access inherits from the parent client's organization. |
| `policies/{policyId}` | `organizationId`, `clientId`, `clientName`, `insurerId`, `insurerName`, `policyNumber`, `line`, `product`, `startDate`, `expiryDate`, `premium`, `commissionRate`, `commissionAmount`, `currency`, `status`, `coverage`, `createdBy`, timestamps; optional RFQ/quote/operation/document IDs | `line`: medical/motor/property/marine/life/liability/other; status: active/pending/expired/cancelled. |
| `leads/{leadId}` | `organizationId`, `name`, optional `companyName`, `phone`, `email`, `source`, `priority`, `stage`, `insuranceType`, insurer fields, `estimatedValue`, assignment fields, notes/lost reason, optional `clientId`, activity/converted/won/lost timestamps, `createdBy`, timestamps | Existing stages: new/contacted/qualified/quotation/negotiation/won/lost. iNex ingress uses deterministic `sp_<hash>` IDs and source metadata. |
| `leadActivities/{activityId}` | `organizationId`, `leadId`, `type`, `message`, `createdBy`, `createdAt` | Created alongside lead and stage changes. |
| `claims/{claimId}` | `organizationId`, `claimNumber`, `clientId`, `clientName`, `policyId`, `policyNumber`, `insurerId`, `insurerName`, incident/notification dates, claim/approved amounts, currency, status, description, creator, timestamps | Status lifecycle: new/documents/submitted/review/additional_documents/approved/rejected/settlement/closed. |
| `claimActivities/{activityId}` | Collection and composite index exist; complete field contract must be confirmed from every writer | Use `organizationId` and `claimId` consistently. |
| `tasks/{taskId}` | `organizationId`, `title`, `description`, `priority`, `status`, `dueDate`, `assignedTo`, `relatedType`, `relatedId`, `createdBy`, timestamps | Related type: general/client/policy/renewal/claim/lead. |
| `insurers/{insurerId}` | `organizationId`, `name`, `contactName`, `phone`, `email`, `status`, timestamps | Product catalog, underwriting contacts and insurer comparisons need an expanded versioned model. |
| `documents/{documentId}` | `organizationId`, `name`, `category`, `originalFileName`, `contentType`, `size`, `storagePath`, `downloadUrl`, optional `storageProvider`/`storageBucket`, relation type/id, `uploadedBy`, notes, `createdAt` | Categories currently include policy/claim/client/identity/proposal/correspondence/other. Keep storage private and validate relation ownership. |
| `revenue/{entryId}` | `organizationId`, `type`, `amount`, `currency`, optional client/policy references and display snapshots, `date`, `status`, notes, creator/timestamp | Types: premium/commission/fee/outstanding; status: confirmed/pending/cancelled. |
| `expenses/{entryId}` | `organizationId`, `category`, `amount`, `currency`, `date`, `description`, notes, creator/timestamp | Categories: operational/marketing/staff/other. |
| `commissions/{entryId}` | `organizationId`, optional policy/client/insurer references and display snapshots, `premium`, `commissionRate`, `commissionAmount`, `currency`, `status`, expected/received dates, notes, creator/timestamp | Status: pending/received. Finance tenant-isolation regression coverage is being added separately. |
| `copilotConversations/{conversationId}` | `organizationId`, `userId`, `title`, `lastMessage`, `messageCount`, timestamps | User-scoped within an organization. |
| `copilotMessages/{messageId}` | `organizationId`, `conversationId`, `userId`, `role`, `content`, `createdAt` | Messages are sensitive business data; retention/deletion and AI-provider processing policies must be explicit. |
| `notifications/{notificationId}` | Collection is allowlisted by rules; persistent document schema is not established by the current notification builder | Current `buildNotifications` derives task/claim/renewal alerts in memory. Do not assume this is a persisted inbox. |
| `operations/{id}`, `operationEvents/{id}`, `operationAttachments/{id}`, `operationsEmailDirectory/{id}`, `rfqs/{id}` | Collections are in the Firestore tenant allowlist; field contracts require further writer/query audit | Preserve current data; document contracts before adding fields or migrations. |
| `platformSettings/global` | `branding`, `features`, `advertising`, `updatedBy`, `updatedAt` | Rules constrain accepted keys and value types. UI visibility settings are not access controls. |
| `organizationSubscriptions/{orgId}` | `organizationId`, `plan`, `status`, end-date and code-use fields | Subscription writes are constrained by rules; keep entitlement logic separate from tenant data. |
| `subscriptionCodes/{code}` | Code, plan/duration/status/creator and used-by metadata | Client redemption is restricted to an unused code and a matching active organization. |
| `pricingPlans/{planId}`, `clientCounters/{counterId}`, `ads/{adId}`, `onboardingProgress/{uid}`, `archives/{archiveId}` | Special rule blocks exist; full field contracts vary by feature | Do not generalize these as ordinary tenant business collections. |
 
## 3. Existing composite indexes

The current `firestore.indexes.json` defines 11 composite indexes:

1. `clients`: `organizationId ASC + createdAt DESC`
2. `policies`: `organizationId ASC + createdAt DESC`
3. `policies`: `organizationId ASC + clientId ASC`
4. `insurers`: `organizationId ASC + name ASC`
5. `claims`: `organizationId ASC + createdAt DESC`
6. `tasks`: `organizationId ASC + dueDate ASC`
7. `claims`: `organizationId ASC + clientId ASC`
8. `tasks`: `organizationId ASC + relatedType ASC + relatedId ASC`
9. `claimActivities`: `organizationId ASC + claimId ASC + createdAt DESC`
10. `leads`: `organizationId ASC + createdAt DESC`
11. `leadActivities`: `organizationId ASC + leadId ASC + createdAt DESC`

Add an index only when a real query requires it. The CI emulator suite should catch security regressions; query/index validation should also be performed against the emulator and deployment plan.

## 4. Current security baseline and gap

Current rules provide special handling for users, organizations/members, clients/timeline, platform settings, subscriptions, codes, pricing plans, counters, ads, onboarding progress and archives. Generic access is limited to an explicit allowlist of business collections and checks that the record's `organizationId` matches the active user's organization.

However, **same-organization access is not equivalent to role-based authorization**. The generic rule currently allows reads/writes broadly for active same-organization users in allowlisted collections (with narrower exceptions). Before production use of sensitive financial/medical modules, create a capability matrix and enforce role-specific read/create/update/delete rules in both Firestore and trusted server endpoints.

Required negative tests for each tenant collection:
- Org A cannot read a known Org B document by ID.
- Org A cannot query/read Org B records.
- Org A cannot create or update a record with Org B's `organizationId`.
- A user cannot change an existing record's `organizationId`.
- Inactive or profile-less users are denied.
- A role without a module capability cannot perform restricted writes.
- A client cannot grant itself or another user platform-admin privileges.

## 5. Proposed future entities — not yet deployed

Add only when a concrete feature is implemented and the schema/rules/indexes/tests are changed together.

| Proposed collection | Purpose | Required fields / controls |
|---|---|---|
| `auditLogs/{eventId}` | Append-only security and business audit trail | `organizationId`, actor UID/role, action, entity type/id, timestamp, request/correlation ID, minimal change summary. Backend writes only; no secrets or full medical text in logs. |
| `documentExtractions/{extractionId}` | Versioned Document AI output | `organizationId`, `documentId`, file hash/version, extraction schema version, model/provider version, fields with page/section evidence, confidence, review status, createdAt. |
| `coverageAssessments/{assessmentId}` | Insurance portfolio assessment snapshots | `organizationId`, `clientId`, source policy/document IDs and versions, coverage/limits/deductibles/exclusions, gaps with evidence, assumptions/data limitations, reviewer and status. |
| `medicalAnalysisRuns/{runId}` | Reproducible medical utilization analysis | `organizationId`, source dataset/report IDs and hashes, period, metric schema/version, deterministic aggregates, AI findings/evidence, data limitations, reviewer and retention metadata. Avoid unnecessary patient-level identifiers. |
| `integrationEvents/{eventId}` | Integration delivery and retry observability | `organizationId` where appropriate, integration/provider, event ID, idempotency key, status, attempts, timestamps and sanitized error code. Do not log bearer secrets or raw PII. |

These are proposals only. Do not create them in Firestore or allow them in generic rules until a reviewed migration and tests exist.

## 6. Migration strategy

1. Inventory all writers, readers, queries, rules and indexes for each existing collection.
2. Establish a typed contract and validation tests without changing existing field names.
3. Add new optional fields only with backward-compatible readers.
4. For any required migration, use a dry-run, idempotent batch/Cloud Function, progress marker, verification query and rollback plan.
5. Add rules and emulator tests before enabling a new collection in production.
6. Avoid moving current top-level collections into `organizations/{orgId}/...` in the first iteration; this would break existing routes, query code and integrations.
7. Review data retention, export and deletion semantics before storing AI outputs or sensitive medical data.
