# InsurNex Account Creation and iNex Lead Routing — Verified Source Status

**Date:** 2026-11-01  
**Repositories:** `eslamshahin1087-lab/InsurNex` and `eslamshahin1087-lab/iNex-App`

## 1. InsurNex user account creation

The InsurNex frontend supports two separate account paths:

### Self-service organization owner
- `/register` is a public route.
- `RegisterPage` uses Firebase Authentication email/password registration.
- After registration, the user continues to `/setup`.
- `createOwnerWorkspace` creates an organization document, an active `users/{uid}` profile with role `owner`, and an organization membership document in one Firestore batch.

### Invited organization member
- An active Owner/Admin can create an organization invitation for an allowed role: Admin, Broker, Sales, Claims, Finance or Staff.
- The invitee must authenticate with the invited email and verify email ownership.
- Accepting an invitation atomically creates the user profile and organization member record and accepts the invitation.
- Current implementation does not support linking one Firebase account to multiple organizations.

These two paths create **InsurNex login accounts**. They are distinct from CRM Lead records.

## 2. iNex leads are CRM records, not user accounts

The InsurNex Lead model contains trusted source fields such as:
- `sourceSystem`
- `sourceExternalId`
- `sourceSchemaVersion`
- `consentToContact`
- `consentCapturedAt`
- `consentNoticeVersion`

Leads arriving from iNex are marked `sourceSystem=iNex-App` and displayed as iNex-originated in Leads and Lead Details. An inbound Lead is stored in the `leads` collection; it does not create a Firebase Authentication account for the person represented by that Lead.

## 3. iNex-App Worker source behavior

The current iNex-App `main` source contains:
- `workers/securepath-api/src/inex-lead-sync.js`
- `workers/securepath-api/src/index.js`
- `workers/securepath-api/test/inex-lead-sync.test.js`

The Worker handler:
1. Authenticates the iNex user by Firebase ID token.
2. Reads the source client profile server-side using the authenticated UID.
3. Skips the transfer unless `crmLeadSyncConsent === true` and consent timestamp/notice version are present.
4. Uses configured InsurNex receiver UID and organization ID.
5. Creates a Lead, activity, follow-up task and notification as create-only writes in the InsurNex project.
6. Sets the lead/task assignment and notification recipient to the configured receiver UID.
7. Uses the fixed four-collection allowlist: `leads`, `leadActivities`, `tasks`, `notifications`.

The Worker source tests and the iNex-App repository validation workflow passed on the observed `main` commit.

## 4. Receiving account and deployment are not live-verified here

The InsurNex integration specification requests `leads@insurnex.com` as the receiver. However, it explicitly says that the Firebase UID/email, active profile, organization, membership, role and Worker environment variables/secrets must be verified before activation.

The iNex-App GitHub Pages deployment workflow excludes the `workers` directory from the Pages artifact. The observed Actions run therefore proves the Pages deployment only; it is not evidence of a Cloudflare Worker deployment.

No Cloudflare live Worker metadata, deployment revision, receiver account, Worker variables or Worker secrets were read in this work. Therefore this document does not claim that the iNex-to-InsurNex integration is currently active in production.

## 5. Product distinction

- **InsurNex user:** Firebase Authentication identity + active user profile + organization membership + role.
- **iNex inbound lead:** CRM sales record assigned to an existing InsurNex receiver user.
- **Customer/prospect account:** no automatic InsurNex login is created merely because an iNex registration is transferred as a Lead.

Before enabling the integration in production, separately verify the receiver account/workspace and Cloudflare Worker deployment/configuration, then run a consented synthetic end-to-end test.
