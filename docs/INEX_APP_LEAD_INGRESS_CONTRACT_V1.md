# iNex-App → InsurNex Lead Ingress Contract v1

**Status:** Proposed contract. Not active and not evidence of a live endpoint.
**Target receiver requested by product owner:** UID `fDGjCCaVCGXbPoH18sMI7DRbpQI2`, email `leads@insurnex.com`. A trusted Firebase project check must verify that these values resolve to an active user profile with an active organization before activation.

## 1. Transport boundary
- iNex-App must call a trusted server-side endpoint over HTTPS.
- Do not write directly to Firestore using a human receiver's Firebase credentials.
- Do not embed service-account JSON, Admin SDK credentials, integration secrets, or a reusable bearer secret in the browser/mobile bundle.
- The existing Firebase HTTPS Function source is legacy/build-only under the Spark constraint. It is not an approved runtime endpoint.
- Select an external endpoint only after its free-tier plan, privacy, region, quotas, source provenance, and deployment access are validated.

## 2. Request schema
```json
{
  "schemaVersion": 1,
  "source": "iNex-App",
  "sourceLeadId": "required stable iNex record ID",
  "receiverUid": "fDGjCCaVCGXbPoH18sMI7DRbpQI2",
  "createdAt": "2026-11-01T12:00:00.000Z",
  "lead": {
    "fullName": "Required, max 160 characters",
    "email": "Optional valid email, max 254 characters",
    "phone": "Required normalized phone, max 40 characters",
    "clientType": "individual or corporate",
    "businessName": "Optional, max 180 characters",
    "insuranceInterest": "Optional, max 120 characters",
    "message": "Optional, max 2000 characters",
    "consentToContact": true
  }
}
```

Unknown fields must be rejected. Payload size maximum: 16 KiB. Do not accept attachments or document bytes in this ingress request.

## 3. Authentication and anti-replay
Preferred: HMAC-SHA256 signature with a key held only by the trusted iNex server and trusted ingress runtime. Sign the exact raw request body and a timestamp; require a narrow clock skew (5 minutes), constant-time signature comparison, key ID for rotation, and reject replayed nonce/signature records. Rate limit per integration identity and IP. Keep only a hash of the idempotency key in audit data.

If the current iNex architecture cannot keep signing credentials server-side, do not deploy a shared secret into the app binary. Use a different authenticated server-to-server design.

## 4. Receiver verification
Resolve the receiver UID from server-side configuration, not from an untrusted client field. Load `users/{receiverUid}` and its `organizations/{organizationId}` record. Require active user status, matching organization, active membership, and an approved role that can own inbound leads. Return a generic unavailable response if receiver setup is incomplete; do not fall back to a different account or tenant.

## 5. Idempotency and record writes
Idempotency key: `iNex-App:{receiverUid}:{sourceLeadId}`.

Within one transaction:
1. Check an ingress receipt keyed by a one-way hash of the idempotency key.
2. If already processed, return the existing lead ID without creating any additional records.
3. Create the lead with `sourceSystem=iNex-App`, `sourceExternalId`, `organizationId`, `createdBy=receiverUid`, `assignedTo=receiverUid`, stage `new`, and consent metadata.
4. Create a lead activity event with sanitized source details.
5. Create a follow-up task with a configurable due date.
6. Create an in-app notification for the receiving workspace.
7. Create an ingress receipt linking the hashed key to the lead ID and write status.
All writes are tenant scoped and must use a deterministic key. No cross-tenant email/phone search is permitted.

Client matching is a separate operation restricted to the verified organization. Normalize email and phone; handle ambiguous matches by leaving the Lead unlinked for broker review. Do not automatically merge or overwrite client profiles.

## 6. Lead document fields
```ts
type INexLeadV1 = {
  schemaVersion: 1;
  sourceSystem: "iNex-App";
  sourceExternalId: string;
  organizationId: string;
  assignedTo: string;
  createdBy: string;
  name: string;
  phone: string;
  email: string;
  clientType: "individual" | "corporate";
  companyName?: string;
  insuranceInterest?: string;
  message?: string;
  consentToContact: true;
  consentCapturedAt: string;
  stage: "new";
  priority: "medium";
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
```

## 7. Responses
- `202`: accepted, return opaque `leadId` and `duplicate=false`.
- `200`: previously accepted, return the same `leadId` and `duplicate=true`.
- `400`: schema/payload invalid.
- `401`: signature invalid, expired, or replayed.
- `429`: rate limit exceeded.
- `503`: receiving profile/organization or upstream storage unavailable.
Do not return Firestore paths, stack traces, credentials, internal org details, or whether a particular personal email/phone exists.

## 8. Required tests before activation
- valid request accepted and creates one lead/task/activity/notification;
- retry creates no duplicates;
- altered body, invalid signature, expired timestamp and replay are rejected;
- unknown UID, inactive user, missing organization and disabled membership fail closed;
- invalid/oversized field values and unknown properties are rejected;
- cross-tenant duplicate candidates do not leak or link;
- all writes carry the receiver's verified organization ID;
- logs contain no raw phone, email, message, medical data, signatures or secret values;
- integration source cannot read or update existing InsurNex client/lead records.
