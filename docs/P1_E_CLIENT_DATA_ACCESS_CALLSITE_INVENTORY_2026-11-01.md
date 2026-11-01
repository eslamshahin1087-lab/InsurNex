# P1-E — Client Data-Access Call-Site Inventory and Separation Guard

**Date:** 2026-11-01  
**Branch:** `feat/p1e-client-data-access-callsite-inventory-20261101`  
**Base:** `main` at `381bcc409ef2663ac77b0a1782078060b9568707` after PR #100  
**Status:** static source-inventory enhancement and default-deny regression guard; no Firestore Rules change, no collection rollout and no migration.

## 1. Current runtime boundary

PR #96 merged the first compatibility adapter:
- The Clients index uses `listClientSummaries(profile)` and an allowlisted `ClientBaseSummary`.
- Client Details/360 uses `getLegacyClientWorkspace(profile, id)` for backwards compatibility.
- The legacy `clients/{clientId}` Firestore read remains restricted to active Owner/Admin/Broker members of the same organization.
- Sales, Claims, Finance and Staff remain denied from the legacy mixed-sensitivity client record.

**Important limitation:** the base summary is projected after an authorized legacy document has been returned. The legacy Client 360 adapter deliberately preserves the full record for the currently authorized roles. Neither adapter creates field-level security. Do not describe this as physical data separation.

## 2. Static call-site inventory enhancement

The existing static audit already scans `src`, `functions/src` and `supabase/functions` without cloud access. This PR extends its report for each relevant file with:
- Firestore read-operation identifiers (`getDoc`, `getDocs`, `onSnapshot`).
- Firestore write-operation identifiers (`addDoc`, `setDoc`, `updateDoc`, `deleteDoc`, `runTransaction`, `writeBatch`).
- A file-level candidate classification: read, write, mixed read/write, collection reference with no operation signal, or no direct client collection reference detected.
- Line-number signals for direct `clients` / `documents` references, Firestore operation identifiers and sensitive field identifiers.
- Aggregate candidate counts.

The report emits no source snippets, client names, field values, document URLs, tokens or environment values. Existing path/sensitive-field findings remain available.

**Interpretation constraint:** read/write classification is a same-file heuristic, not AST, call-graph or data-flow proof. A Firestore operation in a file may address another collection. Multi-line or aliased references may be missed. The results are a review queue, not a claim that every call site has been proven.

Run with `npm run audit:client-data-access`. Regression coverage remains in `npm run test:client-data-access-audit`.

## 3. Default-deny separation boundary

The following proposed collections remain without explicit Firestore match rules:
- `clientSensitiveProfiles`
- `clientMedicalProfiles`
- `claimSensitiveDetails`
- `aiFindings`
- `auditLogs`

Firestore's no-match behavior therefore continues to deny client access to these collections. The existing Emulator suite attempts access across Owner, Admin, Broker, Sales, Claims, Finance, Staff and a foreign-organization owner; those denials remain in CI.

A new static guard also fails if an explicit Firestore match block is added for any proposed collection before its dedicated reviewed Rules PR. It separately checks that the legacy `clients` rule still allows reads only to Owner/Admin/Broker and that the current adapter does not start reading the proposed collections.

The existing `documents` collection is not in this default-deny list; it has its own existing metadata and role contract. The separation planner continues to require manual relationship/storage review before moving document references.

## 4. Separation-planning contract

The existing read-only inventory, proposal planner and reviewer remain the source for field-path classification. Current candidate destinations include:
- Base contact -> `clients` (base-summary candidate only).
- Identity, family, financial, risk-profile, contact-address and corporate profile -> `clientSensitiveProfiles` (proposal only).
- Health/medical -> `clientMedicalProfiles` (proposal only).
- Derived risk assessment and AI analysis -> `aiFindings` (proposal only).
- Document references -> existing `documents` metadata, after manual relationship and private-storage reconciliation.
- Free-form notes receive `manual_classification_required`; the planner currently labels `clientSensitiveProfiles` as a candidate destination, but that is not approval to move the field. Unknown fields remain unclassified with no destination.

This is not an approved role matrix. Proposed read/write roles, purpose, retention, export/delete handling, data-owner approval and legal basis remain unresolved. `claimSensitiveDetails` and `auditLogs` also remain default-denied and are not enabled by this work.

The planner retains `writesPlanned: false`, `humanApprovalRequired: true`, `noMigrationExecuted: true`, and `safeToMigrate: false`.

## 5. Acceptance evidence added

CI now runs `npm run test:client-sensitive-default-deny`, which verifies:
- no explicit Firestore Rules match has been introduced for the five proposed collections;
- the Emulator test still enumerates all five proposed collections and all organization roles;
- the legacy Client 360 read rule remains Owner/Admin/Broker only;
- the compatibility adapter continues to use the base projection for Clients list and the guarded legacy workspace for Client 360;
- the adapter has not begun reading any proposed sensitive collection;
- the source documentation continues to disclose the field-level security limitation and absence of migration.

The existing Emulator suite remains the behavioral test. The new static guard is an additional tripwire, not a replacement for Emulator authorization tests.

## 6. Remaining P1-E work

1. Review the generated file/line signal report manually and classify each real production read/write call site; close false positives and search misses.
2. Approve a field-by-field data-owner classification, purpose and retention schedule.
3. Decide exact collection documents, schema versions, tenant keys, immutable client relationship keys, read/write roles and trusted writer endpoints.
4. Add collection-specific Firestore Rules and positive/negative Emulator cases in a separate reviewed PR before exposing any proposed collection.
5. Add read-only adapters for each approved projection; keep legacy writes and Client 360 compatibility until all callers are migrated and regression-tested.
6. Only then prepare a separately approved, dry-run-first migration plan. No customer record may be changed by this branch.

## 7. Safety

No Firestore Rules, indexes, customer records, Storage objects, secrets, billing, production routes or deployed services are modified. No cloud inventory or migration command is run by this source-only change.
