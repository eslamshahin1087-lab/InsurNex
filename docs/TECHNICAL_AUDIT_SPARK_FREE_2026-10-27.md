# InsurNex Technical Audit — Spark / Free-Only Baseline

**Audit date:** 2026-10-27  
**Audited Git reference:** `main` at `74cb0d8d022009f0a5dc20675ecb72173423a80e`  
**Branch created for this review:** `audit/insurnex-spark-free-tier-20261027`  
**Scope:** Repository source and configuration review only. No live Firebase/Supabase console access, production invocation, local build, or deployment was performed.

## Executive summary

InsurNex already has a meaningful React/Vite + TypeScript foundation: Firebase Authentication, Firestore business collections, an RTL PWA, a set of tenant-scoped Firestore rules/indexes, a document-storage gateway in Supabase, server-side AI code, and an iNex lead-ingestion function.

The current repository is **not yet compatible with the owner's stated "Firebase Spark + zero-paid AI + free plans only" constraint without targeted changes**. In particular, the existing Firebase Cloud Functions and direct Firebase Storage upload path conflict with Spark restrictions; AI currently calls Anthropic; two document-storage paths coexist; the current iNex receiver does not match the requested receiving identity; and generic Firestore rules do not yet enforce the complete per-role capability matrix.

The local working branch reported by the owner, `fix/insurnex-exact-logo-20261027-191234`, was not present in the GitHub branch list inspected for this audit. The audit therefore describes the published GitHub `main` baseline, not a claim that the owner's clean local working tree is identical. Do not overwrite that local branch or treat this audit branch as a replacement for it.

## What is already present

- **Frontend:** React 19, TypeScript, Vite, React Router and existing feature/page modules.
- **PWA:** Arabic/RTL manifest and a service worker intentionally limited to static assets; it does not intentionally cache private customer or policy data.
- **Identity / data:** Firebase Authentication and Firestore, with top-level business collections and an `organizationId` convention.
- **Security tests:** A Firestore emulator test script exists at `scripts/firestore-rules-test.mjs`; the root `package.json` does not currently expose it as a named npm script.
- **Document access gateway:** `supabase/functions/document-storage/index.ts` verifies Firebase ID tokens, checks the active organization and client record, and issues signed storage operations.
- **AI:** Firebase callable functions exist for medical portfolio analysis and Copilot; secrets are intended to remain server-side.
- **Lead integration:** `functions/src/index.ts` implements a POST-only authenticated iNex lead-ingestion handler with payload validation and transaction/idempotency logic.

## Priority findings

### P0 — Hosting real private documents is incompatible with Firebase Spark Storage

The repository has a direct Firebase Storage path in `src/features/documents/document.service.ts` using `uploadBytes`, `getDownloadURL`, and `deleteObject`. `firebase.json` does not configure a Firebase Storage rules file. Current Firebase documentation says Cloud Storage for Firebase requires the Blaze plan; on Spark, buckets are inaccessible, with the stated requirement in effect from 2026-02-03.

**Decision for the free-only MVP:** select one canonical document provider. The existing Supabase Storage + signed-operation gateway is the most plausible no-cost pilot path, subject to confirming the actual Supabase project's status, storage configuration, quotas, privacy terms and inactivity behavior. Refactor all document callers to use the gateway, remove no path until every reader/writer is inventoried, and stop persisting reusable public-style download URLs in Firestore metadata. Use short-lived signed download URLs and server-side authorization checks.

Official reference: https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024

### P0 — Firebase Cloud Functions cannot be the deploy target while remaining on Spark

`firebase.json` configures the `functions` source, and `functions/src/index.ts` uses Firebase Functions v2, Secret Manager parameters and the Anthropic SDK. Firebase documents Cloud Functions access/deployment under Blaze, not Spark.

**Decision:** do not plan to deploy or update Firebase Functions under the stated Spark constraint. For a free-only pilot, evaluate migration of the small trusted HTTP endpoints to the existing Supabase Edge Function gateway, or an already-approved free serverless endpoint. Keep Firebase Auth and Firestore as the identity/system-of-record foundation. Any service-account credential used by an external edge function must be stored only as a server secret, scoped narrowly, rotated, and never shipped to the browser. Do not commit secrets to this repository.

Official reference: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans

### P0 — Current AI implementation is not free-only

`functions/package.json` depends on `@anthropic-ai/sdk`; `functions/src/index.ts` defines `ANTHROPIC_API_KEY` and `CLAUDE_MEDICAL_MODEL`; Copilot also uses the Anthropic SDK. This is not a guaranteed no-cost implementation.

Firebase AI Logic with the Gemini Developer API offers a free tier on Spark, subject to model-specific quotas. The free Gemini tier states that submitted content may be used to improve Google products; the paid tier states the opposite.

**Safety decision:** no real identifiable client documents, medical reports, patient/member names, national IDs, diagnosis-level records, or confidential policy text should be sent to a consumer free-tier AI endpoint. The free-only MVP can run deterministic calculations and local extraction, plus optional AI for public/general or sufficiently de-identified low-sensitivity content after a data-handling review. Medical and document AI that needs sensitive source content stays disabled for production until a suitable provider/data-processing arrangement is approved. No medical diagnosis or autonomous underwriting/claims decisions.

Official references:
- https://firebase.google.com/docs/ai-logic/pricing
- https://ai.google.dev/gemini-api/docs/pricing

