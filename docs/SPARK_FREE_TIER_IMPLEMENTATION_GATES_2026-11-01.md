# InsurNex — Spark Free-tier Execution Gates (2026-11-01)

## Baseline and safety
- Base: `main` at `4515c0ceec2597017c375f6de0f392d23ee54a19` (PR #93 merge).
- Development branch: `feat/spark-safe-iNex-ingress-20261101`.
- No changes to `main`, live Firebase/Supabase configuration, credentials, customer data, Firestore Rules, indexes, or deployment targets are made by this documentation gate.
- Latest observed CI and Secrets Scan on the baseline SHA both succeeded: CI run 41237568209; Secrets Scan run 41237568166.

## Confirmed implementation already present
The existing React/TypeScript/Vite application includes routes and feature code for dashboard, CRM/clients, policies, renewals, claims, leads, documents, finance, analytics, insurers, medical intelligence, file analysis, Copilot, tasks, notifications, onboarding, organizations, and a separate Platform Admin area. It also contains PWA tests, a Spark deployment guard for legacy Firebase Functions, Firestore Emulator rules tests, and storage authorization policy tests.

Presence of source code is not evidence of production readiness, staging acceptance, or deployed-provider parity. Feature acceptance remains outstanding where described in the Master Execution Backlog and Phase 0/1 audits.

## Spark and zero-cost compatibility boundary
1. Firebase Cloud Functions remain build/test-only legacy source. The existing package deploy command is a fail-closed guard. Do not remove its source until all callers have an approved, tested replacement.
2. Do not add Firebase Storage as a runtime dependency for Spark. Firebase Storage is not an eligible free-tier document store under the constraints in this project. Keep the existing provider abstraction and Supabase Storage gateway only as an optional external free-tier adapter, subject to quota/privacy/availability review and verified deployed endpoint parity.
3. Supabase Edge Functions/Storage are not Firebase Spark services. Their free-tier plan, resource limits, pause policy, privacy and deployment configuration must be tracked separately. No paid provider or billing upgrade is allowed by this execution plan.
4. Do not send identifiable client, policy, claim, national-ID, contact, or medical data to consumer free-tier generative AI. Maintain deterministic local calculations and no-AI fallbacks. BYOK is a user-controlled external provider path and must be clearly labelled as such; it is not a platform zero-cost guarantee.
5. Never state that FCM push or Firebase Storage is enabled until the target project capability and billing requirements are independently verified.

## iNex ingress — target contract, not yet activated
The legacy source currently exports a Firebase HTTPS Function named `ingestINexLead`, but that runtime cannot be deployed under Spark. The source has a legacy receiver-email constant and no demonstrated, reviewed Spark-compatible iNex endpoint in this baseline. The receiving UID/email/organization supplied in the product request must be checked against the active Firebase project by an authorized operator before routing.

Recommended request envelope:
```json
{
  "schemaVersion": 1,
  "source": "iNex-App",
  "sourceLeadId": "stable-source-record-id",
  "receiverUid": "configured-receiver-uid",
  "createdAt": "ISO-8601 timestamp",
  "lead": {
    "fullName": "string",
    "email": "string|null",
    "phone": "string",
    "clientType": "individual|corporate",
    "businessName": "string|null",
    "insuranceInterest": "string|null",
    "consentToContact": true
  }
}
```

Contract requirements:
- Transport must use a trusted server-side ingress (not browser-held service account or broad Firestore credentials). Under Spark, do not replace the legacy Function with a callable/browser direct-write bypass.
- The receiver must be resolved server-side and verified as active with a valid organization membership.
- Strict allow-list validation, payload size/field length limits, normalized email/phone, explicit consent-to-contact, source lead ID, and schema version.
- Idempotency key: `iNex-App:{receiverUid}:{sourceLeadId}`; duplicate requests must not duplicate a lead, client, task, or notification.
- Deduplicate client matching only inside the verified organization. Do not globally search all tenants by email/phone.
- Return generic errors; write sanitized audit metadata without raw personal/medical data.
- An ingress adapter may be activated only after receiver identity and deployment/runtime approval are verified. The provided receiver UID/email are treated as requested values, not as proof of a live account.

## Delivery sequence from this baseline
1. Phase 1 completion: inventory all callers of Firebase Functions, remove or disable only verified dead call paths, and preserve legacy source for rollback.
2. Trusted iNex ingress: choose a currently available, free, private endpoint runtime; validate receiver identity; add schema, HMAC/replay protection, idempotency, rate controls, and emulator/contract tests.
3. Client compatibility layer: read legacy documents without mutation; typed projections and proposed sensitive collections remain deny-by-default until Rules and all readers/writers pass tests.
4. Storage staging acceptance: verify provider project status, deployed source hash, bucket privacy, upload/download/delete, cross-tenant denial, object quotas, signed URL expiry, and backup/export.
5. AI privacy gate: default identifiable/medical inputs off for consumer free AI. Keep deterministic analytics and require human review for any redacted aggregate prompt.
6. Product-module acceptance: reconcile lifecycle workflows against the Master Execution Backlog; do not call a module complete based on route/source presence alone.
7. Build, lint, Emulator and security scan on this feature branch; open a PR for review. No production deployment.

## Cost/quota management contract
| Capability | Expected resource | Guardrail |
|---|---|---|
| Authentication | Firebase Auth | Reuse persisted sessions; never create accounts as part of background synchronization. |
| CRM, Leads, Policies, Claims, Tasks | Firestore | Tenant-filtered indexed queries; limit/cursor pagination; no unbounded listeners; batched operations. |
| Dashboard | Firestore summaries | Use only validated summary documents; show freshness/partial-data labels; never describe a limited sample as a total. |
| Offline state | Browser IndexedDB/cache | Cache non-sensitive metadata only by default; clear user-scoped caches on sign-out/account switch. |
| Documents | External storage adapter, optional | Client-side size/type validation and compression; provider quotas, availability and backup need external review. |
| Medical/file calculations | Browser CPU | Deterministic code; process locally; export locally where possible. |
| AI explanations | External provider / BYOK | Off by default for sensitive records; local rate limit/cache; redaction; explicit consent; no AI fallback required. |
| Push notifications | FCM/external scheduler | Do not promise delivery on Spark until eligibility is confirmed; in-app notifications remain available. |

## Explicit non-guarantees
- A fully private document service cannot be guaranteed solely through Firebase Spark because Firebase Storage is outside the required free-tier boundary.
- Background server automation, trusted ingress and FCM push cannot be implemented by deploying Firebase Cloud Functions on Spark.
- Free consumer AI is not appropriate for identifiable medical/client/claim processing; BYOK shifts provider billing and terms to the user.
- Client portal, automated daily briefing and scheduled reminder delivery require an approved trusted runtime and privacy/security acceptance. In-app reminders and client-side processing may be provided without claiming server-side automation.
- This document does not certify Egyptian legal compliance; privacy notices, lawful basis, retention, data-subject rights and contracts require qualified local review.
