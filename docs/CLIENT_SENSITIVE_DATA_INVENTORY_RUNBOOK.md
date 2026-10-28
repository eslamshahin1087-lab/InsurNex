# Client Sensitive-Field Inventory — Read-Only Runbook

## Purpose

InsurNex currently stores different classes of information in the same `clients/{clientId}` Firestore document. Depending on the record generation, that document may contain basic contact/profile fields alongside national/tax identifiers, individual/corporate profile objects, risk data (including health details), risk assessments, AI analysis, document references, financial values, and free-form notes.

Firestore Rules cannot remove selected fields from a document that the caller is allowed to read. This inventory provides a first, read-only schema map before designing a reversible separation into independently authorized records.

## Safety contract

- The command requires `--dry-run`; no cloud-write implementation exists.
- It reads only the `clients` Firestore collection, capped by `--max-records` (default 1,000).
- It does not read or write Storage, update Firestore, change Rules, split records, invoke AI providers, or perform a migration.
- It outputs Firestore document IDs, organization IDs, field paths, categories, and counts only.
- It does not output raw field values, client names, phone/email values, national/tax identifiers, notes, health values, document URLs, signed URL tokens, or document contents.
- The report may still reveal which categories of information exist for a given client. Keep it local, restrict access, and do not upload it to GitHub, tickets, chat, or a shared folder.
- Local reports are ignored by Git via `artifacts/client-sensitive-data-inventory-*.json`. The ignore rule does not encrypt or protect the local file.

## Command

Run from the repository root in Cloud Shell (or another approved environment with Firestore read access):

```sh
node functions/scripts/client-sensitive-data-inventory.mjs \
  --dry-run \
  --project insurnex-8a9df \
  --max-records 1000
```

Use `--help` for options. The default local output path is a timestamped JSON report under `artifacts/`; the script refuses to overwrite an existing path. Authentication uses Application Default Credentials (ADC). Grant read-only Firestore access for the intended project and do not use a service-account JSON key committed to a repository.

## Field classes

The scanner records field-path presence, not content. Its categories are indicators to guide review—not a substitute for legal, privacy, or data-owner classification.

- `basic_contact`: presence of basic name/contact/location fields.
- `identity`, `identity_profile`, `corporate_profile`: identity, KYC, national/tax identifiers, and detailed individual/corporate profile structures.
- `health`, `family`, `risk_profile`: health/risk/family/dependent-related fields.
- `financial`: income, revenue, capital, premium/commission or related values.
- `derived_assessment`, `derived_analysis`: risk assessment and AI-derived fields.
- `document_references`: document metadata and URL/path fields.
- `freeform_notes`: notes and narrative fields.
- `contact_address`: address, location, occupation/employer or related details.

Field paths are generalized for arrays (for example, `documents[].url`); array indices and file contents are not copied. Unknown object fields inside known private roots may appear as paths but their values are not returned.

## Reading the report

- `clientRecordsScanned`: number of Firestore client documents returned by the query.
- `recordsWithSensitiveOrPrivateFields`: records where one or more non-empty classified fields were found.
- `recordsByCategory`: number of records in which each category appears. A record can appear in more than one category.
- `pathPresenceCounts`: number of records with each detected field path.
- `records[].fieldPaths`: present field names/paths only.
- `scan.potentiallyIncomplete`: true if the configured record cap was reached. If true, rerun with a higher `--max-records` after considering Firestore read volume.

Do not infer that a field is absent from all records just because the cap was not reached unless the inventory ran against the intended project and completed successfully.

## Recommended separation design

Do not start by writing a migration. First review the path inventory with the product/data owner and agree on a schema and role matrix. The proposed model should keep the default client record limited to the minimum business/contact summary needed for lists and workflows, and place more sensitive classes in separately authorized records, for example:

- `clients/{clientId}/privateProfiles/identity` for national/tax identifiers and KYC-related fields.
- `clients/{clientId}/privateProfiles/health` for medical and health-risk details.
- `clients/{clientId}/privateProfiles/financial` for client financial details not needed by all roles.
- Separate references to storage-managed documents, without persistent signed URLs.
- Restricted, reviewed access to free-form notes and derived AI/risk analysis, with provenance and retention controls.

These are design candidates, not a deployed schema. Do not adopt them without checking existing query dependencies, role requirements, claims workflows, exports, reporting, and AI prompt construction. In particular, assignment-level authorization and claim-to-client/policy relationships must be enforced in a trusted layer or Rules—not merely hidden in the frontend.

## Required next steps before any migration

1. Review the field-path inventory and agree the schema/role matrix with data owners.
2. Audit all read/write call sites for `clients.individual`, `clients.corporate`, `riskData`, `nationalId`, `taxId`, `riskAssessment`, `aiAnalysis`, `documents`, `notes`, and related paths.
3. Implement separately authorized read/write services and Rules, plus negative cross-tenant/role tests in the Firebase Emulator.
4. Create a dry-run migration planner that maps each source record to proposed target records by stable client ID, field presence, and schema version. Never log the values.
5. Verify source/target counts and read compatibility in staging, and define a rollback manifest before any write.
6. Deploy Rules/app in a staged, backward-compatible sequence. Do not remove legacy fields until all consumers have moved and staging proves the intended roles cannot read them.
7. Require explicit approval before any production data migration or Rules/hosting/function deployment.

## Regression checks

From the repository root:

```sh
npm run test:client-sensitive-inventory
npm run test:rules
npm run test:access
npm run lint
npm run build
npm run build --prefix functions
```

The Firestore Rules suite must only target `demo-insurnex` emulator resources, never the production project.
