# Client Data-Access Compatibility Audit — Phase 3

**Status:** static source inventory and query-minimization guard. This document is not proof of runtime authorization and does not authorize a migration.

## Verified current-state findings

The following paths were inspected on `main` before this change:

| Source | Current behavior observed | Phase 3 implication |
|---|---|---|
| `src/features/clients/client.service.ts` | `createClient` spreads the legacy input into `clients`. `createExtendedClient` writes `individual`, `corporate`, `nationalId`, `riskData`, `documents`, `riskAssessment` and `notes` into a single client document. `listClients` and `getClient` return full document data. `saveClientAiAnalysis` updates `aiAnalysis` on the same record. | The current write and read paths must be moved together; adding new collections alone will not separate existing data. A summary projection is needed for broad lists. |
| `src/features/clients/client-edit.service.ts` | Updates contact fields and free-form `notes` together in `clients`. | Notes require their own classification and must not be silently copied into the general contact summary. |
| `src/features/clients/client.types.ts` | Individual/corporate profile types include national/tax identifiers and income fields; health/life risk types include chronic conditions, medications, surgeries, smoker/health status, dependents and salary. Client records also type embedded documents and AI analysis. | Split by field leaf and sensitivity class, not by parent object alone. |
| `src/features/documents/client-documents-v8.service.ts` | The list function queried tenant documents and then filtered the returned metadata by client relation in memory. | The query is now server-scoped by `organizationId`, `relatedType=client` and `relatedId=clientId`; required composite indexes are added in this change. This reduces unnecessary metadata retrieval but is **not** a substitute for relation-aware Firestore Rules. |
| `src/features/documents/legacy-client-documents.service.ts` | Reads a client document and derives legacy embedded document metadata; it does not return the embedded stored URL in its result and asks the gateway for a fresh temporary URL. | The reader must eventually consume a separately authorized client/document projection; keep legacy compatibility read-only until reference reconciliation succeeds. |
| `src/features/ai/client-insurance-analysis.service.ts` | Reads client-linked policies, claims and tasks by organization and client identifiers. | Its input projection, relation checks and medical-data minimization must be included in the final compatibility review. |

## Implemented in this PR

1. Add `scripts/client-data-access-audit.mjs`, a local/static heuristic source inventory for `src`, `functions/src` and `supabase/functions`.
2. Report only file paths, Firestore operation names, sensitive field identifiers and stable finding codes. Do not inspect cloud projects, environment variables, customer records or source-file literal values.
3. Add synthetic regression tests that prove sensitive sentinel values do not enter audit output.
4. Add a guard for the client-document list query so relation filtering happens in Firestore instead of after a broader tenant-level result has been downloaded.
5. Add composite indexes for organization + client-document relationship, including the claims-category query.

## Authorization limits

- The static audit is heuristic and does not perform AST/data-flow analysis.
- Query minimization does not prevent direct gets by known document ID where Firestore Rules allow them.
- The existing `clients` document still contains legacy sensitive fields. This PR does not migrate, delete, redact or rewrite any customer data.
- Proposed collections remain default-denied. Do not add them to the generic tenant allow-list.
- A future runtime split needs a separate collection-specific Rules/endpoint PR, read/write adapter changes, Emulator tests for every role and relation, staging acceptance, a reversible migration plan and separate production approval.

## Next gate

Use the audit output to close the caller inventory. Then implement an additive read adapter with synthetic fixtures, define the exact role/capability grant model for sensitive collections, and test direct reads/queries/writes before any migration writer is introduced.
