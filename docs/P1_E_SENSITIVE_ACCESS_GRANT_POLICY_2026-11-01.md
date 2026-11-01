# P1-E — Sensitive Client Access Grant Policy Candidate

**Date:** 2026-11-01  
**Branch:** `feat/p1e-sensitive-access-policy-20261101`  
**Base:** `main` after PR #102  
**Status:** pure, fail-closed policy evaluator and synthetic tests; no Firestore reader/writer, no new collection rules and no migration.

## 1. Purpose

The existing sensitive-data RBAC proposal requires tenant membership, role capability, resource relationship, purpose limitation and audit evidence. It also states that Owner/Admin are not blanket readers of sensitive records and that Platform Admin has no routine tenant-content access.

This candidate converts those invariants into a deterministic evaluator for a future trusted server-side repository. It does not decide which roles receive capabilities. Capabilities must be derived from a separately approved role/data-class matrix by a trusted resolver.

## 2. Required trusted inputs

The evaluator expects three server-derived inputs:

- **Actor:** verified UID, active user profile, active organization membership, organization role and capability identifiers resolved by trusted code.
- **Grant:** a server-loaded approved grant bound to one actor, one organization, one client, one record, one sensitivity class and one action.
- **Resource:** a server-loaded record with organization/client/record identifiers and a relationship-verification result set only after checking the parent resource.

Browser-supplied role, capability, grant, organization or relationship flags must never be passed as trusted inputs. This pure function does not authenticate or fetch these values.

## 3. Fail-closed conditions

A read is permitted by the evaluator only when all conditions are satisfied:

1. Actor profile and organization membership are active.
2. Actor is not Platform Admin.
3. Trusted capability contains the exact `client.sensitive.read.<dataClass>` identifier.
4. Resource belongs to the actor's organization and its client relationship was verified by the trusted reader.
5. Grant is approved, schema version 1 and contains no unrecognized fields.
6. Grant matches the actor UID/role, organization, client, record and data class exactly.
7. Action is `read` only; write, export and download are not supported.
8. Purpose is explicit and non-trivial.
9. Approver is present and is not the requesting actor (independent-approval safeguard).
10. Audit event ID is present and the trusted caller confirms the event has already been recorded.
11. Grant is currently valid and its lifetime does not exceed 15 minutes.

Every missing, invalid, mismatched or expired condition returns a generic denial reason. A successful decision returns only the grant ID, audit event ID and expiry—not client fields, purpose text or document metadata.

The 15-minute limit and independent-approver check are conservative candidate safeguards; review them with the data owner before a production grant-issuance workflow is introduced.

## 4. Current implementation boundary

- The evaluator is a pure JavaScript module with a TypeScript declaration.
- It performs no Firebase/Supabase import, database query, audit write or grant issuance.
- It is not called by the current browser pages or deployed Edge Functions.
- No role-to-sensitive-capability resolver has been implemented.
- No trusted append-only sensitive-access audit sink currently exists; `auditLogs` remains default-denied.
- Therefore this PR creates no new production access path and cannot by itself make an existing sensitive collection readable.

A trusted repository must write the immutable audit event first, load the grant from a trusted source, resolve active membership/capabilities, verify parent relationships, then evaluate the grant before fetching the sensitive payload. The same checks must also be enforced at Firestore Rules or a trusted server endpoint; a frontend call is never an authorization boundary.

## 5. Supported data classes and actions

Data classes: identity, family, financial, contact/address, medical, claim-sensitive and AI findings.

Action: read only. Export, write, download and signed URL issuance require separate purpose-specific policies and are not enabled by this evaluator.

AI findings must inherit the strictest source-data classification. A production resolver must establish and validate the source-class manifest before granting an AI-finding read; this evaluator intentionally does not infer source classes.

## 6. Tests

`npm run test:client-sensitive-access-policy` exercises:
- valid approved, audited, purpose-bound and time-limited grants;
- inactive profile/membership and Platform Admin denial;
- missing trusted capability and unverified relationship;
- cross-tenant, cross-client and wrong-record denial;
- pending/revoked grant, malformed envelope and unexpected-key denial;
- UID/role/data-class/action mismatches;
- missing purpose, independent approval or recorded audit event;
- future, expired and overlong grants;
- Firestore Timestamp-compatible expiry values;
- explicit denial of write/export/download actions.

The test uses synthetic identifiers only and the module has no database dependency.

## 7. Remaining prerequisites before a real sensitive-data repository

1. Approve field-by-field data class, role, purpose, legal basis/consent and retention.
2. Define the authoritative trusted capability resolver and who may approve each grant.
3. Implement an append-only trusted audit sink, with immutable actor/resource/action/purpose/grant/decision metadata and no raw PII or signed URLs.
4. Decide whether a grant is stored as a record or generated transactionally at the trusted endpoint.
5. Add collection-specific Firestore Rules or trusted endpoints plus positive/negative Emulator tests.
6. Only then add repository reads and switch one UI consumer at a time using synthetic fixtures.
7. Keep all proposed sensitive collections default-denied until those prerequisites pass.

No Firestore Rules, indexes, customer records, Storage objects, secrets, billing or deployed services are modified.
