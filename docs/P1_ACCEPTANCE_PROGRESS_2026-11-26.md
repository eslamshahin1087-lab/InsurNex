# P1-D / P1-E Acceptance Progress

**Observed:** 2026-11-26  
**Candidate source:** `main` at `6e943f67928363fc131d78ca7fe0b7afba576eaa`  
**Scope:** local checks, synthetic local attempts, and the owner-designated Supabase test project `snzfillstmkoujobknzp` only. No production project or customer data was used.

## P1-D — Document gateway

### Verified

- The designated Supabase test project is `ACTIVE_HEALTHY` in `eu-west-1`.
- The test project's `document-storage` function was version 5 before this check. Comparing its retrieved source with `main` found three differences in `index.ts`: missing handling for an unconfigured Firebase project, missing role enforcement on pending operation-attachment cleanup, and a `ping` check that was not restricted to GET. The shared authorization helper and access-policy file matched.
- Deployed the current repository source to the test project as **version 6** only. The helper import was adjusted for the flat function upload layout. Retrieved source for all three files matched `main` after normalizing that deployment-only import path.
- The public liveness request returned HTTP 200 with `ok: true`.
- A deliberately invalid Supabase API key returned HTTP 401 `API_KEY_INVALID`.
- The configured public publishable key reached the handler's Firebase-auth boundary; a request without a Firebase token returned HTTP 401 `AUTH_REQUIRED`.
- Supabase Security, Performance, and Health Advisors returned no lints.
- No secret values were read, no Storage objects were read or changed, and no document metadata or customer records were written.

### Still required before P1-D can close

- Confirm that the test function's Firebase API key and `FIREBASE_PROJECT_ID` are bound to a dedicated Firebase test project. Secret values must remain undisclosed.
- Run authenticated synthetic upload, signed upload, metadata reconciliation, list, preview/download, delete, and operation-attachment lifecycle flows.
- Run negative tests for disabled/invalid Firebase users, inactive membership, wrong tenant/parent, forbidden role/category, forged IDs/paths, invalid MIME/size, and expired URLs. Verify object MIME/size, signed URL expiry, and refresh behavior.
- Record a successful authenticated end-to-end run and rollback/recovery steps.

The Supabase test project is updated and its unauthenticated boundary is verified. This does not establish authenticated document behavior, so P1-D remains open.

## P1-E — Client data access

### Verified

- The client summary and legacy Client 360 adapter tests pass for active Owner/Admin/Broker access, inactive/profile-less failure, cross-organization denial, and explicit sensitive-field exclusion from summaries.
- Static regression checks confirm the proposed `clientSensitiveProfiles`, `clientMedicalProfiles`, `claimSensitiveDetails`, `aiFindings`, and `auditLogs` collections remain default-denied.
- Trusted audit-foundation and role-capability resolver contract tests pass. Capabilities remain eligibility signals; they do not grant reads.
- A current source search found the legacy raw `listClients`, `getClient`, and `activateIssuedClientV978` exports still defined, without textual production call sites. The live legacy writer and Client 360 root read remain: client creation writes mixed-sensitivity fields; AI analysis writes to the legacy client record; profile edits update the legacy record; Client 360 reads it for Owner/Admin/Broker.
- Added a TypeScript symbol-level audit to resolve aliased imports and namespace calls. It scanned 242 source files and found no static imports or call sites for those three deprecated raw APIs; it inventoried 26 literal `clients` collection/document call sites. The audit also flags dynamic imports and states its runtime-analysis limits. Its regression test is now in CI.
- The source review identified client-related paths in Client 360, operations, policy, leads, quotes/RFQs, timelines, and documents. Their authorization behavior still needs the corresponding Emulator cases to run; no live Rules acceptance is claimed here.

### Still required before P1-E can close

- Firestore Emulator execution of the tenant, role, relationship, assignment, and default-deny matrix. The attempt was made against `demo-insurnex`; Firestore Emulator exited before tests started with a Java/Netty `Unable to establish loopback connection` failure. No emulator test result is claimed.
- Complete import/call-graph review of deprecated exports and indirect/wrapped paths; a text search is not proof that dynamic or aliased callers do not exist.
- Data-owner approval for purpose, legal basis, retention, export/deletion, and role/assignment rules. No sensitive reader or collection-specific Rules grant has been enabled.
- Any approved trusted grant/read path must enforce tenant, parent, assignment, and audit-before-read behavior and pass positive and negative Emulator cases before a sensitive projection is enabled.

## Local verification

Checks below were run with Node.js 22.23.4, matching the repository's Node 22 requirement:

- `npm run build` — passed.
- `npm run build --prefix functions` — passed.
- `npm run lint` — exit code 0; existing warnings remain.
- Passed: `test:storage-gateway`, `test:document-storage-runtime`, `test:client-sensitive-default-deny`, `test:client-sensitive-access-policy`, `test:client-data-access-projection` (6/6), `test:client-data-review`, `test:client-data-access-audit`, `test:client-audit-foundation`, `test:client-capability-resolver`, `test:inex-ingress-contract`, `test:inex-lead-integration`, `test:quote-workflow`, `test:task-workflow`, `test:analytics-snapshot`, `test:financial-metrics`, `test:documents-route`, `test:pwa`, `test:copilot-runtime-parity`, and `test:edge-runtime-snapshots`.
- `test:rules` was not run to completion: the Emulator failed during startup, before any rules assertion executed.

## Disposition

Do not close issue #126 or #111 and do not enable sensitive projections based on this progress report. The current evidence verifies code contracts, staging source parity, and unauthenticated gateway boundaries; it does not meet either issue's remaining authenticated runtime and owner-approval acceptance criteria.
