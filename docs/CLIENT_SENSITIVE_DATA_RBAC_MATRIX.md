# Proposed Client Sensitive-Data RBAC Matrix

**Status:** design proposal for Phase 3 review. This matrix is not proof that the current runtime enforces these permissions. Any behavior change requires a separate code/rules PR, Emulator tests, staging acceptance and explicit release approval.

## 1. Non-negotiable authorization invariants

- Resolve Firebase Auth UID, active organization membership, role and capability from trusted records. Browser-supplied `organizationId`, role, assignment or relation IDs are selectors, not proof of authorization.
- Every access must pass tenant membership, resource relationship, action capability and—where applicable—record assignment checks in Firestore Rules and trusted endpoints.
- Platform Admin is operationally separate and has **no routine access to tenant content**. Support access, if later introduced, requires explicit authorization, a purpose, time limit and audit event.
- Firestore Rules do not redact selected fields from a document that the caller can read. Sensitive data must be moved to separately protected records only after readers/writers and a compatibility strategy are mapped.
- Deny direct client access to raw storage paths. Download/upload must use the document gateway, which independently verifies organization, relation, category, actor, file state and permitted operation.
- AI inherits the strictest classification of its source material. A summary or finding built from medical/KYC/family data cannot be exposed to a less-privileged role merely because it is AI-generated.
- Audit security-sensitive reads, exports, downloads, consent changes, role changes, AI processing and any exceptional access. Logs must not include raw PII, medical text, signed URLs or prompts.

## 2. Role definitions

| Role | Default scope |
|---|---|
| Owner | Organization administration and normal business operations; not blanket access to every sensitive category without purpose and audit. |
| Admin | Tenant administration and approved operational data; cannot grant self platform-admin privileges. |
| Broker | Assigned/authorized brokerage clients, policies, quotes and operations necessary for the brokerage task. |
| Sales | Assigned leads and minimal contact/needs data; no default KYC, family, medical, client financial-risk or claims narrative access. |
| Claims | Assigned/authorized claims and related policy/document material necessary for a claim; no unrelated client identity files or brokerage commission records. |
| Finance | Brokerage premium/commission/revenue/expense projections and payment status needed for finance work; no default medical/family/KYC access or broad client personal-finance data. |
| Staff | Explicitly assigned tasks and minimal linked records; no default access to sensitive profiles, medical data or free-form notes. |
| Platform Admin | Platform configuration/health/plans only. No routine tenant-content access. |

## 3. Sensitivity-class matrix

Legend: **Scoped** means same-organization and resource/assignment checks still apply. **Grant** means a separate, explicit, purpose-bound authorization is required and must be audited. **Deny** is the default until such a grant is implemented and reviewed.

| Data class | Owner | Admin | Broker | Sales | Claims | Finance | Staff | Platform Admin |
|---|---|---|---|---|---|---|---|---|
| Base client contact summary | Scoped | Scoped | Scoped | Assigned + minimal fields | Claim snapshot only; raw client record denied until a safe projection exists | Billing projection only | Assigned + minimal fields | Deny |
| Identity/KYC and national/tax IDs | Grant | Grant | Grant per task | Deny | Grant only if claim requires it | Deny | Deny | Deny |
| Family/dependents | Grant | Grant | Grant per documented purpose | Deny | Grant only if claim requires it | Deny | Deny | Deny |
| Medical/health profile | Grant; no blanket browse | Grant; no blanket browse | Grant per documented purpose | Deny | Claim-linked grant only | Deny | Deny | Deny |
| Client financial/risk fields (e.g. income/salary) | Grant | Grant | Grant per needs-assessment purpose | Deny | Deny unless claim-specific approved purpose | Deny by default | Deny | Deny |
| Brokerage finance (commissions/revenue/expenses) | Scoped | Scoped | Relevant policy commission scope | Limited quote preview only | Deny | Scoped | Deny | Platform aggregates only; no tenant ledger |
| Risk assessment / underwriting-like derived fields | Inherit source sensitivity | Inherit source sensitivity | Inherit source sensitivity | Deny if source is restricted | Inherit claim/source scope | Deny | Deny | Deny |
| AI findings and summaries | Inherit strictest source class | Inherit strictest source class | Inherit source scope | Only from permitted sales context | Only from permitted claim context | Finance-only aggregates where no sensitive source leak occurs | Only from permitted task context | Deny tenant details |
| Document metadata and file access | Gateway + category + relation checks | Gateway + category + relation checks | Gateway + client/policy relation | Only permitted lead/quotation categories | Claim-linked categories only | Finance categories only | Assigned task categories only | Deny routine content |
| Free-form notes / claim narratives | Manual classification first; otherwise deny | Manual classification first; otherwise deny | Manual classification first; otherwise deny | Deny until classified | Claim-scoped grant for claim narrative | Deny | Deny | Deny |

