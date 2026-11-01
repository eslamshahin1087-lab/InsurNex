# InsurNex — Master Execution Backlog

**Baseline:** `main` at `6789db0bfe630b43a1557a3504c46e0b4a975216` after Phase 0 merged (2026-10-30).  
**Delivery policy:** isolated feature branches, small PRs, CI + Secrets Scan, review before merge.  
**Release policy:** no production deployment, billing change, secret rotation or live-data migration without a separate explicit approval.

This backlog is the execution source of truth. A checked source-code task means only that the stated repository change has merged; it does not mean the service is deployed or accepted in staging.

## Product guardrails

- Preserve the existing InsurNex app, routes, business functionality, Arabic RTL, light/dark identity and mobile-first PWA.
- Keep Firebase Authentication and Firestore as the identity and business-data foundation unless a separate architecture decision is reviewed.
- Keep Firebase Spark and zero paid AI spend as constraints. Never link billing or enable paid providers as an implementation shortcut.
- Use Supabase Edge Functions/Storage only after validating project status, secrets, quotas, privacy and deployed parity.
- No sensitive client/medical/claim material is sent to consumer free-tier AI. Deterministic calculations and no-AI fallbacks remain available.
- Platform Admin remains separate from organization roles and has no routine tenant-content access.
- Every tenant operation checks identity, active membership, role/capability, same-tenant parent relationships and assignment where required.
- Proposed sensitive collections remain deny-by-default until their specific authorization rules and trusted endpoints pass Emulator tests.

## Current baseline status

| Area | Status | Evidence / limitation |
|---|---|---|
| App foundation and PWA | Present | React/TypeScript/Vite; CI covers build, PWA and visual-identity regression tests. |
| Authentication and organizations | Present | Firebase Auth and Firestore membership model; further capability enforcement remains. |
| CRM/Client | Partially implemented | Legacy `clients` record still contains mixed-sensitivity data; needs a compatibility adapter and runtime separation. |
| Leads/Sales | Partially implemented | Lead stages and activities exist; integration and complete sales-to-policy lifecycle need acceptance. |
| Policies/Claims/Renewals | Partially implemented | Services exist; end-to-end state transitions, audit and reconciliation need broader tests. |
| Documents | Source integration merged | Supabase gateway source and client service exist; staging deployment/acceptance is not proven. |
| Finance/Analytics | Partially implemented | Dashboard and analytics use bounded samples in some paths; true totals need a reliable aggregation approach. |
| AI/Copilot | Partially implemented | Copilot Edge Function plus legacy Firebase Functions/Anthropic code; provider, privacy and Spark compatibility need resolution. |
| iNex-App ingress | Source implementation merged; runtime activation pending | iNex-App PR #21 and InsurNex PR #95 are merged. The existing authenticated Worker route now creates the lead/activity/follow-up task/notification idempotently. Receiver UID/email/organization and Worker environment still require live verification; no Worker deployment or secret change is included. |
| Sensitive-data split | Design and review tooling merged | Field inventory/plan/review and RBAC proposal exist; no runtime split or migration. |
| Client Portal | Not evidenced as implemented | Later release. |
| Insurer Comparison Engine | Not evidenced as implemented | Later release. |

## Phase 1 — Runtime Compatibility & Security/Data Foundation

**Implementation status (2026-10-30):** Phase 1 started on branch `security/phase1-spark-runtime-guard-20261030`. The legacy Firebase Functions deployment command is being guarded because the approved Firebase Spark plan cannot deploy/update Cloud Functions. The five active Supabase Edge Functions were inventoried read-only; live/source parity gaps are documented in [Phase 1 Runtime Compatibility](PHASE_1_RUNTIME_COMPATIBILITY_2026-10-30.md). This is a first safety gate, not completion of Phase 1.

**Runtime audit:** [Phase 1 Runtime Compatibility](PHASE_1_RUNTIME_COMPATIBILITY_2026-10-30.md).

