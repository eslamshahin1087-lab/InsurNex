# P1-B — Role-Scoped Operations Center

**Date:** 2026-11-08  
**Branch:** `fix/phase1-role-safe-operations-workspace-20261108`

## Finding

The Operations page loaded all data sources in a single `Promise.all`:
- full legacy client records;
- tenant documents;
- operations email directory;
- tenant RFQs;
- claims, policies/renewals, tasks and operation work items.

Firestore Rules intentionally allow Claims to read claim-related documents, claims, policies, operations and the operations email directory, but do not allow Claims to read the mixed-sensitivity `clients` collection or RFQs. A Claims user could therefore hit `permission-denied` during page initialization even though the Operations Center's claim/operation workflows are allowed.

The page also displayed client onboarding, client account and RFQ workspaces to Claims even though those actions require Owner/Admin/Broker client-record access.

## Change

- Add a pure Operations role-access policy matching the existing Firestore Rules.
- Permit Operations Center access only to Owner/Admin/Broker/Claims.
- Query legacy clients only for Owner/Admin/Broker.
- Pass only the existing `ClientBaseSummary` projection into Operations UI state/components rather than retaining full `InsuranceClient` records. This remains client-side projection after Firestore reads, not field-level server authorization.
- Query organization RFQs only for Owner/Admin/Broker.
- Keep `listDocuments` for Claims because its existing service adds a Firestore `category == 'claim'` filter for that role.
- Preserve Claims access to claims, policies/renewals, operation work items, and the operations email directory.
- Remove the unused claim-record preload from `OperationsSnapshot`; Operations does not render this payload and the dedicated Claims page remains the claim workflow.
- Hide new client onboarding, client CRM/RFQ workspaces, Accounts, Smart client analysis, and client-centric shortcuts from Claims.
- Remove the prospect count from the Claims overview chart to avoid presenting an unauthorized zero.
- Pass only minimal document references (`id`, `relatedType`, `relatedId`) into the Operations UI state/components; do not retain signed URLs, storage paths or free-form document metadata in this surface.
- Hide the Client 360 navigation link from Claims in the Operations inbox; the role can work with the permitted operation flow without a dead-end link to a denied client record.
- Deny Operations page rendering for roles outside the role allowlist; no unsupported query is issued.
- Keep Firestore Rules unchanged.

## Role matrix

| Role | Operations inbox | Client/Accounts | RFQ workspace | Client onboarding | Claim documents | Email directory |
|---|---:|---:|---:|---:|---:|---:|
| Owner / Admin / Broker | Yes | Yes | Yes | Yes | Existing access | Yes |
| Claims | Yes | No | No | No | Claim category only | Yes |
| Sales / Finance / Staff / unknown | No | No | No | No | No tenant access from this surface | No |

## Regression coverage

The added CI test verifies the role matrix, query guards, view/shortcut gates, role-filtered document behavior, and the unchanged Firestore role boundaries.

## Safety

No client permissions were widened. No customer data, Firestore Rules, indexes, Storage objects, secrets, configuration, billing or production deployments were changed.
