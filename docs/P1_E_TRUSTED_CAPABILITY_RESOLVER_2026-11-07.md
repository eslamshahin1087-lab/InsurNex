# P1-E — Trusted Capability Resolver and Membership Self-Grant Guard

**Date:** 2026-11-07  
**Scope:** source-only resolver, Firestore membership create allowlist, synthetic runtime/Emulator tests and CI review reporting.  
**Status:** implementation candidate; no capability grants provisioned, no sensitive collections opened, no migration or deployment.

## Implementation

- `resolveTrustedClientActor` continues to derive identity, role and tenant exclusively from server-side Firebase records. It now also parses exact `client.sensitive.read.<dataClass>` capability identifiers from the active organization membership document.
- `resolveTrustedClientCapability` resolves one specific data-class read capability after reloading the trusted actor.
- Missing/malformed/unknown capability values resolve to an empty list. Values on the user profile are ignored. Role labels never imply a sensitive-data capability.
- Firestore Rules constrain browser-created membership documents to the approved profile fields. This blocks capability injection during owner workspace creation and invitation acceptance. Existing membership updates already restrict changed fields to role/status/displayName/updatedAt.
- Synthetic runtime tests cover explicit membership grant recognition, profile-forged grant rejection, unknown values, no role defaults and data-class separation.
- Demo Firestore Emulator tests cover capability injection during owner onboarding and invite acceptance.
- CI now generates the privacy-safe file/line review queue from the exact candidate tree using `npm run audit:client-data-review`.

## Trust boundary

This resolver does not assign grants. It reads only a server-provisioned membership field, and no browser-facing writer or provisioning endpoint is introduced. No capabilities are seeded by this PR. Until a data owner approves the field-purpose/legal-basis/retention/role matrix and an independent trusted provisioning process exists, membership capability arrays should remain empty.

A capability is not sufficient on its own to expose sensitive data. The existing pure sensitive-access evaluator still requires an approved, purpose-bound, independent approver, verified same-tenant client/record relationship, a recorded audit event and a short-lived grant. No sensitive reader currently consumes this resolver to expose a proposed collection.

## Remaining acceptance gates for Issue #111

1. Manually reconcile every reported production read/write against real call graphs and trusted endpoint behavior; record false positives and missed aliases.
2. Obtain data-owner decisions for field purpose, lawful basis/consent, retention, export/deletion and role/data-class grants.
3. Establish and review the trusted capability provisioning process with independent approval and audit.
4. Integrate a sensitive reader only after grant storage, collection-specific Firestore Rules and positive/negative Emulator tests are approved.
5. Preserve the legacy Client 360 compatibility path until authorized callers have migrated and parity-tested projections.

No live customer data inventory, Storage access, secrets/configuration mutation, billing change, deployment or migration is performed by this increment.
