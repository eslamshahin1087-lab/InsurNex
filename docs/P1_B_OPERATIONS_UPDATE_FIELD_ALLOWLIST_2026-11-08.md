# P1-B — Operations Update Field Allowlist

**Date:** 2026-11-08  
**Branch:** `fix/phase1-operation-update-field-allowlist-20261108`

## Finding

The generic Firestore business-record update rule authorized Owner/Admin/Broker/Claims to update an `operations/{operationId}` record when the organization and creator fields remained unchanged. It did not constrain the other changed fields. A permitted operations user could therefore alter fields such as `clientId`, `rfqId`, `ownerId`, `createdAt`, or free-form notes even though the current application workflow only needs a small set of operation updates.

The `operationEvents` collection was also covered by the generic update predicate, although the application writes activity events by creating new records and has no event-update flow.

## Change

- Add `operationUpdateHasValidShape()` to Firestore Rules.
- Restrict operation-record updates to the fields used by current application services:
  - status and updated timestamp;
  - quote document reference, insurer, premium, currency and approval reason;
  - issued policy ID/number/document reference and completion timestamp.
- Validate allowed status values and types for updated fields.
- Keep organization ID and creator immutable under the existing generic guards.
- Deny updates to `operationEvents`; new events continue to be created through the existing append path.
- Add synthetic Firestore Emulator tests for:
  - valid status progression update;
  - valid quote-handoff metadata update;
  - valid policy-completion reference update;
  - denial of client relationship mutation;
  - denial of arbitrary notes/unapproved fields;
  - denial of operation-event mutation.

## Compatibility analysis

The allowed field set was derived from the current repository's `operations-workflow.service.ts`:
- `updateOperationStatus` changes status and updatedAt.
- The duplicate quote handoff updates quoteDocumentId, quoteDocumentName, insurerId, premium, currency, approvalReason and updatedAt.
- `completeIssuanceOperationV971` updates status, policyId, policyNumber, policyDocumentId, completedAt and updatedAt.

No client, RFQ, creator, owner, organization or other identity/reference fields are changed by these current update helpers.

## Safety

- Existing operation create/read/delete role decisions are unchanged.
- No role or collection access was broadened.
- No customer records, operation documents, indexes, secrets, project configuration, storage objects, billing or deployment were changed.
- Emulator tests use synthetic data under `demo-insurnex`.
