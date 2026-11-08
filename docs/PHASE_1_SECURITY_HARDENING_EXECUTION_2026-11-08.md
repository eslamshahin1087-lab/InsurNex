# Phase 1 — Security Hardening Execution Notes

**Date:** 2026-11-08  
**Branch:** `fix/phase1-security-runtime-hardening-20261108`  
**Base commit:** `725b6f461d29b9d08fc68d0723bf993b690441e8`

## Implemented in this change

### Client timeline tenant binding

A source review found that Firestore Rules authorized timeline creation by checking the parent client and the caller's role, but did not require the event's own `organizationId` and `clientId` fields to match that parent path. A valid user could therefore write internally inconsistent tenant metadata to a timeline event beneath a client they were already authorized to access.

The Rules now require:
- event `organizationId` equals the parent client's organization ID resolved with `getAfter`;
- event `clientId` equals the `clientId` path segment;
- event `by` remains equal to the authenticated UID;
- the existing parent-client, active-tenant and Owner/Admin/Broker checks remain unchanged.

The Firestore Emulator regression suite now attempts two synthetic negative writes: one with a forged organization ID and one with a mismatched client ID. Both must be denied. The existing valid timeline fixture remains in place.

### Client timeline reader

The timeline reader now:
- validates the client and organization identifiers before querying;
- rejects invalid/non-positive limits and caps reads at 100;
- excludes timeline records without an exact matching organization ID;
- uses the unordered compatibility fallback only for Firestore `failed-precondition` (index) errors;
- propagates permission, network and other failures rather than retrying them as if they were index errors.

## Scope and safety

- No client records, documents, storage objects, or production data were read or changed.
- No Firebase/Supabase secrets, project configuration, billing, deployed functions, indexes, or production resources were changed.
- The Rules change is source-only until separately approved and deployed; production behavior is unchanged.
- The Emulator tests use synthetic fixtures and must run only against `demo-insurnex`.

## Validation status

- Changes are committed to the feature branch and submitted for PR CI/Secrets Scan.
- Local build and Emulator execution were not run in this environment. The container could not resolve `github.com` for a local clone; therefore no local test pass is claimed.
- Do not merge this PR until GitHub CI and Secrets Scan both pass and the diff is reviewed.

## Remaining Phase 1 gates

1. Complete a full call-site classification of client readers/writers and distinguish heuristic audit signals from proven data flows.
2. Review the Document Gateway runtime configuration in an approved non-production environment; source tests alone do not verify deployed function, bucket privacy, CORS, or secrets.
3. Map every Firebase Functions export to its callers and document a verified Spark-compatible path before any endpoint replacement.
4. Keep proposed sensitive collections default-denied; do not migrate or backfill customer data in this phase.
