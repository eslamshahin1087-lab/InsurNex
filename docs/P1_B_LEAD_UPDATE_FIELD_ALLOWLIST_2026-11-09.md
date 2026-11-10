# P1-B — Lead Update Field Allowlist and Client Link Guard

**Date:** 2026-11-08  
**Branch:** `fix/phase1-lead-update-field-allowlist-20261108`

## Finding

The generic Firestore update rule allowed Owner/Admin/Broker/Sales to change any fields on a tenant Lead while preserving only organization and creator fields. The application service uses a narrower set of updates:
- stage transitions and associated timestamps/reason;
- free-form notes;
- linking/conversion metadata when an authorized Client 360 role creates or links a client.

Without a rule-level boundary, a Sales user could directly alter protected lead fields, skip the application transition checks, or forge a client relationship.

The `leadActivities` collection is created as an audit trail. Existing activity messages may be corrected through a bounded `message`-only update for compatibility; event identity, lead relationship, type, creator and timestamps remain immutable.

## Change

- Add `leadUpdateHasValidShape()` to Firestore Rules.
- Restrict mutable fields to stage/timestamps, notes/lostReason and lead-to-client linking metadata.
- Validate stage transitions against the same progression implemented in `lead.service.ts`:
  - new → contacted/lost
  - contacted → qualified/lost
  - qualified → quotation/lost
  - quotation → negotiation/won/lost
  - negotiation → won/lost
- Keep notes updates available to authorized lead roles while bounding text length.
- Permit changes to `clientId` only for active Owner/Admin/Broker members and only when the target client exists after the write and belongs to the same organization.
- Keep `assignedTo`, `assignedToName`, source/consent metadata and other lead identity fields immutable through generic update.
- Restrict `leadActivities` updates to a bounded `message`-only correction; event identity, creator, relationship and timestamps remain immutable. Event creation and tenant/lead relationship validation remain enforced.
- Add synthetic Firestore Emulator tests for valid stage and notes updates, denial of invalid stage jumps, Sales denial of Client 360 linking, Broker success for a same-tenant link, and immutable lead activity history.

## Compatibility analysis

The allowed fields were derived from `setLeadStage`, `updateLeadNotes` and `ensureLeadClientForSales` in `src/features/leads/lead.service.ts`. The transaction that creates a new Client record and links the Lead is supported by the Rules' post-write relationship check; existing-client links are checked against the same organization.

No Lead data is migrated and no new assignment field is introduced. The current same-tenant role model remains; per-user Lead assignment enforcement requires a separate verified assignment contract and migration.

## Safety

- No collection access role was widened.
- Sales retains organization-scoped Lead read/create and the approved stage/notes update flow.
- Client linking remains limited to Client 360 roles and a same-organization client record.
- No customer records, secrets, project configuration, billing, storage objects, indexes or deployments were changed.


## Conflict resolution

The PR was rebased by a two-parent merge commit onto the current `main` baseline. The merged Firestore rules retain the existing Claims activity and Claims update guards, then add the Lead activity and Lead update guards. The Firestore Emulator test file is based on the current `main` version and includes the Lead regression cases, so no newer Claims coverage is discarded.
