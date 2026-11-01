# Phase 1 Runtime Acceptance — Work Package Index

This index supplements (and does not replace) `PHASE_1_RUNTIME_COMPATIBILITY_2026-10-30.md` and `MASTER_EXECUTION_BACKLOG.md`.

| Work package | Scope | Exit evidence | Risk |
|---|---|---|---|
| P1-A Runtime provenance | Manifest v2, per-function observations, canonical drift comparison, Git blob + SHA-256 deterministic report | Snapshot integrity, reproducibility, archive-path and secret-screen tests; provider config revision remains unavailable | Medium |
| P1-B Cron hardening | Dedicated secret, replay/retry safety, idempotency | Deno tests + scheduler header evidence | High |
| P1-C Copilot parity | Trusted context, auth, provider and privacy parity | Synthetic negative tests + staging results | Critical |
| P1-D Document gateway | Metadata-bound paths and lifecycle | Staging upload/download/delete and tenant denial | Critical |
| P1-E Client adapter | Read-only data projections first; initial adapter candidate on `feat/phase1-client-data-access-adapter-20261101` | Synthetic role/field projection tests + CI + call-site audit | Critical |

## Operating rules

- Never merge an old branch merely because it contains useful work; compare its base and head and replay only reviewed commits.
- No live deployment, migration, secret mutation, billing, Firestore Rules or production configuration change in this plan.
- Do not use sample/bounded query counts as portfolio totals.
- Keep Platform Admin separated from tenant content.
- Keep sensitive proposed collections default-denied.
