# P1-E — Manual Client Reader/Writer Reconciliation (First Pass)

**Date:** 2026-11-07  
**Candidate baseline:** `main` at `400000dda9b3a990b325454cf5de88daa5aa03a7`  
**Scope:** repository source only; no Firebase, Firestore, Storage, customer records or secrets were accessed.

## Static inventory evidence

The CI run on the candidate baseline analyzed 243 source files and identified 94 files with client/data-related signals, 13 client collection-reference candidates, 10 read-operation candidates, 8 write-operation candidates and 6 mixed read/write candidates. These are heuristic counts and overlap; they are not counts of unique production operations. The report explicitly labels classifications as file-level signals, not proven call-site data flow.

## Manually reviewed production paths

| Path | Observed behavior | Disposition |
|---|---|---|
| `src/pages/ClientsPage.tsx` → `listClientSummaries` | The Clients index calls the compatibility adapter. The adapter filters on the caller's organization and projects the returned document to a base-summary allowlist. | Retain. The projection occurs after the legacy Firestore read; it is not field-level authorization. |
| `src/pages/ClientDetailsPage.tsx` → `getLegacyClientWorkspace` | Client 360 calls the compatibility adapter. It preflights active profile, organization and Owner/Admin/Broker role, then reads the legacy client document. | Retain for backward compatibility only. The permitted browser still receives the mixed-sensitivity root document; migrate only after an approved trusted projection path and parity tests exist. |
| `src/pages/ClientWizardPage.tsx` → `createExtendedClient` | Client creation writes one root `clients` document containing base contact data plus individual/corporate profile, address, national-ID/signatory identifier, needs, risk data, document metadata, risk assessment, preferences and notes. | Confirmed mixed-sensitivity legacy writer. Keep unchanged until separately protected destination collections and rollback-safe migration are approved. |
| `src/pages/ClientWizardPage.tsx` → `saveClientAiAnalysis` | AI analysis is written back to `clients/{clientId}.aiAnalysis`. | Confirmed derived-data writer. AI findings inherit the strictest source class; keep default-denied in any future separated projection until provenance/classification is enforced. |
| `src/features/clients/client.service.ts` → `listClients`, `getClient` | Deprecated exports still read full legacy client records without the newer adapter preflight. | Compatibility risk remains. These exports are still present; this review did not prove that every indirect/import-based consumer is absent. Do not remove until a complete import/call-graph check and parity tests pass. |
| `src/features/clients/client.service.ts` → `activateIssuedClientV978` | Reads a client by ID and checks its organization ID after retrieval. | Legacy read; caller inventory and necessity must be confirmed before removal. The function is not an authorization boundary by itself. |
| `src/features/clients/client-edit.service.ts` → `updateClientProfile` | Updates name, type, status, phone, email, city, address and free-form notes on the root client document. Firestore Rules enforce same-tenant and Owner/Admin/Broker role, but the client-side helper itself does not prove assignment or parent scope. | Confirmed legacy writer. Notes remain manually classified; preserve compatibility, but do not treat client-side arguments as authorization. |
| `functions/src/copilot/context-builder.ts` → Client Details context | Reads a same-organization client using the verified handler scope and Firestore field projection `organizationId`, `type`, `status`; related policy/claim/task context is queried separately and field-mapped. | Restricted summary reader. Keep the projection allowlist and role checks; never remove the Firestore `.select(...)` constraint or broaden the returned client fields without review. |
| `src/pages/AdminUserDetailsPage.tsx` | Requests `getCountFromServer` for the target organization's client collection; it does not map or return client document fields. The Platform Admin path is not included in the legacy client Rules allowlist. | Aggregate-only candidate; expected to fail closed for Platform Admin. It does not justify granting Platform Admin access to tenant client records. |
| `src/features/clients/client-data-access.service.ts` | Exposes the two adapter read paths above; it reads from the legacy root collection and applies the base projection only after Firestore returns the document. | Existing compatibility boundary, not a sensitive-data split. |

## Findings and false-positive dispositions

- Route strings such as `/clients/:id` in `src/App.tsx` are navigation references, not direct Firestore collection operations.
- Tokens such as `individual`, `corporate`, `documents` and `notes` appear in forms, type declarations and display components. Their presence alone does not establish a database read or write.
- The `AdminUserDetailsPage` client signal is a count aggregation, not a read of client field values. Rules still decide whether the query is allowed.
- Files that contain Firestore operations and sensitive-field names but no detected client collection reference were not counted as proven client readers/writers.
- The static scanner's `fullDocumentSnapshotSpread` flag is a file-level signal. It requires exact import/data-flow tracing before it can be assigned to a specific production call.

## Still unresolved — do not mark P1-E closed

1. The legacy client writer and full-document read path remain live. The compatibility path is intentionally preserved but does not provide field-level isolation.
2. Complete repository-wide import/call-graph tracing is still required for deprecated exports, wrapper functions, aliases and dynamic paths. GitHub code-search results were incomplete and were not treated as proof of no callers.
3. Assignment checks and parent relationship checks need to be reconciled for every operation, not inferred from a browser's `organizationId` or `clientId`.
4. Field-level purpose, lawful basis, retention, export/deletion and data-owner decisions remain separate sign-off items.
5. The new role resolver only provides eligibility for a separate approved grant. It is not wired into a sensitive reader; proposed sensitive collections remain default-denied.

## Safety

