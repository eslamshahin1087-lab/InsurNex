# P1-D — Document Gateway Runtime Parity Candidate

**Date:** 2026-11-01  
**Branch:** `feat/p1d-document-gateway-runtime-parity-20261101`  
**Base:** `main` at `9d4bcb4521d0410d5906875f66be27e5688a00d4` after merged PR #99  
**Status:** source hardening and synthetic contract checks proposed for review; no staging or production deployment.

## 1. Runtime baseline and provenance

The dated deployed snapshot records:
- Function: `document-storage`
- Deployed version observed in the 2026-10-30 manifest: `22`
- Gateway JWT verification: `false`
- Snapshot source: an older inline handler, not identical to the current modular repository source.
- Canonical repository source: `supabase/functions/document-storage/index.ts`.

The snapshot and its metadata are historical observations, not proof of the currently deployed version or configuration. No fresh live Supabase metadata query is part of this PR.

## 2. Request authentication boundary

The candidate makes the configuration explicit in `supabase/config.toml`:

```toml
[functions.document-storage]
verify_jwt = false
```

Because the Supabase gateway JWT check is disabled to support modern non-JWT publishable keys, the function now validates the incoming `apikey` itself against the trusted runtime configuration:
- the explicitly configured legacy `SUPABASE_ANON_KEY`, if present;
- the `SUPABASE_PUBLISHABLE_KEYS` map, resolving direct `sb_publishable_*` values or configured environment-variable names.

The common key-allowlist implementation is moved to `supabase/functions/_shared/api-key-authorization.ts` and reused by Copilot and Document Gateway. The browser cannot expand the allowlist.

Firebase ID-token validation remains mandatory. The caller's ID token remains the credential for Firestore reads, so Firestore Rules continue to enforce access. The service-role Supabase client remains limited to Storage operations (signed upload/download and object removal) after the caller-visible profile, metadata, tenant, relationship and role checks succeed.

The public liveness ping remains metadata-free and does not disclose secrets/configuration.

## 3. Runtime resilience and abuse boundaries

- Firebase Identity Toolkit requests now have a 10-second timeout.
- Caller-authorized Firestore reads now have a 10-second timeout.
- Firebase verification outages are distinct from invalid credentials and return a generic 503 response.
- Firestore read availability failures are distinct from permission denial and return a generic 503 response.
- Firebase ID tokens longer than 16 KiB are rejected.
- JSON control requests are streamed with a 64 KiB maximum; oversized requests return HTTP 413.
- Existing MIME allowlists, 10 MiB file-size limit, safe object-path parser and metadata binding checks are retained.
- Upstream SDK/provider error messages are no longer copied into application logs.

These limits apply to the Edge Function control-plane request. File bytes continue to upload directly to Supabase Storage with the scoped signed-upload token; they do not pass through the Edge Function JSON body.

## 4. Signed URL lifetime

New signed download URLs for:
- normal client/general documents; and
- operation attachments

are limited to 15 minutes rather than 60 minutes. The response includes `expiresInSeconds: 900`. Legacy client-document URLs already used a 15-minute TTL and remain read-only.

No signed URL is written into Firestore by this change. The browser provider continues to request a fresh URL through the authenticated gateway.

## 5. Regression coverage

New CI contract test: `npm run test:document-storage-runtime`.

It checks:
- explicit `verify_jwt = false` plus the handler-side Supabase key allowlist;
- Firebase disabled-account rejection and bounded Firebase/Firestore requests;
- caller-token use for Firestore authorization reads;
- request-body and Firebase-token size limits;
- 15-minute download URL TTLs;
- existing MIME/size limits and exact organization/document/operation metadata binding;
- preservation of current browser Firebase-token integration, signed upload flow, legacy read-only route and operation attachments;
- no raw upstream error-message logging.

Existing `npm run test:storage-gateway` path/metadata/role tests remain in CI. Deno type-checking of the Edge Function remains enabled, and the shared Supabase API-key tests are run directly as part of the Document Gateway checks.

## 6. Security and compatibility boundaries preserved

- No arbitrary bucket, object path, or document ID is accepted as authorization evidence.
- Firestore profile, metadata and parent-resource reads continue using the caller's Firebase ID token.
- Tenant, actor, role, relationship, category, filename/document ID and object path bindings remain enforced by the existing policy modules.
- Legacy embedded client documents remain read-only through the compatibility endpoint.
- Operation attachments retain their separate metadata record, pending/ready lifecycle checks and stricter delete role policy.
- No Firestore Rules, indexes, data documents, bucket policy or customer files are changed.

## 7. Remaining acceptance gaps

This PR is not P1-D runtime acceptance. Before any Staging proposal, an authorized operator must:
1. Re-observe the live Edge Function deployed version, bundle hash, `verify_jwt` setting, configured bucket and project identity in read-only mode.
2. Confirm that the expected publishable-key configuration is present in the Edge Function runtime without exposing key values.
3. Run synthetic Staging flows for sign-upload, direct signed upload, metadata reconciliation, list, preview/download, deletion, legacy document download and operation attachment pending/ready/cleanup lifecycle.
4. Verify negative cases: invalid Firebase token, disabled user, inactive profile, wrong tenant, wrong parent relationship, unsupported role/category, forged document ID/path, wrong MIME/size and expired signed URL.
5. Verify actual stored object MIME and size against Firestore metadata after upload. The present source validates declared metadata before signing; end-to-end object reconciliation remains part of Staging evidence.
6. Confirm the observed signed URL expiry matches 900 seconds and that application viewers obtain a fresh URL when needed.
7. Record synthetic test output and a rollback plan. Do not use customer documents or real personal/medical data.

## 8. Safety

No Edge Function deployment/invocation, provider key read/write, secret rotation, bucket mutation, Firestore Rules/index change, customer-data access, document migration, billing change or production route change is included.
