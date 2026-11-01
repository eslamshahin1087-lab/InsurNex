# iNex-App → InsurNex Lead Integration v1

**Implementation branch:** `feat/inex-lead-lifecycle-integration-20261101`  
**Source application:** `eslamshahin1087-lab/iNex-App`  
**Destination application:** `eslamshahin1087-lab/InsurNex`  
**Destination Firebase project:** `insurnex-8a9df`  
**Status:** Code changes are proposed in coordinated pull requests. No Worker deployment, secret change, or production data write is included.

## 1. Existing source-app flow retained

The iNex app already uses a Cloudflare Worker as its trusted backend. After a client session is established, the app calls:

- Legacy-compatible route: `POST /v1/client/registration-lead`
- New descriptive alias: `POST /v1/inex/registration-lead`

Both routes use the same handler. The browser sends the user's Firebase ID token in the Authorization header. The Worker validates that token against the iNex Firebase project (`path-1a672`), then reads the client's profile from the source Firestore using its server-side credential. Contact details are never accepted from the browser request body.

The integration does not use Firebase Cloud Functions and does not require Firebase Blaze. The Worker continues to use the existing URL configured in `js/securepath-backend.js`; this change does not create a second backend endpoint.

## 2. Consent gate and field minimization

A record is eligible only when all of these fields exist in the source profile:

- `crmLeadSyncConsent === true`
- `crmLeadSyncConsentAt` — captured timestamp
- `crmLeadSyncConsentNoticeVersion` — version of the notice/terms presented

Profiles with no affirmative consent or incomplete consent evidence are skipped. Consent is not inferred from account age, login, a blank field, or the fact that a profile exists.

The integration transfers only:
- Full name
- Email address
- Phone number
- Client type (individual/corporate)
- Business name, for corporate clients
- Consent timestamp and notice version
- Source UID as a stable, internal idempotency reference

It does not transfer passwords, ID tokens, national IDs, date of birth, gender, occupation, medical details, insurance history, policy lists, or uploaded files. Client matching/merging is not performed by this integration; brokers can review and link a lead manually.

## 3. Destination records

The Worker writes to the InsurNex Firebase project `insurnex-8a9df`. A successful first-time registration creates four documents in one atomic Firestore REST commit:

| Collection | Record | Purpose |
|---|---|---|
| `leads` | `sp_<stable-hash>` | Pipeline entry with `sourceSystem: iNex-App` and consent provenance |
| `leadActivities` | `<lead-id>_created` | Immutable creation activity |
| `tasks` | `<lead-id>_followup` | Open high-priority contact task assigned to the receiving user |
| `notifications` | `<lead-id>_assigned` | In-app notification for the receiving user, linked to the lead and task |

The task is created with `relatedType: lead`, `relatedId: <lead-id>`, and the Cairo-local current date as its initial due date. The lead, task and notification are tenant-scoped to the configured InsurNex organization. The notification is addressed to the configured receiving UID and uses the existing `lead_created` notification type.

The InsurNex Lead Details view labels these records as received from iNex. Existing lead source values and existing records are not rewritten.

## 4. Idempotency and migration from the prior integration

The existing lead ID derivation is preserved:

`sp_ + stableActionId(sourceUid, 'insurnex-registration-lead', 'v1')`

This keeps the previously synced leads deduplicated. The activity ID remains `<lead-id>_created`; new task and notification IDs are deterministic, too.

If a lead/activity already exists from the prior version, the Worker attempts to create only the missing task and notification. It does not overwrite the original lead or activity, does not delete records, and does not globally search by email/phone. If those follow-up records already exist, the retry returns an idempotent result.

## 5. Worker write boundary

The destination service account must be dedicated to this integration. Keep its IAM permissions limited to Firestore entity creation and only the metadata permissions required by the Firestore REST API. It must not have entity get/list/update/delete permissions.

Because Firestore REST calls made with a service-account OAuth token use IAM rather than end-user Firestore Rules, the Worker also enforces an explicit source-code allowlist:
- Destination project must equal `insurnex-8a9df`.
- Collection must be one of `leads`, `leadActivities`, `tasks`, or `notifications`.
- Each write must use `currentDocument.exists === false`.
- Update masks, delete operations, transforms, other projects, and other collections are rejected before the API call.

This allowlist is defense-in-depth and must remain aligned with the service-account IAM role.

## 6. Receiving account configuration — pending live verification

The requested receiver values from the product specification are:

- UID: `fDGjCCaVCGXbPoH18sMI7DRbpQI2`
- Email: `leads@insurnex.com`

They must be verified in the target Firebase project before configuring production:
1. Confirm the UID resolves to the expected email.
2. Confirm the user's profile exists and is active.
3. Confirm the configured organization exists and the user has an active membership in it.
4. Confirm the user role is suitable to receive/manage leads (`owner`, `admin`, `broker`, or `sales`).
5. Confirm the exact organization document ID (currently expected to match the `org_...` form used by the Worker).
6. Confirm the dedicated Service Account can create only the four approved collections in the target project.

Configure these in Cloudflare Worker settings, not in Git:
- `INSURNEX_RECEIVER_UID`
- `INSURNEX_ORGANIZATION_ID`
- `INSURNEX_RECEIVER_NAME` (optional)
- `INSURNEX_SERVICE_ACCOUNT_JSON` as a Worker Secret

The receiving values are documented as requested configuration, not as proof that the live account or Worker environment currently contains them. No live secrets or Cloudflare variables were read or changed in this development pass.

## 7. Validation before activation

- Run `npm run check --prefix workers/securepath-api`.
- Run `npm test --prefix workers/securepath-api`.
- Run the iNex repository validation workflow.
- Run the InsurNex CI and Firestore Emulator rules tests.
- In an approved staging environment, use a synthetic iNex account with recorded consent and a verified receiving workspace.
- Verify first delivery creates exactly one lead, activity, task and notification.
- Verify repeated login/session resume creates no duplicates.
- Verify missing consent and incomplete consent evidence do not transfer data.
- Verify all writes remain in the receiving organization.
- Verify service-account IAM cannot read, list, update, or delete destination records.

No deployment or production test is part of this PR. After review and explicit approval, deploy the existing Worker once, configure the verified receiver variables/secrets, and test with a consented synthetic account before enabling general traffic.
