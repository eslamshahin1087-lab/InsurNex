# InsurNex — Free-tier Capability Matrix
Date: 2026-11-01

This matrix distinguishes code already present from services that are enabled, deployable, or accepted. It does not claim current project quotas or deployed runtime configuration have been verified.

| Capability | Main resource | Safe implementation on the requested baseline | Status / limitation |
|---|---|---|---|
| Sign-in / identity | Firebase Auth | Reuse sessions; no extra accounts; existing AuthProvider | Source present; live provider configuration not independently verified |
| CRM, leads, policies, claims, tasks, renewals | Firestore | Org-scoped indexed queries, explicit limits/cursor pagination, minimal live listeners, batched writes | Modules present; lifecycle end-to-end acceptance remains |
| Dashboard | Firestore | Aggregation snapshots with freshness and completeness labels; never call a limited sample a portfolio total | Existing bounded-query paths need metric reconciliation |
| Offline UX | IndexedDB / Service Worker | Cache non-sensitive reference metadata; user-scoped keys; clear on sign-out/account switch | PWA foundation/test exists; per-module offline mutation reconciliation remains |
| Documents | External object storage | Keep provider abstraction; validate size/type; compress images; temporary URLs; backup and deletion workflow | Firebase Storage cannot be assumed as Spark-free. Existing Supabase adapter is separately billed/limited by its own Free plan and must pass staging acceptance |
| File parsing | Browser CPU / bundle bytes | Parse supported files locally; lazy-load PDF/Excel/OCR libraries | Some parsers are already present; OCR languages, worker packaging and browser memory need test |
| Deterministic medical calculations | Browser CPU | Calculate aggregates in code and expose provenance/data gaps | Medical intelligence engine present; validate with fixed fixture suite and no-LLM path |
| Generative AI | External AI API or BYOK | Off for identifiable/sensitive content; redacted aggregate-only use after provider terms review; local caching/rate limits | Legacy paid Anthropic function exists as build-only source; consumer AI free tier is not cleared for sensitive personal/medical data. BYOK is user-funded/external and not platform-zero-cost |
| In-app notifications | Firestore | Derive from bounded/summary queries; deduplicate by deterministic IDs | Source exists |
| Push notification | FCM | Do not advertise guaranteed push until current project eligibility/quotas and target registration verified | Not confirmed on this free-tier baseline |
| Reminders / daily briefing | Client runtime or external scheduler | In-app reminders when opening the app; optional external free scheduler only after security/reliability review | Firebase Functions unavailable on Spark; background execution not guaranteed by browser |
| iNex lead ingestion | Trusted server ingress | Use schema/HMAC/replay/idempotency and receiver verification in a separately approved external runtime | Existing Firebase Function source is not deployable on Spark. New contract is documentation only, no live ingress created |
| Analytics / reports | Browser CPU; Firestore reads | Paginated complete data or validated aggregates; local PDF generation; show range/freshness | Some reports and PDF tooling present; source totals need reconciliation |
| Client Portal | Auth, Firestore, object storage, ingress | Prepare collection contracts and isolated roles; phase later | Not evidenced as complete; document upload and external ingress add service dependencies |
| Audit logs | Firestore / trusted runtime | Append-only event model, no PII/prompt/body tokens; strict rules | Design and tests partially present; complete immutable trusted writer remains |
| Data export / deletion | Firestore/storage | Preview, consent, dry run, export, retention/legal hold and audited deletion workflow | Must be designed/tested; no bulk destructive action allowed |

## Engineering controls that reduce consumption
- Every list query must define a bounded page size and stable ordering; use cursor continuation rather than offsets.
- Avoid reading full collections to compute dashboard counters; use validated, server/trusted-writer-maintained summaries or explicitly label partial views.
- Use snapshot listeners only for a small set of visible, live screens and always unsubscribe on route change.
- Keep local caches user and organization scoped. Clear sensitive cached state on identity changes.
- Debounce search and writes; batch logically related writes with idempotency keys.
- Avoid unbounded polling and background retries. Retry only transient errors with bounded exponential backoff.
- Do not cache sensitive medical/client values in shared browser storage.

## Non-negotiable release limitations
1. No Firebase Cloud Functions deployment on Spark.
2. Firebase Storage cannot be treated as a Spark free-tier storage option under the current policy.
3. Supabase Free is a separate provider, not part of Firebase Spark; quota, pause policy, retention, region and backups need their own owner acceptance.
4. FCM availability and delivery should be tested against the current Firebase project/plan; never treat code presence as delivery guarantee.
5. Free consumer AI is not an approved destination for identifiable health/insurance records; deterministic local processing is the safe fallback.
6. A web app cannot guarantee background jobs, scheduled notifications or offline delivery when the browser/OS suspends it.
