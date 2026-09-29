# InsurNex Architecture

## Product

InsurNex is a Professional Insurance Broker Management & CRM Platform for individual brokers and brokerage companies.

## Runtime architecture

- User App: `user.html` + `js/user.js`
- Admin App: `admin.html` + `js/admin.js`
- Shared frontend: `js/core.js`, `css/app.css`
- Firebase: Authentication, Firestore, Storage
- PWA: `manifest.json` + `sw.js`
- Hosting: Firebase Hosting configuration in `firebase.json`

The repository stays framework-light because the existing foundation was a static PWA. The business model and data layer are rebuilt around InsurNex while keeping the reusable browser/PWA approach.

## Workspace model

A user can operate a personal workspace or an organization workspace.

Personal records carry:
- `workspaceType = "personal"`
- `ownerId = auth.uid`
- `organizationId = null`

Organization records carry:
- `workspaceType = "organization"`
- `organizationId`
- `ownerId` for the record creator

Membership is stored in `organizationMembers` using the deterministic document ID `{organizationId}_{userId}`.

## Roles

The supported role vocabulary is:

- superAdmin
- platformAdmin
- organizationOwner
- organizationAdmin
- broker
- salesAgent
- customerService
- operations
- claimsOfficer
- finance
- manager
- viewer

Platform roles are enforced with Firebase Auth custom claims. Organization roles are enforced through membership documents and Firestore rules.

## Core domains

- Authentication and profiles
- Organizations and membership
- CRM: clients and leads
- Policies
- Quotes and quote requests
- Renewals
- Claims
- Payments
- Documents
- Tasks and appointments
- Notifications
- Messages and conversations
- Support tickets
- Knowledge base
- Analytics and reports
- Subscriptions and invoices
- Audit logs
- Settings
- Insurers and insurance products

## Firestore collections

The production schema is organized around:

`users`, `organizations`, `organizationMembers`, `brokerProfiles`, `clients`, `leads`, `policies`, `quotes`, `quoteRequests`, `insurers`, `insuranceProducts`, `renewals`, `claims`, `payments`, `tasks`, `appointments`, `activities`, `notes`, `documents`, `messages`, `notifications`, `conversations`, `subscriptions`, `invoices`, `reports`, `analytics`, `auditLogs`, `supportTickets`, `knowledgeBase`, `announcements`, `settings`.

## Security

The UI is not treated as a security boundary. Firestore rules enforce:

1. Authentication.
2. Personal ownership.
3. Organization membership.
4. Role-based writes.
5. Platform administration through custom claims.
6. Append-only audit creation for authenticated actors.
7. Recipient-scoped notifications.
8. Deny-by-default fallback rules.

Storage rules mirror the workspace isolation model and restrict ordinary uploads to 10 MB.

## Performance

The browser uses bounded queries and workspace filters. The core query helper limits normal collection reads to 50 records per call. Indexes are added only where the application performs compound queries.

## Localization

The shared core exposes Arabic RTL and English LTR strings through one localization object. UI copy is centralized instead of being duplicated across business components.

## Admin

Admin is a separate route/application surface. It does not rely on hiding User App UI. Access is rejected unless Firebase Auth exposes a valid `platformRole` custom claim.

## Extension path

Future modules can be added by:
1. Defining the Firestore contract.
2. Adding role-aware rules.
3. Registering a domain definition.
4. Adding the User/Admin workflow.
5. Adding indexes only when a query requires them.
6. Adding tests and audit events.
