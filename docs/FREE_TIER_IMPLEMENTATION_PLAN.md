# InsurNex — Spark / Free-Only Implementation Plan

**Decision baseline:** Firebase Spark, zero AI spend, development on an isolated branch with review before merge.  
**Product baseline:** extend the existing InsurNex app; do not replace the current app or alter production during development.

## Architecture decisions

1. **Frontend:** preserve React + TypeScript + Vite, the current RTL PWA, route guards, feature modules, and light/dark branding. UI gates remain usability controls, not security.
2. **Identity and core data:** retain Firebase Authentication and Firestore. Keep current top-level collections for the first iteration; records remain tenant-scoped with a server/rules-validated `organizationId`. Avoid moving all documents into nested organization paths during MVP.
3. **Static hosting:** keep Firebase Hosting within Spark quotas.
4. **Document storage:** select one private provider. Given current Spark constraints, prefer the existing Supabase Storage signed-operation gateway for the pilot, after confirming the project exists and is active. Refactor the current direct Firebase Storage callers only after inventorying all callers and validating the gateway. Free plan means 1 GB file storage, up to 50 MB configured file size (the app may retain the stricter 10 MB rule), 500,000 Edge Function invocations, and possible project pause after one week of inactivity. Monitor quotas and define a backup/export process.
5. **Trusted HTTP endpoints:** do not deploy/update Firebase Cloud Functions while remaining on Spark. Evaluate Supabase Edge Functions for the small, bounded server endpoints (iNex lead ingress, signed-document gateway, AI allowlisted proxy) using server-side secrets and validated Firebase ID tokens. If Firebase Admin access is unavoidable, store a dedicated least-privilege service identity only in edge secrets; never expose it to the client. Keep endpoints short-running and idempotent.
6. **AI:** use Firebase AI Logic + Gemini Developer API free tier only for generic/public or specifically reviewed low-sensitivity and sufficiently de-identified inputs. Enforce App Check, per-user/org request budgets, input/output size caps, schema validation, and safe fallbacks. Do not send unredacted client records, policy schedules, medical claims or identifiable health data to the free tier.
7. **Medical and document intelligence in MVP:** implement deterministic extraction, formulas, cost/frequency/severity/trend analytics, simple outlier rules, evidence links, and review states first. AI-generated explanation for sensitive source data is disabled until an appropriate provider contract and data-handling posture are approved. Do not market deterministic heuristics as AI diagnosis or medical advice.
8. **External communications:** use draft/click-to-send email and WhatsApp links initially. Do not promise automated WhatsApp/email delivery without validating a genuinely free provider/quota and lawful consent.
9. **Audit:** add backend-only append-only security/business audit events for privileged changes; exclude secrets and minimize sensitive content. Define retention and deletion/export before collecting additional medical-derived data.

## Delivery phases and acceptance criteria

### Phase 0 — Repository and runtime baseline
- Identify the actual local branch/commit and remote; compare against current GitHub `main` before any integration.
- Inventory every document-storage call site, current Supabase project/config, AI calls, function exports/deploy commands, Firestore reads/writes, rules and indexes.
- Keep all edits on a dedicated branch; record baseline build/test outcomes.
- **Gate:** no unexplained local changes; a written module/data-flow inventory; no production deploy.

### Phase 1 — Security foundation
- Establish capability matrix for `owner`, `admin`, `broker`, `sales`, `claims`, `finance`, `staff`, and separate `Platform Admin`.
- Harden Firestore rules by collection + action + role and explicit organization membership; fix global counter visibility and sensitive admin access.
- Ensure server endpoints independently validate identity, organization, resource ownership and capability; App Check is additional abuse protection, not a replacement for authorization.
- Add backend-only `auditLogs` and cross-tenant/role escalation negative tests.
- **Gate:** emulator tests pass for all roles, active/inactive profiles, cross-organization reads/queries/writes, immutable organization IDs and forbidden platform-admin escalation.

### Phase 2 — Storage unification and privacy controls
- Make the Supabase signed-operation gateway canonical for all document workflows under Spark.
- Validate file size/type, organization/client relation, action capability, signed URL TTL, CORS allowlist, delete rules and server metadata.
- Stop creating new Firebase Storage download URLs; provide only short-lived signed URLs after fresh authorization.
- Add retention, deletion, export, upload audit events and a safe migration/rollback for existing metadata.
- **Gate:** upload, preview, list, download, delete and unauthorized denial tests pass; no public objects or service-role key in the browser bundle.

