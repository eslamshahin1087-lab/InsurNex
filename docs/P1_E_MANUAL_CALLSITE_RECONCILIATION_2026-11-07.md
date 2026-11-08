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

## 2026-11-08 — Follow-up call-site reconciliation

The following updates were confirmed by direct source inspection. PR references identify unmerged candidates; they are not statements about the current production runtime.

| Path / symbol | Current source consumer evidence | Disposition |
|---|---|---|
| `src/features/clients/client.service.ts` → `createClient` | Used by the legacy `src/features/clients/ClientForm.tsx` and by `src/features/operations/operations-v80-foundation.service.ts` when creating an operations client before document upload. | Retain. Both are active creation paths; changing the writer requires compatibility and rollback coverage. |
| `createExtendedClient` / `saveClientAiAnalysis` | `src/pages/ClientWizardPage.tsx` uses both. | Retain. The wizard remains a confirmed writer of the mixed-sensitivity legacy client root; no field migration is included. |
| `updateClientProfile` | `src/features/clients/ClientEditForm.tsx` imports and calls it. | Retain. It is a confirmed legacy writer. |
| `getLegacyClientWorkspace` | `src/pages/ClientDetailsPage.tsx` uses it after the existing Owner/Admin/Broker preflight. | Retain with the current role boundary. This still returns the authorized legacy root object; it is not field-level authorization. |
| `listClientSummaries` | Used by `src/pages/ClientsPage.tsx`; the current Operations and PolicyForm candidates use it as well. | Prefer this projection for base client selectors and UI state. It remains a post-read allowlist projection over the legacy document. |
| `listClients` | The previously reviewed PolicyForm and Operations consumers have separate candidate changes: PR #142 switches Operations to `listClientSummaries`; PR #146 switches PolicyForm to `listClientSummaries`. `ClientForm` is a create-only consumer and does not use this list function. | Do not remove yet. Re-run a complete repository call-graph once all candidates are merged; current code search is not reliable enough to prove there are no other indirect imports. |
| `getClient` / `activateIssuedClientV978` | No direct consumer was identified in the manually inspected client, lead, policy, RFQ, quote, operations and page files in this pass. | Keep the deprecated exports until an exhaustive import/call-graph check proves they are unused. Absence from this manual sample is not proof of no consumer. |
| `src/pages/OperationsPage.tsx` | PR #142 candidate gates client/RFQ sources by role, removes an unused Claims preload from `OperationsSnapshot`, and passes `ClientBaseSummary` into Operations UI state. | Candidate privacy minimization only. Firestore reads still authorize access to the legacy root and the projection occurs after the read; Claims still must not be granted raw Client 360 access. |
| `src/pages/AdminUserDetailsPage.tsx` | PR #141 candidate removes aggregate reads against tenant clients/policies/claims/leads from the Platform Admin user-details surface. | Candidate correction to maintain Platform Admin separation; business aggregates show unavailable rather than a false zero. |

### Confirmed limits of this follow-up

- This pass inspected the identified source consumers directly, including current form/page/service paths. It did not establish a whole-repository AST/import graph or prove that every dynamic, aliased, barrel-exported or indirect consumer is absent.
- Search results from the connected GitHub code-search tool were empty for this repository and were not treated as evidence of absence.
- The Operations and PolicyForm projections do not change Firestore Rules and do not prevent the permitted reader from receiving the full legacy document at the database boundary.
- No proposed sensitive collection was enabled, no legacy document migrated, and no customer data or secrets were accessed.
- PR #141, #142 and #146 were open review candidates at the time of this note; their merge status must be rechecked before treating the candidate behaviors as part of `main`.

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
