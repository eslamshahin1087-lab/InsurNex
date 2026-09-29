# InsurNex Architecture

## Product

InsurNex is a Professional Insurance Broker Management & CRM Platform for individual brokers, brokerage companies, managers, sales agents and brokerage operations teams.

## Runtime architecture

- User App: `InsurNex-User.html` + `js/user.js`
- Admin App: `InsurNex-admin.html` + `js/admin-app.js`
- Shared frontend: `js/core.js` + `css/app.css`
- Firebase: Authentication, Firestore, Storage
- PWA: `manifest.json` + `sw.js`
- Hosting: Firebase Hosting configuration in `firebase.json`

The repository remains framework-light because the original foundation is a static PWA. Reusable mobile/navigation patterns were retained while the business model and workflows were rebuilt around insurance broker operations.

## Workspace model

Personal records carry:

- `workspaceType = personal`
- `ownerId = auth.uid`
- `organizationId = null`

Organization records carry:

- `workspaceType = organization`
- `organizationId`
- `ownerId` for the record creator

Membership is stored in `organizationMembers` using the deterministic document ID `{organizationId}_{userId}`.

## Roles

Platform roles:
- superAdmin
- platformAdmin

Organization roles:
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

Additional account types are represented in user profiles: individual_broker, brokerage_company, broker_employee, manager and customer.

UI role checks are implemented in `js/core.js`; Firestore/Storage rules remain the final security boundary.

## Core domains

- Authentication and onboarding
- CRM and Customer 360
- Leads and pipeline
- Opportunities
- Quotations
- Policies
- Renewals and renewal automation
- Claims
- Tasks and calendar events
- Payments
- Commissions
- Documents
- Insurers and insurance products
- Communications
- Notifications
- Reports and analytics
- Teams
- Subscriptions and plans
- Support and Knowledge Base
- Announcements
- Audit Logs
- Settings

## Firestore collections

Production broker collections include:

`users`, `organizations`, `organizationMembers`, `brokerProfiles`, `customers`, `leads`, `opportunities`, `quotations`, `policies`, `renewals`, `claims`, `payments`, `tasks`, `calendarEvents`, `documents`, `insurers`, `insuranceProducts`, `commissions`, `communications`, `notifications`, `activities`, `notes`, `messages`, `conversations`, `teams`, `subscriptions`, `invoices`, `reports`, `analytics`, `supportTickets`, `knowledgeBase`, `announcements`, `plans`, `auditLogs`, `settings`.

Compatibility collections such as `clients`, `quotes`, `appointments`, `products` and `messages` remain available where existing data may require migration.

## Security

Security rules enforce authentication, workspace ownership, organization membership, organization roles, platform custom claims, recipient-scoped notifications, audit creation and default deny.

Storage rules enforce user/organization workspace isolation and a 10 MB upload limit.

## Migration

`scripts/migrate-legacy-data.cjs` is a non-destructive migration bridge. It maps compatible legacy collections into broker-first collections without deleting source records.