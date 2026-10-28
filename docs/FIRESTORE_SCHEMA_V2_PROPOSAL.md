# Firestore Schema v2 — Proposal, Not Yet Applied
**Purpose:** target schema for multi-tenant brokerage operations and Phase 3 sensitive-data separation. Existing production records are not migrated by this proposal.

## 1. General conventions
- Prefer top-level collections for existing application compatibility and query patterns; every organization-owned record carries an immutable `organizationId`.
- Each record carries `createdAt`, `updatedAt`, `createdBy`, `updatedBy`, and where lifecycle matters `status`/state history.
- Every client-supplied relationship ID must be checked against a parent record from the same organization by Rules or trusted endpoint. A field named `organizationId` supplied by the browser is not proof.
- Use random document IDs; avoid embedding names, phone numbers, national IDs, emails or medical values in document IDs or object paths.
- Treat this schema as additive. No fields are to be renamed, removed, or backfilled until the inventory, compatibility plan, emulator tests and rollback are reviewed.

## 2. Collections and canonical fields

| Collection / path | Core fields | Relationship and sensitivity |
|---|---|---|
| `organizations/{organizationId}` | `name, type(individual/office/company), ownerId, status, planId, locale, timezone, createdAt, updatedAt` | tenant root; owner immutable except governed transfer |
| `organizations/{organizationId}/members/{uid}` | `uid, role, status, displayName, invitedBy, joinedAt, createdAt, updatedAt` | membership relation; canonical role source must be consistent with current user profile during transition |
| `organizations/{organizationId}/invitations/{invitationId}` | `invitedEmail, role, status, expiresAt, createdBy, acceptedBy, acceptedAt` | single-use invitation; email verified; expire/replay tests |
| `users/{uid}` | `email, displayName, phone, organizationId, role, status, acceptedInvitationId, createdAt, updatedAt` | identity/profile; no platform-admin grant via client |
| `clients/{clientId}` | `organizationId, clientType, displayName, phone, email, sector, occupation, assignedTo, lifecycleStatus, createdAt, updatedAt` | base profile only; no national ID, family details, medical history or claim narrative |
| `clientSensitiveProfiles/{clientId}` | `organizationId, clientId, sensitivityClass, encryptedOrTokenizedFields, legalBasisRef, consentRef, retentionClass, createdAt, updatedAt` | sensitive identity/KYC/family records; narrow authorization; schema by sub-class recommended |
| `clientMedicalProfiles/{clientId}` | `organizationId, clientId, normalizedMetrics?, authorizedMedicalMetadata?, legalBasisRef, retentionClass, createdAt, updatedAt` | special-category health-related records; default deny; avoid storing diagnosis if not needed |
| `leads/{leadId}` | `organizationId, source, externalLeadId, name, phone, email, companyName, productInterest, stage, expectedPremiumMinor, currency, probabilityBps, assignedTo, nextActionAt, consentRef, idempotencyKey, createdAt, updatedAt` | CRM; unique dedupe implemented by trusted endpoint/query lock pattern |
| `leadActivities/{activityId}` | `organizationId, leadId, actorUid, type, summary, happenedAt, createdAt` | non-sensitive activity summary; validate lead parent |
| `clients/{clientId}/timeline/{eventId}` | `organizationId, clientId, eventType, referenceType, referenceId, actorUid, summary, happenedAt` | append-only event; avoid free-form sensitive content |
| `quotes/{quoteId}` | `organizationId, clientId, leadId?, insurerId, productId, version, premiumMinor, feesMinor, currency, coverageSnapshotRef, status, validUntil, createdAt, updatedAt` | quote history; validate relationships |
| `policies/{policyId}` | `organizationId, clientId, insurerId, productId, policyNumber, startDate, expiryDate, premiumMinor, commissionRateBps, commissionMinor, currency, status, assignedTo, createdAt, updatedAt` | policy summary; detailed coverages/exclusions as subrecords/snapshot |
| `policyCoverageItems/{coverageItemId}` | `organizationId, policyId, label, limitMinor?, subLimitMinor?, deductibleMinor?, currency, conditionsSummary, sourceDocumentId, sourcePage?, createdAt` | evidence-linked extracted facts; not legal conclusion |
| `claims/{claimId}` | `organizationId, clientId, policyId, insurerId, claimNumber, claimType, status, claimedAmountMinor, settledAmountMinor?, currency, incidentAt?, submittedAt?, nextActionAt?, assignedTo, createdAt, updatedAt` | validate policy/client/organization consistency; narrative in narrow record |
| `claimSensitiveDetails/{claimId}` | `organizationId, claimId, incidentNarrative?, medicalNarrative?, authorizedNotes?, legalBasisRef, createdAt, updatedAt` | narrower claims access; never bundled into broad claim list |
| `claimActivities/{activityId}` | `organizationId, claimId, actorUid, eventType, fromStatus?, toStatus?, note?, eventAt, createdAt` | append-only; validate state transitions in trusted endpoint |
| `documents/{documentId}` | `organizationId, category, relatedType, relatedId, storageProvider, storageBucket, storagePath, storageKeyVersion, size, contentType, checksum?, fileName, uploadedBy, lifecycleStatus, expiresAt?, createdAt, updatedAt` | metadata only; private object; no signed URL |
| `operationAttachments/{attachmentId}` | `organizationId, operationId, storageProvider, storageBucket, storagePath, storageKeyVersion, size, contentType, uploadedBy, uploadState, createdAt` | compatibility resource; migrate only after inventory and reference reconciliation |
| `renewals/{renewalId}` | `organizationId, policyId, clientId, dueDate, windowDays, state, assignedTo, lastContactAt?, nextActionAt?, createdAt, updatedAt` | should be idempotently derived/linked to policy lifecycle |
| `tasks/{taskId}` | `organizationId, type, title, description?, relatedType?, relatedId?, assignedTo, dueAt?, status, priority, completedAt?, createdAt, updatedAt` | validate relationship and role; description must not become a sensitive-data loophole |
| `insurers/{insurerId}` | `organizationId?, name, insurerCode?, contacts[], productRefs[], commissionTermsRef?, status, createdAt, updatedAt` | decide shared catalogue vs organization-owned records explicitly |
| `commissions/{commissionId}` | `organizationId, policyId, clientId, insurerId, premiumMinor, rateBps, commissionMinor, receivedMinor, outstandingMinor, currency, expectedAt?, receivedAt?, status, createdAt, updatedAt` | finance role boundary; calculations validated in trusted code |
| `revenue/{revenueId}` | `organizationId, type, amountMinor, currency, sourceType?, sourceId?, status, bookedAt, createdAt` | financial |
| `expenses/{expenseId}` | `organizationId, category, amountMinor, currency, vendor?, incurredAt, status, receiptDocumentId?, createdAt, updatedAt` | financial; receipt link must remain tenant-scoped |
| `medicalImportJobs/{jobId}` | `organizationId, sourceFileDocumentId, status, fileHash?, rowCount?, rejectedRowCount?, mappingVersion, requestedBy, startedAt?, completedAt?, errorCode?, createdAt` | private job; no medical row values in logs/errors |
| `medicalClaims/{rowId}` | `organizationId, importJobId, pseudonymousMemberKey, serviceMonth, categoryCode, providerCode?, diagnosisCategory?, claimCostMinor, currency, frequency, sourceRowHash?, createdAt` | sensitive aggregated/row-level data; access confined to designated medical analytics capability |
| `medicalReports/{reportId}` | `organizationId, importJobId, periodStart, periodEnd, metrics, methodologyVersion, dataQuality, generatedAt, generatedBy` | aggregate reports; suppress small groups where re-identification risk exists |
| `coverageAssessments/{assessmentId}` | `organizationId, clientId, sourceDocumentIds[], facts[], findings[], gaps[], assumptions[], limitations[], reviewerUid?, status, createdAt` | advisory findings with evidence anchors |
| `aiJobs/{jobId}` | `organizationId, feature, inputRefs[], inputVersionRefs[], status, providerClass, promptVersion, redactionVersion, requestedBy, startedAt?, completedAt?, errorCode?, createdAt` | job metadata only; never store keys/raw logs |
| `aiFindings/{findingId}` | `organizationId, feature, resourceType, resourceId, findingType, summary, evidenceRefs[], observedValues?, calculationMethod?, confidenceLabel?, limitations[], humanReviewStatus, reviewerUid?, createdAt` | provenance and review required |
| `copilotConversations/{conversationId}` | `organizationId, userId, title?, createdAt, updatedAt` | current user/tenant access only |
| `copilotMessages/{messageId}` | `organizationId, conversationId, userId, role, redactedContent, evidenceRefs[], createdAt` | apply retention policy; avoid storing unnecessary raw PII |
| `notifications/{notificationId}` | `organizationId, recipientUid, type, resourceType?, resourceId?, dueAt?, readAt?, createdAt` | recipients scoped; no sensitive payload duplication |
| `auditEvents/{eventId}` | `organizationId, actorUid, action, resourceType, resourceId, outcome, occurredAt, requestId, metadataAllowlist` | append-only trusted writer; do not log contents/tokens |
| `integrations/{integrationId}` | `organizationId, name, scopes[], credentialVersion, status, lastUsedAt?, createdBy, createdAt` | store only credential reference/version, never plaintext secret |
| `integrationEvents/{eventId}` | `organizationId, integrationId, source, externalEventId, idempotencyKey, acceptedAt, resultCode` | replay/deduplication and audit, no credential |
| `platformSettings/{settingId}` | `settingKey, value, updatedBy, updatedAt` | platform-admin only; split tenant data from platform control plane |
| `planCatalog/{planId}` | `name, features, status, limits?, createdAt, updatedAt` | platform admin controls catalog; entitlement values never override tenant rules |
 