The matrix intentionally makes sensitive classes **deny by default**, including for Owner/Admin. A business owner or administrator may have a legitimate purpose for a specific record, but the role label alone must not bypass purpose, consent/legal basis, relationship scope or audit requirements.

## Current runtime gate — deny by default

As of the current `main` baseline, the proposed `clientSensitiveProfiles`, `clientMedicalProfiles`, `claimSensitiveDetails`, `aiFindings` and `auditLogs` collections are not in the generic tenant-business allow-list. Client SDK access must remain denied until a separate, reviewed Rules/endpoint implementation adds collection-specific validation. Do not add these collection names to the generic allow-list as a shortcut.

The Phase 3 Emulator regression suite asserts that Owner, Broker, Sales, Claims, Finance, Staff and an owner from another organization are denied direct gets, tenant queries and creates for each proposed collection. These checks protect the proposed collections' default-deny boundary; they do not grant runtime access.

**Interim Claims restriction:** Claims users are denied direct reads, queries and timeline reads on the legacy `clients/{clientId}` record because that document still mixes contact, identity, medical/family, financial and narrative fields. The Claims workspace uses the client/policy snapshot already recorded on the claim and claim-category document metadata. A dedicated safe client-summary projection is a future dependency; do not re-enable raw client access merely to restore a Client 360 link.

## 4. Record and endpoint enforcement

Every read/write path must be checked in both the direct database and trusted service surfaces where applicable.

1. **Firestore Rules:** test direct gets, list/query, create, update and delete; verify immutable `organizationId`, user ownership and same-tenant parent relationships. For sensitive collections, do not rely on a broad collection-wide allow rule.
2. **Trusted endpoints/Functions:** validate Firebase ID token, active membership, capability, record relationships and any explicit sensitive-data grant before loading data or assembling AI prompts. Service-account privileges do not replace authorization checks.
3. **Document gateway:** accept a document/attachment ID—not an arbitrary bucket/path/URL from the browser. Re-resolve storage metadata server-side and reject cross-tenant, wrong-category, wrong-owner and expired/deleted records.
4. **AI/Copilot:** build context only from authorized projections. Evidence links must be permission-checked at display time. Refuse to summarize data the caller cannot directly access.
5. **Exports/deletion:** apply the same class/tenant access checks, include audit, record retention/legal holds and distinguish deleting a client profile from deleting insurance/legal records subject to retention.

## 5. Required negative tests before migration

- User A cannot read organization B data by list, query or known document ID.
- Sales/Staff/Finance cannot access medical, family, KYC and restricted narrative collections.
- Claims access is limited to assigned/authorized claim relationships and permitted document categories.
- A record referencing a client, policy, claim or document in another organization is denied.
- A caller cannot manufacture a sensitive grant, change assignment/organization, self-elevate role or mutate immutable ownership fields.
- AI cannot receive or reveal fields that the caller could not read directly.
- A signed URL or storage path cannot bypass authorization; generated URL is short-lived and never persisted as a reusable token.
- Audit writes are server-controlled and immutable to normal client roles.

## 6. Implementation sequence

1. Review the latest privacy-safe inventory and proposal-only separation plan locally.
2. Resolve manual review items, unknown/unclassified paths and all mixed-sensitivity parent objects with the data owner.
3. Inventory every reader/writer of `clients`, `individual`, `corporate`, `riskData`, `riskAssessment`, `aiAnalysis`, notes and document-reference fields.
4. Finalize legitimate purpose, legal basis/consent, role capabilities, retention, export/delete and source-of-truth for each class.
5. Implement new read adapters/projections and collection-specific Rules on a separate PR, with Emulator denial tests. Do not remove old fields yet.
6. Run a dry-run migration manifest with source/target counts, reference checks, idempotency, retry/resume and rollback; production writes require separate approval.
7. Migrate only after staging acceptance; verify both old/new readers, counts and access denials before a separately approved cleanup of old fields.

This is an engineering access-control proposal, not a legal certification of compliance with Egypt's Personal Data Protection Law No. 151/2020.