### P0 — Tenant membership is enforced more consistently than job-role capabilities

In `firestore.rules`, the generic allowlisted-collection rule primarily checks an active user's `organizationId`. For business collections, most same-organization users can read/create/update any record; deletion is role-limited, but write capabilities are not consistently split by `owner`, `admin`, `broker`, `sales`, `claims`, `finance`, and `staff`.

The global `isAdmin()` branch is also an unconditional exception for many business-record operations. Platform Admin should remain separate from Organization Admin; access to client medical records and document contents should not be a default platform-support capability. `clientCounters` currently permits reads by any authenticated user rather than only the relevant organization.

**Required fix:** build a collection/action capability matrix; enforce it in Firestore Rules and every trusted endpoint; use explicit assignment checks where needed; keep unknown collections deny-by-default; and add negative emulator tests for cross-organization access, role escalation, prohibited writes and private-document access. Platform-wide support access to sensitive content, if ever necessary, must be a separate, time-bounded and audited elevation flow.

### P0 — iNex receiving account and deployed function name are inconsistent

The requested target is `leads@insurnex.com` with UID `fDGjCCaVCGXbPoH18sMI7DRbpQI2`. The audited `functions/src/index.ts` instead sets `INEX_RECEIVER_EMAIL='securepath@nex.com'` and resolves the user by email. Separately, `functions/package.json`'s deploy script names `ingestSecurePathLead`, while the audited source exports `ingestINexLead`.

**Required fix:** confirm the intended account and active organization in Firebase before changing the integration; use the explicitly approved immutable receiver UID as the target identity (and validate its active profile/organization server-side); make the ingress function name, deployment script, iNex caller URL/secret and monitoring contract agree. Keep idempotency and secret rotation. Never transfer the source application's password or auth token into CRM. No credential was changed during this audit.

### P1 — Copilot context is trusted from the caller rather than reconstructed from authorized records

`functions/src/copilot/index.ts` checks Firebase authentication and App Check, but accepts `req.data.context` as a typed client payload and appends it to the system prompt. The type assertion does not validate the referenced client, policy, claim, organization or the user's role. This permits fabricated/stale context to be presented to the model and weakens evidence traceability.

**Required fix:** accept stable entity IDs and a small action schema; derive user/org/role server-side; fetch only authorized source documents/records; apply field minimization; validate structured outputs; return source IDs/versions and explicit data limitations; cap requests and concurrency. Under Spark, implement through a trusted endpoint that is actually deployable under the chosen free plan.

### P1 — Two storage implementations and inconsistent metadata contracts

The Supabase gateway uses paths of the form `organizations/{org}/clients/{client}/{area}/{filename}`; the direct Firebase Storage document service uses `organizations/{org}/documents/{documentId}/{filename}`, and stores `downloadUrl` in Firestore. The env example selects Supabase but the document service still imports Firebase Storage directly. Existing readers/writers must be traced before selecting the canonical route.

### P1 — Audit, export/deletion and retention are target requirements, not a complete shipped workflow

The current schema baseline describes candidate `auditLogs`, `documentExtractions`, `coverageAssessments`, `medicalAnalysisRuns` and `integrationEvents` collections as proposals. They must not be added to client-writable generic rules. Audit events should be written by a trusted server path; minimize PII/medical text in logs. Implement verified export and deletion workflows only after legal/retention review and referential-integrity tests.

### P1 — Test pipeline is incomplete for the new scope

Existing scripts cover PWA, admin access and plan entitlements. `scripts/firestore-rules-test.mjs` contains useful emulator security assertions but is not exposed in root npm scripts. No build or emulator test was executed as part of this remote source-only audit.

**Required release gates:** dependency install; lint; TypeScript/Vite build; Functions/edge-function build as applicable; PWA tests; Firestore Emulator Rules tests; unit tests for state transitions and metrics; role/tenant negative tests; signed upload/download/delete tests; and manual UI tests on light/dark themes and mobile/desktop. Deploy separately only after explicit approval.

## Free-tier limits that affect the product

- Firebase Spark can serve the static PWA and use permitted Firebase services within their no-cost quotas, but it cannot be treated as a deployment path for Cloud Functions or Firebase Storage.
- Supabase's published Free plan includes 1 GB file storage and 500,000 Edge Function invocations per month, with a 50 MB max upload configuration; projects can pause after one week of inactivity. This is suitable for a constrained pilot only after testing and monitoring, not a production SLA.
- Gemini Developer API free-tier quotas are model/project-specific and may change. Free-tier content-use terms must be treated as a blocker for sending real medical/sensitive data.

Official references:
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
- https://supabase.com/docs/guides/platform/billing-on-supabase
- https://supabase.com/docs/guides/functions/limits
- https://supabase.com/docs/guides/storage/uploads/file-limits
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://ai.google.dev/gemini-api/docs/pricing

## Audit conclusion

Proceed with a free-only **MVP/pilot**, but do not claim full production-ready Medical AI or document storage under the current constraints until the blockers above are resolved. Preserve the current business schema and routes, choose one storage gateway, use the existing PWA, harden tenant + role authorization, migrate only the required server endpoints to a truly deployable no-cost runtime, and limit free-tier AI to reviewed low-sensitivity inputs. The present branch is documentation-only and makes no changes to `main` or production.
