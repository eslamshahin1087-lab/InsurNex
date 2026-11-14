# P1-B — RFQ Update Field Allowlist

**Date:** 2026-11-08  
**Branch:** `fix/phase1-rfq-update-field-allowlist-20261108`

## Finding

The generic Firestore business update rule allowed Owner/Admin/Broker/Sales to update any fields on an RFQ as long as the organization and creator fields were preserved. The current RFQ and quote services need a narrower set of mutable fields; the generic rule otherwise allowed direct changes to the client, lead and other identity/relationship data.

## Change

- Add `rfqUpdateHasValidShape()` to Firestore Rules.
- Limit RFQ updates to:
  - workflow status and updated timestamp;
  - insurance type and coverage summary;
  - document IDs and insurer submission metadata;
  - selected quote, selected insurer and issued policy references.
- Validate supported RFQ status values and basic types for each changed field.
- Keep `organizationId`, `clientId`, `leadId`, `clientName`, `createdBy` and other root identity fields immutable through the generic update path.
- Add synthetic Firestore Emulator tests for valid update patterns used by RFQ, quote selection, repricing and policy issuance services; deny client/lead identity changes, forged client names and unknown statuses.

## Compatibility analysis

The allowlist is derived from the existing writers in:
- `src/features/rfq/rfq.service.ts`: updateRfqStatus, updateSubmissionStatus, updateRfqDetails, updateSubmissionMeta, updateRfqStatusV976 and recordRepricingRequestV981.
- `src/features/quotes/quote.service.ts`: quote receipt, quote selection and issuance update fields on the related RFQ.

The nested `insurers` array remains a structured field updated by the existing service functions; this PR validates that the field remains a list but does not introduce a nested object schema or insurer assignment model.

## Safety and remaining limits

- No collection read/create/delete role was widened.
- No customer data, RFQ data, indexes, secrets, project configuration, billing, storage objects or production deployment changed.
- Relationship and assignment scoping beyond the immutable organization/client/lead references remains a separate P1 decision. This PR does not introduce per-user insurer assignment.

