# P1-B — Role-Scoped Dashboard Data Access

**Date:** 2026-11-08  
**Branch:** `fix/phase1-role-safe-dashboard-data-20261108`

## Finding

The authenticated dashboard called the same client, policy and claim aggregate queries for every organization role. This did not match Firestore Rules: the legacy mixed-sensitivity `clients` collection is readable only by Owner/Admin/Broker, while policy and claim metadata are available to Owner/Admin/Broker/Claims. Tasks remain tenant-scoped and readable to all organization roles.

The unscoped dashboard queries could therefore cause permission-denied failures for Sales, Finance and Staff users, and the Clients query also conflicted with Claims' restricted Client 360 boundary.

## Change

- Add a pure dashboard role-access policy matching the existing Firestore read matrix.
- Skip client aggregate queries for every role except Owner/Admin/Broker.
- Skip policy, renewal and claim queries for roles that Rules do not allow to read those collections.
- Apply the same guards to dashboard-generated claim and renewal notifications.
- Keep the organization-scoped task query available to all organization roles.
- Represent unauthorized metrics as `null` (not zero), and omit unavailable counts from Copilot context.
- Hide dashboard metric widgets, charts, shortcuts and quick actions for collections the current role cannot read.
- Avoid showing the onboarding checklist when either required client/policy aggregate is unavailable.
- Keep Firestore Rules unchanged; this is query planning and UI alignment, not a new authorization grant.

## Role matrix used

| Role | Client metric | Policy/renewal metric | Claim metric | Task list |
|---|---:|---:|---:|---:|
| Owner | Yes | Yes | Yes | Yes |
| Admin | Yes | Yes | Yes | Yes |
| Broker | Yes | Yes | Yes | Yes |
| Claims | No | Yes | Yes | Yes |
| Sales | No | No | No | Yes |
| Finance | No | No | No | Yes |
| Staff | No | No | No | Yes |
| Platform Admin / unknown | Not a tenant role | Not a tenant role | Not a tenant role | Separate Platform Admin surface / unknown roles fail closed |

## Regression coverage

The new dashboard RBAC test verifies:
- the role matrix, including fail-closed handling for unknown roles;
- query guards around client, policy and claim aggregates;
- role-aware renewal and notification data loading;
- unavailable metric representation and preservation of the existing Firestore client-read rule.

The CI workflow runs this test before the application lint/build and the full Firestore Emulator suite.

## Safety

No collection permissions were widened. No client or policy records were read outside existing authorized app paths, no customer data was migrated, and no Firestore Rules, indexes, project settings, secrets, billing or production deployments were changed.