## 3. Important schema caveats

1. This is a target proposal, not a statement that all collections exist or all fields are implemented.
2. Existing code already uses collection names such as `users`, `organizations`, `clients`, `policies`, `claims`, `documents`, `operationAttachments`, `leads`, `tasks`, `notifications`, `insurers`, `revenue`, `expenses`, `commissions`, Copilot collections and operations-related collections. Reconcile each current shape before modifying it.
3. The current rules and frontend may use root-level collections; do not move to nested collection paths without a dual-read/write plan and migration compatibility.
4. Firestore indexes must be authored from real query patterns. Add composite indexes only for queries that are actually implemented. Validate all production query shapes under the emulator.
5. Firestore Rules are not filters: list queries must include compatible constraints and the records must be provably authorized. Do not add broad platform-admin bypasses.
6. Firestore has no uniqueness constraints. Idempotency/deduplication needs a transaction/lease document or trusted idempotency service, with contention and retry handling.
7. Encryption-at-rest from the provider does not replace application-level separation/access controls or legal review. If encryption of specific fields is required, document where keys live, who can decrypt, rotation and recovery before implementing.
8. Medical reports should use aggregate-first outputs, suppressing low-count cohorts where individual inference may occur. Do not send raw medical files to an AI provider until policy review approves purpose, legal basis, provider terms, data retention and redaction.
