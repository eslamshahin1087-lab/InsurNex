# P1-C — Copilot Runtime Parity Candidate

**Date:** 2026-11-01  
**Branch:** `feat/p1c-copilot-runtime-parity-20261101`  
**Base:** `main` at `22a01d9e1a736d650c39af082ab8dd2fbc5f4cf7` after merged PR #98  
**Status:** source-level hardening and synthetic tests proposed for review; no Edge Function deployment or provider/secret configuration change.

## 1. Existing runtime boundary retained

The existing request path remains:
1. Validate the Supabase publishable/legacy anon application key against the server-side allowlist.
2. Require the iNex/InsurNex Firebase ID token in `x-firebase-token`.
3. Verify the Firebase caller using Identity Toolkit.
4. Resolve the caller's active organization or private Platform Admin scope from Firestore using the caller's ID token.
5. Build bounded Firestore context using that same caller token and the verified organization scope.
6. Apply the context field allowlist before constructing the provider prompt.
7. Call configured Groq first, then Gemini, using server-side keys only.

Browser-provided business facts continue to be ignored. The browser sends a page/resource selector; records are fetched by the Edge Function with tenant filters and field masks. Platform Admin scope receives no tenant context. Existing role/collection access continues to be enforced by Firestore Security Rules.

## 2. Firebase account status verification

New module: `supabase/functions/copilot-chat/firebase-token-verification.ts`.

The previous inline account lookup accepted a token when Identity Toolkit returned a `localId`. The new module additionally:
- rejects empty and oversized ID tokens;
- rejects a missing server-side Firebase API key as an authentication service configuration outage;
- rejects Firebase accounts explicitly marked `disabled: true`;
- returns only the stable Firebase UID to the handler;
- distinguishes invalid credentials (401) from Identity Toolkit/network/rate-limit failures (503 with the safe public code `AUTHENTICATION_TEMPORARILY_UNAVAILABLE`);
- uses a bounded token-verification timeout;
- never logs the token or provider response body.

## 3. AI provider timeout and deterministic fallback

New module: `supabase/functions/copilot-chat/provider-routing.ts`.

Configured provider order remains unchanged: Groq first, Gemini second. Each provider request now has a 15-second timeout.

The provider cascade:
- tries only providers whose server-side API key is configured;
- treats thrown requests, quota errors, timeouts and empty responses as provider failures;
- never returns raw provider exception text, response bodies or quota details;
- does not loop or retry the same provider;
- returns a deterministic local fallback when no provider is configured or all configured providers fail.

The local fallback:
- follows Arabic/English based only on the latest user message;
- contains no customer, policy, claim, finance, medical or other business context;
- explicitly states that no AI analysis was generated and no business action was performed;
- identifies the response model as `local-fallback` so the UI/telemetry can distinguish it from a generated answer.

This is a failure-safe response, not a substitute for a working AI provider and not an assertion that a business analysis was completed.

## 4. New synthetic tests

- `firebase-token-verification.test.ts`: valid UID response, disabled account, missing/oversized token, malformed account lookup response, invalid credential, provider outage and network failure.
- `provider-routing.test.ts`: ordered provider selection, primary quota fallback to secondary provider, empty provider response, no configured providers, all providers failing, Arabic/English fallback and no sensitive/provider-error text in the fallback.

CI now runs both suites alongside the existing Copilot context, workspace authorization, API-key, sanitizer, route and Firestore-index regression tests.

## 5. What this does not claim

- No provider terms/privacy approval is established by this PR. Gemini/Groq key configuration and account terms still require an authorized owner review.
- This PR does not enable a provider, set/rotate a key, increase a quota, or change billing.
- This PR does not send new fields to any model. The existing server-built, field-allowlisted, bounded context remains the only business context sent to configured providers.
- It does not prove live deployed Edge Function parity; the current deployed function and provider environment require a separate read-only runtime observation and staging acceptance.
- It does not create a fully offline analytical model; local fallback is a deterministic availability message only.

## 6. Acceptance and remaining P1-C work

**Implemented in this source candidate:**
- disabled Firebase accounts fail closed;
- token verification outage is distinguished from invalid credentials;
- provider requests have bounded timeout;
- no-provider and quota/transport failure return deterministic local response;
- raw provider errors and sensitive context are not copied into local fallback;
- synthetic Deno tests run in CI.

**Remaining before P1-C runtime acceptance:**
1. Read-only re-observe the live Supabase function version/configuration and compare with the canonical source.
2. Verify that provider keys are server-side only and the configured Gemini/Groq services meet the owner's cost/privacy terms; otherwise keep provider disabled.
3. Run approved Staging positive/negative tests with synthetic users for disabled accounts, wrong organization, unsupported roles, forged resource IDs, prompt injection, provider-off, quota exhaustion and timeouts.
4. Verify that all UI pages display the local fallback as an availability message and do not label it as an AI-generated answer.
5. Review retention/logging of Copilot conversation/message documents separately; this PR does not change existing user-owned conversation storage.
6. Obtain separate approval before deploying the Edge Function.

No deployment, live provider invocation, secret/configuration mutation, customer-data access or billing change is included in this PR.
