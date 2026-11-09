# P1-E — Policy Form Base Client Projection

**Date:** 2026-11-08  
**Branch:** `fix/phase1-policy-form-client-summary-20261108`

## Finding

The policy creation form loaded `InsuranceClient` records through the deprecated `listClients(organizationId)` service. The form needs only a limited client selector (identifier, name and contact/basic status fields), not the full legacy client object containing mixed-sensitivity identity, family, financial, medical, free-form notes and AI-derived fields.

## Change

- Replace `listClients(organizationId)` with `listClientSummaries(profile)`.
- Store the result as `ClientBaseSummary[]` instead of `InsuranceClient[]`.
- Keep policy creation behavior, client selection, insurer selection and the policy write flow unchanged.
- Extend the existing client data projection regression test to assert that `PolicyForm` uses the summary adapter and no longer imports `listClients` or `InsuranceClient`.

## Security boundary

This is application-state minimization only. The summary adapter still reads the existing legacy client document under the current Owner/Admin/Broker Firestore role restriction, then projects an explicit allowlist. Firestore Rules do not redact fields on documents a caller can read. This change does not claim field-level server authorization or sensitive data separation.

The legacy writer and Client 360 paths remain in place until all consumers, data-owner decisions, destination collections, migration/rollback and trusted-reader behavior have been separately reviewed.

## Safety

No Firestore Rules, indexes, customer records, secrets, project settings, storage objects, billing or deployments were changed.
