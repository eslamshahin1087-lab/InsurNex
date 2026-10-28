# Legacy Embedded Client Documents — Secure Access Runbook

## Purpose

Older InsurNex client profiles may store document references inside `clients.documents[]`. Some records contain a Supabase Storage signed URL instead of a stable storage reference and do not declare `storageProvider`. Signed URLs are temporary and must not be reused as permanent application metadata.

The compatibility gateway in `supabase/functions/document-storage/index.ts` lets an authorized user request a fresh, short-lived read URL for one embedded legacy document without sending the stored URL, path, or token from the browser.

## Security controls

- The caller must present a valid Firebase ID token.
- The caller's Firestore-visible profile must be active and belong to the requested organization.
- The client record must be readable by the caller and belong to that same organization.
- The embedded document is selected by its exact stored ID; the browser cannot choose an arbitrary object path.
- The stored reference must resolve to the configured Supabase project's exact host and configured private bucket.
- The object key must match `organizations/{organizationId}/clients/{clientId}/{allowedArea}/{filename}`; traversal and cross-tenant paths are rejected.
- If both a stable path and URL are stored, they must resolve to the same bucket and object key.
- Roles are read-only on this compatibility route: `owner`, `admin`, and `broker` may read; `claims` may read only records explicitly categorized as claims. Other roles are denied.
- The server uses the service role only after authorization checks; it verifies object metadata and compares recorded size/content type when those values are available.
- Returned URLs expire after 15 minutes. The endpoint performs no upload, Firestore write, storage mutation, legacy record update, or deletion.
- Signed URL query parameters are not returned by the listing service and are never accepted from the browser as authorization input.

## Rollout order

The new endpoint must be deployed before the front-end hosting build that invokes it.

1. Review and merge the source change after CI, the storage gateway policy tests, and secrets scanning pass.
2. Confirm required Supabase Edge Function secrets are configured: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, Firebase API key, and `FIREBASE_PROJECT_ID`. Do not reveal or copy secret values into source control or chat.
3. Deploy only the `document-storage` Edge Function using the approved release procedure. Do not deploy other functions as part of this step.
4. Call the documented liveness endpoint and confirm the `supportedActions` list includes `legacy-client-sign-download`. The ping response reveals no secret/configuration values.
5. Deploy the front-end hosting build only after the new Edge Function is verified.
6. Test with an owner/admin/broker user in the same organization: legacy items appear in the Client Documents panel; view/download obtains a fresh URL; a wrong client, wrong organization, unsupported role, modified document ID, unsupported host, wrong bucket, or invalid path is denied.
7. Test as a claims user and confirm identity/other legacy documents are not shown or signed.
8. Keep the original embedded reference unchanged while testing. Do not add delete or automatic migration behavior to this compatibility route.

## Current known production finding

As of 2026-10-28, three embedded client document references were classified as Supabase Storage signed URLs in the `insurnex-documents` bucket. Read-only inspection found one matching `storage.objects` row for each path hash; all three objects' stored sizes and MIME types matched their embedded metadata. The files themselves were not downloaded or byte-hash verified.

The currently deployed Edge Function has not been updated by this source change. Until the function is deployed first, the new front-end action must not be released.

## Verification commands

Run from the repository root:

```sh
npm run test:storage-gateway
npm run test:storage-inventory
npm run test:rules
npm run lint
npm run build
npm run build --prefix functions
```

CI also runs the repository's configured test, build, and secrets-scan workflows.

## Follow-on migration (separate approval)

This compatibility path is deliberately read-only. The long-term target is to convert embedded references into first-class `documents` records with permanent fields such as `storageProvider`, `storageBucket`, and `storagePath`, then update clients to resolve temporary URLs only when needed.

A future backfill must be idempotent and dry-run first, preserve the original embedded fields during verification, map only exact metadata matches, and produce a reviewed manifest. Do not delete or rewrite legacy references until all access paths have passed staging tests and the owner explicitly approves the production migration.