**P1-A update (2026-11-01):** PR #98 merged the manifest v2 and deterministic runtime-provenance report described in `docs/P1_A_RUNTIME_PROVENANCE_2026-11-01.md`. The five archived functions are compared against canonical source at main commit `ca08aaeee376855d839111d1cf711506452bb6c7`; four differ and `securepath-webhook` has no canonical source path in that baseline. Provider configuration revision remains explicitly unavailable because the original read-only metadata capture did not return it. This is repository provenance evidence, not live deployment acceptance.

**Implementation update (2026-10-30):** PR #85 merged the fail-closed Spark deployment guard; PR #86 merged an interim Claims deny boundary for the legacy mixed-sensitivity Client 360 record. This branch recovers all five active Supabase Edge Function source bundles as non-deployable snapshots and adds tested, non-deployed cron candidates that reject the service-role bearer fallback. This is progress, not completion of Phase 1.



### P1.1 — Resolve Spark-compatible runtime map
**Priority:** P0 · **Dependencies:** Phase 0 baseline  
- Inventory every Firebase Functions caller, export, secret, deploy script and client import.
- Mark each function as: active runtime, build-only legacy, migrated endpoint, or safely disabled.
- Define a Spark-compatible endpoint strategy for each required operation; do not duplicate overlapping trusted endpoints.
- Align Node runtimes and build/test commands for web, Functions source and Deno Edge Functions.
**Acceptance:** no production feature depends on a Function that cannot be deployed under the selected plan; every migrated endpoint has auth, tenant, capability, idempotency, rate and error tests.

### P1.2 — Correct iNex-App lead ingress contract
**Priority:** P0 · **Dependencies:** P1.1; verify receiver identity in target Firebase project

**Source status:** implemented and merged on 2026-11-01 through iNex-App PR #21 and InsurNex PR #95. The existing iNex-authenticated Cloudflare Worker path remains backward compatible and now creates the Lead, Activity, follow-up Task and in-app Notification. Source consent evidence and deterministic IDs are required; Worker writes are restricted in code to four create-only InsurNex collections.

**Activation remains pending:** verify the receiving UID/email, active profile, organization, membership and role in the live InsurNex Firebase project; verify Cloudflare Worker variables/secret and the target service-account IAM boundary; perform an approved synthetic staging registration. No Worker deployment or secret/configuration mutation is included in the merge.

**P1-D source candidate (2026-11-01):** `docs/P1_D_DOCUMENT_GATEWAY_RUNTIME_PARITY_2026-11-01.md` adds explicit handler-side Supabase API-key allowlisting for the `verify_jwt=false` gateway, 10-second Firebase/Firestore timeouts, a 64 KiB control-request limit, a Firebase token length cap, 15-minute new download URL TTLs and CI contract checks. Deployed v22 was only observed in the dated archive; live version/configuration and actual upload object reconciliation remain Staging acceptance items. No deployment or bucket/rules/data change is included.

### P1.3 — Build Client Data Access Layer (compatibility-first)
**Priority:** P0 · **Dependencies:** field inventory, separation plan, RBAC matrix  
**Implementation started:** P1-E adapter candidate is developed on `feat/phase1-client-data-access-adapter-20261101`. The Clients index now consumes an allowlisted base projection; Client 360 reads pass through a role/active-user/tenant preflight. This does not create field-level security because the backing legacy Firestore document remains mixed-sensitivity. See `docs/P1_E_CLIENT_DATA_ACCESS_ADAPTER_2026-11-01.md`.  
- Catalog all readers/writers of `clients`, `individual`, `corporate`, `riskData`, `riskAssessment`, `aiAnalysis`, `documents` and notes.
- Introduce typed repository interfaces for base client summary, restricted profile, medical profile, claim-sensitive fields, document references and AI findings.
- Preserve legacy reads behind an adapter; write new data only after destination collection Rules and endpoint authorization are ready.
- Use feature flags only for internal rollout, never as security controls.
**Acceptance:** all known call sites are inventoried; contract tests cover legacy and new projections; no page loses required fields; unauthorized fields are not returned in Sales/Staff/Finance projections.

### P1.4 — Enforce tenant/role/relationship/assignment RBAC
**Priority:** P0 · **Dependencies:** P1.3 data contracts  
**Implemented interim boundary (PR in review):** Claims is denied direct get/query/timeline access to the legacy mixed-sensitivity `clients/{clientId}` record. Claim snapshots, linked policy metadata and claim-category document metadata remain available. Client 360 UI routes/navigation and both legacy Copilot client-context policy are restricted to Owner/Admin/Broker. This is an interim deny-until-projection control, not completion of data separation.

