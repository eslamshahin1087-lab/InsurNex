# Client Sensitive-Data Separation Plan — Local, Proposal Only

## Purpose

The inventory stage identifies field-path presence; this planner turns a sanitized inventory report into a proposal for review. It does not migrate records or decide final data classification. It is a development aid for Phase 3 and should be run only on a local, access-restricted inventory file.

## Precondition

Run the approved read-only field inventory first. The inventory file includes organization/client document IDs and field-presence patterns, so treat it as sensitive. Do not commit it, attach it to tickets, or paste it into chat.

## Command

From the repository root:

```sh
node functions/scripts/client-sensitive-data-separation-plan.mjs \
  --dry-run \
  --input artifacts/client-sensitive-data-inventory-insurnex-8a9df-<timestamp>.json
```

The report path above is an example. Use the actual file produced by the inventory tool. The planner creates a new JSON file under `artifacts/` by default and refuses to overwrite an existing file. Use `--help` to see the available options.

## What the planner does

- Consumes only the inventory's documented identifiers, field paths, categories and scan completeness metadata.
- Proposes logical target collections such as `clientSensitiveProfiles`, `clientMedicalProfiles`, `aiFindings` and `documents`.
- Keeps an explicit top-level allow-list as a base-profile candidate; this is not an authorization decision.
- Flags composite parent objects for leaf-field splitting rather than proposing the same parent and descendants as separate copies.
- Leaves unknown field paths unclassified.
- Requires human review for every proposed mapping, including contact fields.
- Marks the result incomplete when the source inventory reached its record cap.

## What the planner never does

- No Firebase, Firestore, Supabase or Storage client is imported by the planner.
- It never reads source field values; the input is the sanitized field inventory report.
- It never writes destination documents, changes Rules/indexes, signs URLs, copies files or deletes legacy fields.
- It does not decide legal basis, purpose limitation, consent, retention, export/delete behavior or role permissions.
- A suggested destination does not establish that the target schema is approved or deployed.

## Review before migration

The data owner and engineering reviewer must resolve all unclassified paths and review the suggested classifications, parent splits, target schema version, relationship integrity, compatibility adapter, rollback/resume strategy, legal basis, retention and export/delete implications. Test the intended RBAC and tenant denials with synthetic data in the Firestore Emulator. A separate PR and explicit approval are required for any migration writer.

## Review the generated plan locally

After the planner emits its local JSON file, run the structural reviewer against that file:

```sh
node functions/scripts/client-sensitive-data-separation-review.mjs \
  --dry-run \
  --input "artifacts/client-sensitive-data-separation-plan-<project>-<timestamp>.json"
```

The reviewer prints only aggregate metrics and stable violation codes; it does not print client/organization IDs or field paths. A result of `review_only` means structural checks passed. It is **not** consent, legal approval, RBAC approval or authorization to migrate. A result of `blocked` must be corrected before human review.

## Regression check

```sh
npm run test:client-sensitive-separation-plan
npm run test:client-sensitive-separation-review
node functions/scripts/client-sensitive-data-separation-plan.mjs --help
node functions/scripts/client-sensitive-data-separation-review.mjs --help
```
