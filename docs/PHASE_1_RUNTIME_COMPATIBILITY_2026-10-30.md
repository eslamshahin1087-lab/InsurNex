# Phase 1 Runtime Compatibility — InsurNex

**Audit date:** 2026-10-30  
**Repository baseline:** `main` at `6789db0bfe630b43a1557a3504c46e0b4a975216`  
**Scope:** read-only metadata inspection of the configured Supabase project plus repository source/config review. No function was deployed, invoked with customer data, paused, reconfigured, or given new secrets.

## 1. Verified active Supabase project

The Supabase connector reports the configured InsurNex project as:
- Project: `InsurNex`
- Project reference: `piloiwtdbtmfiyqxfbae`
- Region: `eu-central-1`
- Project status: `ACTIVE_HEALTHY`
- Organization plan: `free`
- Public schema table listing: no tables returned
- Migration listing: no migrations returned

The project contains a private Storage bucket used by the document gateway (see storage runbooks). “Active/healthy” confirms the provider control-plane status only; it does not prove end-to-end application acceptance or service-level availability.

## 2. Active Edge Function inventory

Read-only function metadata returned the following active deployments:

| Function | Deployed version | Supabase gateway `verify_jwt` | Repository parity |
|---|---:|---|---|
| `copilot-chat` | 37 | `true` | **Mismatch:** repository `supabase/config.toml` specifies `verify_jwt = false`; deployed source structure also differs from the current modular source. |
| `document-storage` | 22 | `false` | **Mismatch:** deployed entrypoint is older/inline compared with current repository source, which imports the shared access-policy module. It performs its own Firebase token checks; staging tests are still required. |
| `securepath-webhook` | 20 | `false` | **Source missing from repository:** deployed source is not versioned under `supabase/functions`. |
| `cron-policy-check` | 7 | `false` | **Source missing from repository:** deployed source is not versioned. It accepts a dedicated cron secret and also a service-role key as a bearer alternative. |
| `cron-document-check` | 7 | `false` | **Source missing from repository:** same authorization fallback pattern as the policy cron. |

### Consequences

1. A deployment from GitHub `main` cannot currently be treated as a reproducible release of all five live functions.
2. The Copilot gateway setting in live metadata does not match the checked-in Supabase configuration. Do not redeploy either side until request authentication behavior is reproduced in Staging.
3. The document-storage source in `main` and the active deployed entrypoint must be reconciled before upgrading the endpoint. Replacing the deployed function from an unverified source risks breaking upload/download/delete or weakening metadata-bound authorization.
4. The webhook and cron functions must be recovered into version control, reviewed, tested and assigned clear ownership before further modifications.
5. The cron functions should accept a dedicated, rotated `CRON_SECRET` only. Do not use the Supabase service-role key as an application-level cron credential. No secret value was read or changed during this audit.

## 3. Firebase Spark compatibility

The repository retains Firebase Functions source and `firebase.json` still declares a Functions source. CI builds that source, but it is not a deployable target under the approved Spark plan.

The old `functions/package.json` deploy command also referenced `ingestSecurePathLead`, while the current source exports `ingestINexLead`. The receiving email in the legacy function source is hard-coded as `securepath@nex.com`. The receiver UID/profile/organization have not been verified against the live Firebase project.

**Phase 1 change:** the Functions package `deploy` command is now guarded and exits before invoking Firebase CLI. The code remains buildable/testable as legacy source while endpoint migration is reviewed. This does not remove the legacy code or affect the PWA.

## 4. iNex-App vs SecurePath integration boundary

The deployed `securepath-webhook` is an integration-key-driven endpoint whose source writes client/lead/timeline/notification records. It is not proof that the separate `iNex-App` contract is configured.

The legacy Firebase source:
- exports `ingestINexLead`;
- uses a different receiver email constant (`securepath@nex.com`);
- has a deploy-script name mismatch;
- is not deployable under Spark.

The older Draft architecture document records a proposed receiver identity (`leads@insurnex.com` and UID), but a draft value is not live-account verification. Do not change routing or credentials until the owner confirms the receiving account and its active organization through an authorized Firebase project check.

The target ingress contract remains: dedicated integration identity, least-privilege lead-create scope, signed/rotatable secret, schema validation, replay protection, idempotency on organization + source + external lead ID, rate limiting and sanitized audit events.

## 5. AI runtime and cost boundary

- Repository Copilot source uses Supabase Edge Function code with Gemini/Groq provider support and trusted context modules.
- Legacy Firebase Functions source imports Anthropic for medical analysis and Copilot support.
- The live Copilot deployment is not source/configuration-identical to GitHub `main`.
- Provider secret values, current quotas and actual billing/usage were intentionally not retrieved.

Therefore, the zero-paid-AI requirement is not yet proven by source or deployment metadata. Before live sensitive workflows are enabled, provider configuration and terms must be reviewed and the sensitive-data boundary tested. Keep medical/client/claim-identifiable inputs out of consumer free-tier generative APIs. Preserve deterministic analytics and a no-AI fallback.

## 6. Supabase advisor result

The read-only security advisor reported one warning: `pg_net` is installed in the `public` schema. No performance advisor finding was returned. This is a database hygiene item; it is not evidence of an exploitable application vulnerability. Review whether the extension is needed, plan a controlled schema move if supported, and test dependent jobs before changing it.

## 7. Phase 1 implementation in this PR

- Change the legacy Firebase Functions `deploy` script to a fail-closed guard; no Firebase CLI deployment is invoked.
- Add a regression test that executes the guard and confirms a non-zero block result plus an explicit no-deploy message.
- Add the guard to root CI.
- Preserve all function source, app routes, user-facing behavior, theme/identity and Firebase/Supabase configuration.

## 8. Phase 1 remaining gates

- Recover/version and review all five deployed Edge Function sources; establish repeatable source hash/release provenance.
- Resolve `copilot-chat` live `verify_jwt` mismatch in Staging; do not toggle production gateway auth on assumptions.
- Reconcile document-storage deployed source with the modular repository version; run upload, list, preview/download, delete, legacy-URL and cross-tenant denial acceptance in Staging.
- Recover cron sources and remove service-role-key bearer fallback; verify schedule ownership, idempotency and duplicate-notification behavior.
- Verify receiver identity/organization and implement iNex-App ingress in the chosen Spark-compatible runtime.
- Migrate or explicitly disable legacy Anthropic/Firebase callable flows while preserving the existing Copilot and deterministic analytics fallbacks.
- Continue Phase 1 client data access adapter, collection-specific RBAC, audit controls and sensitive data separation. Proposed sensitive collections remain default-denied.
- Do not change production functions, secrets, billing, Firestore Rules or live data as part of this PR.
