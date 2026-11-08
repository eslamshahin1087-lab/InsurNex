# P1-B — Claims Update Field Allowlist

**Date:** 2026-11-08  
**Branch:** `fix/phase1-claim-update-field-allowlist-20261108`

## Finding

The generic Firestore business update rule allowed Owner/Admin/Broker/Claims to update claim documents while preserving organization and creator identity, but it did not restrict the other changed fields. The active claim workflow service currently changes only `status` and `updatedAt` after claim creation. A permitted Claims user could otherwise alter financial amounts, description or the client/policy relationship through a direct Firestore write.

The `claimActivities` collection is used as an activity log and the application appends entries; it did not need a generic update path.

## Change

- Add `claimUpdateHasValidShape()` to Firestore Rules.
- Limit claim-document updates to `status` and `updatedAt`.
- Validate status values against the existing claim/status vocabulary and require a timestamp for updatedAt.
- Deny updates to `claimActivities`; new activity events continue to be written through the existing create path.
- Add synthetic Firestore Emulator tests for:
  - a valid Claims status transition;
  - denial of changes to approvedAmount;
  - denial of changes to clientId;
  - denial of changes to description;
  - denial of claim activity mutation.

## Compatibility analysis

The only active claim mutation path found in the inspected claims service/page files is `transitionClaimStatus`, which updates `status` and `updatedAt`. Claim creation continues to set the full new claim record. Activity entries remain append-only.

The rule accepts the status values used by the current `Claim` type and workflow helper, including both `settlement` and `settled` spellings already present in the repository. This PR does not change the UI status vocabulary or the transition map.

## Safety

- No role read/create/delete access was broadened.
- No claim data, amount, relationship or activity record was read or migrated.
- No customer records, rules deployment, indexes, secrets, billing, project settings, storage objects or production resources changed.
- Emulator tests use synthetic fixtures under `demo-insurnex`.