- Convert the proposed matrix into exact collection/action grants.
- Rules and trusted endpoint checks validate Firebase identity, active membership, role, immutable organization ID, parent relationship and assignment.
- Keep `clientSensitiveProfiles`, `clientMedicalProfiles`, `claimSensitiveDetails`, `aiFindings` and `auditLogs` deny-by-default until their own rules are approved.
- Audit every allow-list change; no generic allow-list shortcut for sensitive collections.
**Acceptance:** positive and negative Emulator tests for all roles and known IDs; no cross-tenant read/query/write/update/delete; no self-escalation or forged relationship; existing workflows continue.

### P1.5 — Audit, consent, retention, export and deletion
**Priority:** P0 · **Dependencies:** data classification and RBAC  
- Add trusted append-only audit events for sensitive reads/exports, role changes, document actions, AI runs and administrative operations.
- Define legal purpose, consent/basis, retention, deletion/legal hold, export and backup/restore behavior per class.
- Exclude raw IDs, medical values, document bytes, tokens, signed URLs and full prompts from logs.
**Acceptance:** synthetic export/delete drills; immutable audit tests; retention decisions reviewed; lawful processing and Egypt legal review documented before sensitive production processing.

## Phase 2 — Storage Unification & Operational Acceptance

### P2.1 — Supabase document gateway Staging acceptance
**Priority:** P0 · **Dependencies:** P1.1 and P1.4  
- Verify deployed function revision and secret names against repository source.
- Verify bucket privacy, allowed MIME/size, CORS origins, storage paths, signed URL TTL, temporary upload cleanup and deletion semantics.
- Test general documents, client-linked documents, legacy embedded references and operation attachments.
- Test tenant/role/category denials and object recovery/backup.
**Acceptance:** real staging upload/list/preview/download/delete and denial suite passes; no reusable signed URL is persisted; rollback is documented.

### P2.2 — Complete legacy reference reconciliation
**Priority:** P1 · **Dependencies:** P2.1  
- Compare metadata counts and object references, classify missing/orphan/mismatched records, preserve legacy source references until verified.
- Use idempotent, resumable, dry-run manifests; never delete source objects during initial reconciliation.
**Acceptance:** every migrated reference is matched and recoverable; unresolved entries are explicitly quarantined.

## Phase 3 — Professional Broker CRM & Sales

### P3.1 — Client 360 workspace
- Consolidate summary, contacts, organization/family relationships, insurance portfolio, policy/claim history, timeline, activities, tasks and documents.
- Separate sensitive tabs/projections by capability; implement deduplication and broker assignment.
**Acceptance:** Client 360 can be opened and edited without leaking restricted classes; activity history is complete and tenant-scoped.

### P3.2 — Leads and Sales Pipeline
- Normalize stage enum and transitions; capture source, expected premium, probability, next action, owner, follow-up, win/loss reason and conversion history.
- Link Lead → Needs Analysis → RFQ/Quotation → Negotiation → Won/Lost → Policy Issued.
**Acceptance:** invalid stages cannot blank the view or bypass transitions; conversion is idempotent and traceable.

### P3.3 — Insurance Operations Lifecycle
- Link Quotes/RFQs, insurer responses, policy issue/endorsement/cancellation, claims, documents, tasks and renewals.
- Use explicit state machines and event history; avoid arbitrary browser-side status writes.
**Acceptance:** a synthetic case can progress end-to-end with consistent foreign keys, actor, timestamps and evidence.

## Phase 4 — Executive Dashboard & Financial Core

### P4.1 — Metric contracts and full-coverage aggregation
- Define exact formulas and periods for clients, policies, premium, commission, claims, renewals, conversion and retention.
- Replace bounded-list counts with reliable aggregates/snapshots or paginated complete reconciliation.
- Show currency, date range, freshness and partial-data warnings.
**Acceptance:** every dashboard metric reconciles to source data in a test dataset and never represents a bounded sample as a full portfolio.

