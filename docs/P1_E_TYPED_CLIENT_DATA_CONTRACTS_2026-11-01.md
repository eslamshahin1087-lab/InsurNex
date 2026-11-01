# P1-E — Typed Client Data Contracts (Candidate)

**Date:** 2026-11-01  
**Branch:** `feat/p1e-typed-client-data-contracts-20261101`  
**Base:** `main` after PR #101  
**Status:** type and pure projection candidate; no collection access enabled, no migration and no Firestore Rules change.

## 1. Purpose

This change establishes versioned TypeScript contracts for the next Client 360 separation step. It is based on the existing InsurNex models in:
- `src/features/clients/client.types.ts`
- `src/types/claim.ts`
- `src/types/document.ts`
- the existing `ClientBaseSummary` adapter declaration.

It does not infer new field values or read customer records.

## 2. Candidate contracts

- Base client summary: reuses the existing allowlisted `ClientBaseSummary`.
- Identity profile: candidate slices from existing `ClientIndividual` and `ClientCorporate` fields such as national ID, date of birth, legal registration and signatory identity.
- Family profile: only the current model fields `maritalStatus` and `dependents` are typed; no unverified family-member schema is invented.
- Financial profile: typed slices of existing monthly income, annual salary/revenue/turnover, capital, asset values and customer lifetime value.
- Contact-address profile: existing city, area and street fields.
- Medical profile: existing health risk fields including general status, chronic conditions, medications, surgeries, smoker flag, height, weight and last-checkup date.
- Claim-sensitive details: a typed subset of the current `Claim` model. This is a proposed future separation projection, not a new claim data store.
- AI findings: existing `RiskAssessment` and `AiAnalysis` outputs with explicit review/provenance placeholders.
- Client document metadata: a safe projection of the current `DocumentRecord` model.

These are candidate payload types. They are not approved destination schemas or an approved role matrix. The data owner must approve each field, purpose, lawful basis, retention, writer and reader before any collection is opened.

## 3. Common envelope and scope guard

The proposed sensitive record envelope includes:
- `schemaVersion: 1`
- immutable `organizationId` and `clientId`
- explicit `profileKind`
- typed `data`
- `createdBy` and optional updater/timestamps.

Pure runtime helpers validate the envelope shape and assert that a previously-authorized record matches the expected organization and client identifiers. They do **not** authenticate users, authorize roles, replace Firestore Rules or grant collection access.

## 4. Document metadata minimization

The pure document metadata projector accepts only a record already authorized through the existing document access path. It verifies the organization and `relatedType=client` / `relatedId=clientId` relationship before returning metadata.

It deliberately excludes:
- signed `downloadUrl`
- private `storagePath` and `storageBucket`
- free-form `notes` and `description`
- file bytes or embedded upload objects.

This is an in-memory projection utility; no Firestore query or Storage request is added, and no existing document screen is switched to it in this PR.

## 5. Collections and permissions

The contract catalog identifies current versus proposed state:
- `clients`: existing base/legacy record, current Firestore rules unchanged.
- `documents`: existing metadata with manual relation review.
- `clientSensitiveProfiles`, `clientMedicalProfiles`, `claimSensitiveDetails`, `aiFindings`, `auditLogs`: remain **proposed-default-deny**.

No role permissions are assigned by the candidate. Do not interpret this contract catalog as permission to read or write any proposed collection.

## 6. Tests

`npm run test:client-data-contracts` covers:
- valid and invalid versioned envelope shapes;
- unknown-key rejection;
- cross-organization and cross-client envelope mismatch;
- safe document metadata projection;
- removal of signed URL, storage path/bucket and free-form text sentinels;
- default-deny catalog states;
- absence of Firestore reads/writes in the pure utility.

The normal TypeScript/Vite build checks the declaration file and model compatibility.

## 7. Remaining approval gates

1. Manually reconcile the static file/line inventory against every production read and write call site.
2. Obtain data-owner approval for field classifications, purpose, retention and export/delete handling.
3. Approve the exact destination schema and immutable linkage keys.
4. Approve per-role reads/writes and trusted writer endpoints.
5. Add collection-specific Firestore Rules and positive/negative Emulator tests in a separate PR.
6. Only after all gates pass, migrate through a separately approved dry-run-first plan.

No customer records are read, transformed or migrated by this branch.
