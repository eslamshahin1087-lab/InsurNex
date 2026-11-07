# P1-E — Trusted Client Capability Resolver

**Date:** 2026-11-07  
**Implementation branch:** `feat/p1e-approved-role-capability-resolver-20261107`  
**Status:** source implementation and synthetic runtime tests proposed for review. No sensitive collection is enabled.

## Product-owner decision

The product owner approved the proposed role/data-class matrix as the technical implementation baseline on 2026-11-07. This approval is limited to the access-control design. It is not a legal opinion, does not determine the lawful basis for processing, and does not authorize customer-data migration, production access, deployment, or release.

## Resolver behavior

`resolveTrustedClientCapabilities(db, authenticatedUid)` calls the existing Admin-SDK actor resolver. That resolver independently verifies the active user profile, active organization, matching active membership and matching role, and rejects Platform Admin identities.

Grant eligibility derived from the approved matrix:

| Role | Grant-eligible sensitive classes |
|---|---|
| Owner | Identity, family, financial, contact/address, medical, claim-sensitive |
| Admin | Identity, family, financial, contact/address, medical, claim-sensitive |
| Broker | Identity, family, financial, contact/address, medical, claim-sensitive |
| Claims | Identity, family, medical, claim-sensitive |
| Sales | None by default |
| Finance | None by default |
| Staff | None by default |
| Platform Admin | Rejected by the trusted actor resolver |

The `ai_findings` class remains unavailable to every role until source-class lineage is enforced. AI-derived content must inherit the strictest classification of its source fields; this resolver intentionally does not infer that lineage.

## Critical authorization distinction

The returned capabilities mean **eligibility to be considered for an independently approved grant**, not access by role. Every sensitive read must still:

1. Load the grant from a trusted source, never from browser input.
2. Verify the exact user, role, tenant, client, record, data class and action.
3. Verify the parent/client relationship and required assignment in trusted code.
4. Persist the append-only audit event before returning the payload.
5. Pass the existing fail-closed `evaluateClientSensitiveReadAccess` policy, including independent approval, purpose and 15-minute expiry.
6. Keep Firestore Rules or the trusted endpoint as the actual authorization boundary.

No sensitive-read endpoint is wired by this PR. The five proposed sensitive collections remain default-denied. Legacy Client 360 remains unchanged.

## Verification

The synthetic runtime test covers every organization role, each class mapping, inactive profile, inactive/mismatched membership, missing organization, Platform Admin rejection and immutable returned capability lists. The test uses synthetic identifiers and an in-memory Firestore stub only.

## Remaining gates

- Manually reconcile every production call path and classify legacy reader/writer use.
- Obtain separate data-owner decisions for field-level purpose, lawful basis, retention, export/deletion and record assignment.
- Build and review a trusted grant-issuance/approval and sensitive-read endpoint.
- Add collection-specific Rules/Emulator authorization tests before enabling any proposed collection.
- Run Staging acceptance in a separately designated environment before any sensitive runtime activation.

No Firestore Rules, indexes, customer records, Storage objects, secrets, runtime configuration, billing, project state or deployed services are changed.
