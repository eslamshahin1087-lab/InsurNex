# P1-E — Client Data Access Compatibility Adapter

**Date:** 2026-11-01  
**Implementation branch:** `feat/phase1-client-data-access-adapter-20261101`  
**Status:** merged in PR #96 on 2026-11-01; no data migration or authorization-rule change.

## 1. Verified current boundary

The current Firestore Rules allow direct access to the legacy `clients/{clientId}` document only to active Owner, Admin and Broker members of the same organization. Sales, Claims, Finance and Staff do not have direct read access to this collection. This restriction is intentional because the legacy document contains mixed-sensitivity fields.

Firestore Rules cannot redact fields from a document after a read is permitted. The legacy record can contain identity/KYC, family, health/risk, financial, document-reference, AI and free-form note fields in addition to basic contact details. Therefore, a frontend projection is a data-minimization measure for application state, not field-level authorization.

## 2. Implemented adapter surface

New files:
- `src/features/clients/client-access.policy.js` — pure role/active-status/tenant checks and field projection functions.
- `src/features/clients/client-access.policy.d.ts` — typed contract for the policy module.
- `src/features/clients/client-data-access.service.ts` — Firestore read adapter.
- `scripts/client-data-access-projection-test.mjs` — synthetic regression suite.

The adapter provides two distinct read operations:

### Base client summary

`listClientSummaries(profile)`:
- Rejects missing, inactive or profile-less scopes before making a Firestore request.
- Allows only `owner`, `admin` and `broker`, matching the current Rules.
- Queries only within the caller's `organizationId`.
- Maps each legacy record to an explicit allowlist: ID, organization, client code, type/status, name, phone, email, industry, city, assignment/source metadata and timestamps.
- Excludes national/tax identifiers, street address, free-form notes, individual/corporate nested records, risk/health data, documents, AI analysis, preferences and financial lifetime value from the returned UI object.

The Clients index page now uses this projection type rather than retaining a full `InsuranceClient` document in list state.

### Legacy Client 360 workspace

`getLegacyClientWorkspace(profile, clientId)`:
- Performs the same role, active-profile and organization preflight before reading.
- Reads the existing root client record only for Owner/Admin/Broker.
- Rechecks that the retrieved document's `organizationId` matches the caller's organization.
- Preserves the existing Client 360 shape for backwards compatibility; no fields are renamed or deleted.

The Client Details page now uses this adapter.

## 3. Compatibility and security limits

- This PR does not change Firestore Rules, indexes, Supabase functions, secrets or deployed services.
- This PR does not create `clientSensitiveProfiles`, `clientMedicalProfiles` or any other proposed sensitive collection.
- This PR does not migrate, redact, rewrite, delete or export customer data.
- Existing create/update flows remain on the legacy write path; P1-E is read-adapter-first.
- The base summary is projected after Firestore returns the legacy record. It does not prevent an already-authorized Owner/Admin/Broker browser from technically receiving the full source document. Only Firestore Rules or a trusted projection endpoint can enforce that boundary.
- Sales/Claims/Finance/Staff remain denied from the legacy clients collection. Do not grant them access by adding new roles to the adapter allowlist.
- Legacy `listClients` and `getClient` exports remain temporarily for compatibility but are marked deprecated. Call-site inventory and future removal require separate verification.

## 4. Tests

The regression suite uses synthetic fixtures and verifies:
- only active Owner/Admin/Broker scopes are accepted;
- disabled/invited/profile-less scopes fail closed;
- base summary output contains only allowlisted fields;
- synthetic national ID, tax ID, address, notes, date-of-birth, family, corporate, medical, document and AI sentinels do not appear in the base projection;
- cross-organization records are rejected;
- the Client 360 compatibility projection is available only to approved legacy roles;
- Clients and Client Details UI routes use the new adapter.

CI runs `npm run test:client-data-access-projection` alongside the existing access, client-data and Firestore Emulator suites.

## 5. Remaining P1-E work

1. Complete static call-site audit for every reader and writer of `clients`, nested individual/corporate data, risk data, AI analysis, documents and free-form notes.
2. Define separately typed base, identity/KYC, family, medical, finance, claim-sensitive, document-metadata and AI-finding contracts.
3. Implement collection-specific Rules and/or trusted projection endpoints only after the data owner approves the field/role matrix.
4. Add positive and negative Emulator tests before changing any role's runtime access.
5. Keep all proposed collections default-denied until those tests and a separate reviewed PR are complete.

No production or staging operation is authorized by this implementation.