### P4.2 — Commission and finance reconciliation
- Define premium/commission gross-net semantics, currency/minor-unit convention, receivable/payable and paid/outstanding states.
- Add reconciliation between policy, insurer statement, brokerage ledger and received payment.
**Acceptance:** financial totals are deterministic, currency-safe, reproducible and auditable.

## Phase 5 — Evidence-first Insurance Intelligence

### P5.1 — Document Intelligence
- Extract coverage, limits, exclusions, deductibles, conditions, dates, premium and insured parties.
- Preserve document version, page/section evidence, confidence, missing fields and human review.
**Acceptance:** extraction fixtures cover PDF/XLSX and adversarial/malformed files; unsupported facts are returned as missing rather than invented.

### P5.2 — Medical Utilization Intelligence
- Build normalized import jobs for CSV/XLSX/PDF reports, deterministic frequency/severity/cost/trend calculations and provider/category analyses.
- Separate aggregate analytics from member-level medical detail.
**Acceptance:** calculations reconcile to source rows; outlier signals show comparison period and denominator; no diagnosis/medical advice.

### P5.3 — Coverage, Claims and Sales Assistants
- Use authorized inputs and evidence-linked outputs with source version, model/version, confidence, limitations and reviewer state.
- Keep all business decisions human-controlled.
**Acceptance:** no fabricated context, unauthorized source or ungrounded recommendation passes validation.

### P5.4 — Copilot provider and privacy controls
- Remove/disable paid fallback paths unless explicitly approved; enforce budgets, quota handling, request limits and schema validation.
- Do not submit sensitive data to consumer unpaid AI services.
**P1-C source merged (PR #99):** `docs/P1_C_COPILOT_RUNTIME_PARITY_2026-11-01.md` records disabled Firebase-account rejection, bounded token-verification/provider timeouts, a deterministic bilingual no-AI fallback, and synthetic tests for provider-off, quota/transport failure and disabled accounts. It does not enable or approve Gemini/Groq provider terms, change secrets, or prove live deployment parity.
**Acceptance:** provider-off and quota-exhausted fallback tests pass; no sensitive field enters an unapproved prompt; all Copilot citations resolve to authorized resources; staging parity is independently verified.

## Phase 6 — Insurer and External Integration

- Build Insurer profiles, products, underwriting contacts, RFQs, commission agreements and performance.
- Add iNex-App ingress only after P1.2 acceptance.
- Add click-to-chat WhatsApp and prepared email drafts first; background messaging requires verified consent and provider/runtime review.
**Acceptance:** integration events are idempotent, scoped and auditable.

## Phase 7 — UX, Accessibility & PWA Quality

- Preserve existing visual identity while improving consistent design tokens, responsive data tables/forms, loading/error/empty states and global search.
- Test Arabic RTL and English LTR, light/dark, mobile/desktop, keyboard/accessibility, PWA install and privacy-safe cache behavior.
**Acceptance:** visual regression tests pass; no private business data enters service-worker caches; end-to-end journeys pass at phone and desktop breakpoints.

## Phase 8 — Release, Monitoring & Recovery

- Separate dev/staging/prod configs and secrets.
- Monitor errors, edge invocations, storage usage, AI usage, database quotas and project pause/availability.
- Document incident response, backups, restore drills, release/rollback and data export.
**Acceptance:** staging sign-off, restore drill, security review, privacy/legal review and owner’s separate production approval.

## Phase 9 — Ecosystem Expansion

- Client Portal with delegated client identity, document access, claims/renewals and service requests.
- Insurer Comparison Engine with evidence-linked side-by-side coverage, exclusions, limits, deductibles and pricing; recommendations remain non-binding.
**Acceptance:** portal and comparison are isolated product releases built on the same tenant, relationship, consent and audit controls.

## Pull-request sequencing policy

- One PR should implement one coherent domain change with tests and rollback notes.
- PR order follows the dependency graph above; do not merge a consumer before its data/authorization contracts.
- Required checks: full CI, Secrets Scan, type/lint/build, relevant Emulator suite, static privacy checks and documented manual/staging evidence where applicable.
- A green PR is not a deployment authorization.
- No production data migration or deployment is included in this backlog by default.