### Phase 3 — Broker Operations MVP
- Executive Dashboard from deterministic queries/aggregates.
- CRM/Client 360, Leads pipeline and activities, Policies, Claims workflow, Renewal Center, Documents, Tasks, Notifications, Insurers and basic Finance.
- Maintain existing modules; add only needed schema fields backwards-compatibly.
- Automations on Spark remain in-app/on-access unless a free scheduled runtime is verified; no promise of background notifications while the app is closed.
- **Gate:** CRUD, workflow transitions, tenant/role tests, indexes and mobile RTL acceptance pass.

### Phase 4 — Evidence-first Intelligence
- Document text extraction for selectable PDF and spreadsheet data; local/low-sensitivity parsing where practical.
- Deterministic insurance coverage, expiry, claim and medical metrics with source-page/record references and data-quality warnings.
- Free-tier general Copilot only after input minimization/redaction and a verified provider privacy review; no identifiable data sent to free AI.
- Use typed JSON schemas, response validation, prompt versioning, source versions, confidence/limitations and human approval before business action.
- **Gate:** adversarial prompt tests, fabricated-context rejection, PII redaction tests, metric correctness tests and documented AI data-handling approval.

### Phase 5 — Financial analytics, polish and release candidate
- Revenue/commission/expense aggregation and portfolio analytics.
- Complete English/Arabic labels, RTL and LTR, themes, responsive layouts, accessible contrast and privacy-safe PWA caching.
- Test normal user and Platform Admin routes, subscription/feature gates and organization isolation.
- **Gate:** lint/build/PWA/emulator/feature smoke tests pass and owner reviews the exact diff.

### Phase 6 — Later expansion
- Client Portal, gated by client identity and delegated-access model.
- Insurer Comparison Engine, evidence-backed and non-binding.
- Sensitive AI processing, scheduled tasks, large-scale storage and production SLAs require a new cost/privacy/runtime review; they are not guaranteed by the current no-cost constraint.

## Firestore schema strategy

Preserve the existing collections until callers are inventoried. Every tenant-owned top-level record must have a validated `organizationId`, with stable references such as `clientId`, `policyId`, `claimId`, `leadId`, and server timestamps.

Current collections include:
- Identity/tenants: `users`, `organizations`, `organizations/{orgId}/members`, `admin`, `organizationSubscriptions`.
- CRM: `clients`, `clients/{clientId}/timeline`, `leads`, `leadActivities`.
- Insurance operations: `policies`, `claims`, `claimActivities`, `tasks`, `insurers`, `rfqs`, `operations`, `operationEvents`, `operationAttachments`.
- Documents/finance: `documents`, `revenue`, `expenses`, `commissions`.
- User-facing system features: `notifications`, `copilotConversations`, `copilotMessages`, plus the existing platform/subscription collections.

Proposed additions only after rules/tests are in the same reviewed change:
- `auditLogs` — backend write only, immutable to normal clients.
- `documentExtractions` — extraction version, source document/version, page/section evidence, confidence and human-review status.
- `coverageAssessments` — source policy/document versions, coverage/limits/deductibles/exclusions, evidence-backed gap candidates, limitations and reviewer.
- `medicalAnalysisRuns` — dataset/file hash, period, deterministic metric version, aggregated findings and limitations; avoid member-level identifiers unless a valid necessity and access model is approved.
- `integrationEvents` — idempotency key, sanitized delivery status, attempt count and timestamps; never store raw bearer secrets.

Indexes are added only to support real tested queries, and every required `organizationId` query needs a matching emulator and index validation.

## Required iNex integration correction

Target receiving identity provided by the product owner:
- Email: `leads@insurnex.com`
- UID: `fDGjCCaVCGXbPoH18sMI7DRbpQI2`

Before activating traffic, verify in the intended Firebase project that the UID belongs to that email, its profile is active, and its organization is the approved receiving organization. Update the endpoint export/deploy script/caller contract together, retain HTTPS + secret rotation + rate limiting + payload validation + deterministic idempotency, and test duplicate/replayed events. Do not transfer passwords or source app tokens to CRM.

## AI data boundary

| Input class | Free-tier AI handling |
|---|---|
| Public insurance concepts / generic sales drafting with no customer context | Allowed with quota and abuse limits |
| Non-sensitive summaries | Only after field minimization and redaction review |
| Identifiable clients, policy documents, contracts, IDs, claim narratives | Do not send to consumer free-tier AI without approved data terms and lawful basis |
| Medical claims, diagnoses, member/provider identifiable data | No remote free-tier generative processing; deterministic metrics only until approved |
| AI outputs | Persist source/version references and review status; never act as an autonomous decision |

## Branch and release policy

- Work on this feature/audit branch or a new feature branch based on an explicitly verified commit; never commit directly to `main`.
- Keep commits narrow by area: security, storage, business module, AI, UI.
- Attach command outputs and emulator results to each PR.
- Merge only after owner review.
- Production deploy is a separate explicit approval; a green build or merged PR is not a deployment authorization.
