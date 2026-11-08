# P1-E — Legacy Embedded Client-Document RBAC Parity

**Date:** 2026-11-08  
**Branch:** `fix/phase1-legacy-client-document-rbac-20261108`

## Finding

The legacy document compatibility UI included the `claims` role in its client-document reader allowlist. That reader then fetched `clients/{clientId}` and filtered its embedded `documents[]` array to claim-category items.

This contradicted the authoritative Firestore Rules: the legacy `clients/{clientId}` record is mixed-sensitivity and only active Owner/Admin/Broker tenant members can read it. Claims users therefore could not actually reach the embedded reference reader, even for a claim-category file. The Edge Function policy also had a Claims exception for the embedded legacy path that was unreachable under the caller-token Firestore Rules check.

## Change

- Introduce a small UI policy helper whose role set is exactly Owner/Admin/Broker.
- Return an empty legacy embedded-document list for Claims before attempting to read the parent client record.
- Apply the same Owner/Admin/Broker-only rule to the Edge Function's legacy embedded-document compatibility action.
- Keep the existing canonical `documents` collection's claim-related access path unchanged; Claims can still read claim-category metadata through its separately authorized document relationship.
- Extend the gateway policy test to reject Claims, Sales and Finance for embedded legacy client documents while preserving Claims' normal claim-document policy.
- Add a CI test that checks the UI helper, gateway policy and Firestore client read rule remain aligned.

## Security boundary

This change does not broaden any role or change Firestore Rules. It prevents the UI/gateway compatibility layer from advertising a legacy embedded-document capability that the underlying Firestore Rules intentionally deny. Existing normal claim-document metadata access is retained.

## Validation

CI must run:
- `npm run test:storage-gateway`
- `npm run build`
- `npm run test:rules` on `demo-insurnex`
- Secrets Scan

No customer records, Storage objects, deployed functions, secrets, project configuration, billing or production resources are accessed or changed. No migration is included.
