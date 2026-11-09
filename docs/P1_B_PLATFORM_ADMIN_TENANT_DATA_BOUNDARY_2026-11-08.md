# P1-B — Platform Admin Tenant Business-Data Boundary

**Date:** 2026-11-08  
**Branch:** `fix/phase1-platform-admin-business-data-boundary-20261108`

## Finding

The Platform Admin user-details screen fetched organization-scoped aggregate counts directly from the tenant `clients`, `policies`, `claims` and `leads` collections. The Firestore security model deliberately does not grant Platform Admin a blanket bypass into tenant business collections; in particular the legacy `clients` collection remains readable only by active Owner/Admin/Broker members of the same tenant.

Because the four aggregate reads were combined in one `Promise.all`, a permission denial from one source prevented the complete set from being assigned. The UI then retained its initial zero values, which could be mistaken for real business counts.

## Change

- Remove the Platform Admin page's direct aggregate queries to tenant business collections.
- Represent unavailable counts as `null` and render an em dash rather than a false zero.
- Add an explanatory note that detailed activity metrics are available inside the tenant workspace to authorized organization roles.
- Leave Firestore Rules unchanged: Platform Admin remains isolated from organization-owned client/business records.
- Add a CI contract test ensuring the Platform Admin screen has no aggregate query and the generic Firestore rule retains the tenant and role boundary.

## Safety and scope

- No tenant business-data access was granted.
- No Firestore Rules, indexes, customer records, document objects, secrets, project configuration, billing or deployment were changed.
- The Platform Admin continues to manage user/subscription metadata through its separate administrative permissions; it does not gain a bypass to tenant clients, policies, claims or leads.

## Validation

- CI must pass the new `test:admin-tenant-boundary` check, lint/build, and Firestore Emulator regression suite on `demo-insurnex`.