No live customer data inventory, customer document read, Firestore Rules change, migration, secret/configuration change, storage operation, deployment or billing operation was performed.

## 2026-11-09 — Additional list-reader reconciliation

A source search after the initial review found two production UI consumers of the deprecated full-record `listClients` export that were not listed in the first-pass table:

| Path | Change | Disposition |
|---|---|---|
| `src/pages/OperationsPage.tsx` | Replaced the deprecated list call and `InsuranceClient[]` in-memory state with `listClientSummaries(profile)` and `ClientBaseSummary[]`. The page and its client chooser only use base-summary fields. | Migrated to the compatibility adapter; no role or Rules grant was added. |
| `src/features/policies/PolicyForm.tsx` | Replaced the deprecated list call and full-record state with `listClientSummaries(profile)` and `ClientBaseSummary[]`. The form only uses client ID and name to select and create a policy. | Migrated to the compatibility adapter; no role or Rules grant was added. |

`npm run test:client-data-access-projection` now asserts that both paths use the adapter and do not import the deprecated list export. This reduces the data retained by these UI paths and runs the adapter's role/active-user/tenant preflight. It does **not** prevent the authorized Firestore read from returning the legacy root document before projection, and it does not complete the sensitive-data split.

A repository-wide textual search found no remaining production imports/calls of `listClients`; its deprecated export remains for compatibility. The legacy `createExtendedClient` mixed-sensitivity writer, `saveClientAiAnalysis`, `updateClientProfile`, and full-record Client 360 path remain unresolved. This is targeted call-site evidence, not proof against dynamic imports or all indirect data flows.

### Direct-reference classification

The latest heuristic report flags 13 source files with direct `clients` collection/subcollection references. The following source review classifies those signals:

| Path | Verified operation | Disposition |
|---|---|---|
| `functions/src/copilot/context-builder.ts` | Same-organization Client Details query selects only `organizationId`, `type` and `status`; the callable handler supplies verified membership/role scope. | Retain the field projection; no client profile fields enter Copilot context. |
| `src/features/clients/client-data-access.service.ts` | Reads the legacy root, preflights active Owner/Admin/Broker scope, and projects summaries/workspace afterward. | Compatibility boundary only; root document still reaches authorized browser memory. |
| `src/features/clients/client-edit.service.ts` | Writes base fields and free-form notes to the legacy root; it does not independently authorize the caller. | Rules remain the authority (same-tenant Owner/Admin/Broker, immutable organization); notes classification and field split remain open. |
| `src/features/clients/client.service.ts` | `createExtendedClient` writes mixed identity/contact/risk/document/notes data; `saveClientAiAnalysis` writes derived AI data; `getClient` and `listClients` are deprecated; `activateIssuedClientV978` only verifies tenant after reading. | Preserve compatibility pending protected destinations and call-site proof. No production `listClients` callers remain; no `activateIssuedClientV978` caller was found. AI findings inherit source sensitivity and remain on the legacy root. |
| `src/features/clients/timeline.service.ts` | Appends events and reads the client timeline subcollection; Rules enforce parent tenant and Owner/Admin/Broker and deny update/delete. | Retain current append-only behavior; arbitrary event metadata still needs data-classification review. |
| `src/features/dashboard/dashboard.service.ts` | Uses `getCountFromServer` on the tenant-filtered client query; no client fields are projected. | Aggregate only; Rules restrict client access to Owner/Admin/Broker, so unsupported roles fail closed. |
| `src/features/documents/legacy-client-documents.service.ts` | Reads the entire legacy root to project embedded document metadata, then requests a fresh gateway URL. Claims previously passed a local preflight even though root Client Rules deny that role. | Fixed: Claims now receive no embedded legacy references before any restricted client read; their existing independently authorized claim/document paths remain unchanged. Other roles were not broadened. |
| `src/features/leads/lead.service.ts` | The lead conversion transaction verifies the lead and linked client's organization, creates a contact/prospect client and appends a timeline event. The UI gates conversion to Client 360 roles. | Same-tenant workflow retained; it writes into the legacy client record, and field separation remains open. |
| `src/features/operations/operations-v80-foundation.service.ts` | Creates a mixed-sensitivity client through `createClient`; on subsequent document-upload failure it attempts compensating client deletion. | Existing workflow retained; no authorization change. Legacy write and rollback recovery remain part of the future migration plan. |
| `src/features/policies/policy-lifecycle.service.ts` | Appends a policy-renewal event to the client timeline. | Parent-path Rules enforce same tenant and role; event metadata requires continued classification. |
| `src/features/quotes/quote.service.ts` | Quote issuance transaction reads the client, checks organization and RFQ/client relationships, activates the client and appends a timeline event. | Tenant and relation checks remain; browser Rules are still the authorization boundary and the root read is mixed-sensitivity. |
| `src/features/rfq/rfq.service.ts` | RFQ creation reads the client and optional lead in a transaction, checks tenant and client relationship, then appends timeline/follow-up data. | Tenant and relation checks remain; source transaction does not provide field-level projection or independent authorization. |
| `src/pages/AdminUserDetailsPage.tsx` | Platform Admin requests an organization-filtered client count only. | No client fields are returned; generic Rules explicitly exclude `clients`, so no blanket Platform Admin client access is granted. |

This closes classification of the current scanner's 13 direct-reference file signals, not every indirect/dynamic call path or the owner/legal decisions. Assignment-specific grants are not represented by these file-level checks and remain subject to the approved RBAC matrix.
