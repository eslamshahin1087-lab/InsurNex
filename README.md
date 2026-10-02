# InsurNex

**Professional Insurance Broker Management & CRM Platform**

InsurNex is a production-oriented insurance broker operations platform for individual brokers, brokerage companies, and company employees. It combines CRM, policy operations, claims, renewals, quoting, documents, tasks, support, analytics, subscriptions, and platform administration.

## Applications

### InsurNex User App

Entry point: `InsurNex-User.html`

Designed for day-to-day broker operations:

- Authentication and profile
- Personal Workspace
- Organization Workspace
- Workspace switching
- Customers / Customer 360
- Leads and pipeline
- Opportunities
- Quotations
- Renewals
- Claims
- Payments
- Documents
- Tasks
- Calendar/Appointments
- Notifications
- Messages and Support
- Analytics
- Account management

### InsurNex Admin

Entry point: `InsurNex-admin.html`

A separate administrative application with its own authorization boundary:

- Platform dashboard
- Users
- Organizations
- Brokers and profiles
- Clients
- Leads
- Policies
- Quotes
- Renewals
- Claims
- Support tickets
- Knowledge Base
- Announcements
- Subscriptions
- Invoices
- Audit Logs
- System Settings

Admin access is based on a Firebase Authentication custom claim named `platformRole` with either `superAdmin` or `platformAdmin`.

## Architecture

The existing lightweight PWA approach is intentionally preserved. The business model is rebuilt around InsurNex and the previous monolithic pages are split into reusable layers.

```
InsurNex/
├── InsurNex-User.html
├── InsurNex-admin.html
├── user.html
├── admin.html
├── index.html
├── js/
│   ├── config.js
│   ├── core.js
│   ├── user.js
│   └── admin-app.js
├── css/
│   └── app.css
├── assets/
│   ├── logo.svg
│   └── icon.svg
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── firebase.json
├── manifest.json
├── sw.js
├── scripts/
│   ├── smoke-test.cjs
│   └── set-admin-claims.cjs
├── docs/
│   ├── ARCHITECTURE.md
│   └── MIGRATION.md
└── .github/workflows/ci.yml
```

## Technology Stack

- HTML5
- CSS
- Vanilla JavaScript
- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- Firebase Hosting
- Progressive Web App
- GitHub Actions

## Authentication

InsurNex uses Firebase Authentication with:

- Registration
- Login
- Logout
- Password reset
- Local session persistence
- Email verification request
- Profile storage in Firestore

Supported account types:

- Individual Broker
- Brokerage Company
- Company Employee

## Workspace Architecture

Every operational record is explicitly scoped.

### Personal Workspace

```
workspaceType: "personal"
ownerId: <auth uid>
organizationId: null
```

### Organization Workspace

```
workspaceType: "organization"
organizationId: <organization id>
ownerId: <record creator uid>
```

Organization membership is stored in `organizationMembers` using:

```
<organizationId>_<userId>
```

This model enables organization isolation and workspace switching without mixing personal and company records.

## Roles

The platform role vocabulary is:

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

Role enforcement is applied at:

1. User interface visibility.
2. Navigation.
3. Service behavior.
4. Firestore Security Rules.
5. Admin custom claims.

## Firebase Services

### Authentication

Firebase Authentication provides identity and session management.

### Firestore

Firestore is the main application database. Core collections include:

`users`, `organizations`, `organizationMembers`, `brokerProfiles`, `clients`, `leads`, `policies`, `policyDocuments`, `quotes`, `quoteRequests`, `insurers`, `insuranceProducts`, `renewals`, `claims`, `payments`, `tasks`, `appointments`, `activities`, `notes`, `messages`, `notifications`, `conversations`, `subscriptions`, `invoices`, `reports`, `analytics`, `auditLogs`, `supportTickets`, `knowledgeBase`, `settings`.

### Storage

Documents are stored under workspace-scoped paths:

```
documents/<userId>/<file>
documents/<organizationId>/<file>
```

The Storage rules prevent cross-workspace access and limit normal uploads to 10 MB.

### Notifications

Notifications are stored in `notifications` and are recipient-scoped. Push delivery can be added later through Firebase Cloud Messaging without changing the authorization model.

## CRM

### Clients

Supports individual and corporate client records.

### Leads

Pipeline stages:

```
New
Contacted
Qualified
Proposal
Negotiation
Won
Lost
```

## Policies

A policy can include:

- Policy number
- Client
- Insurer
- Product
- Start date
- Expiry date
- Premium
- Commission
- Status
- Related documents

## Renewals

Renewal workflows support the required checkpoints:

```
90 Days
60 Days
45 Days
30 Days
15 Days
7 Days
1 Day
```

The operational model can connect renewal records to tasks and notifications.

## Claims

Claim status vocabulary:

```
New
Submitted
Under Review
Additional Documents
Approved
Rejected
Paid
Closed
```

## Quotes

Quotes track:

- Client
- Insurer
- Product
- Premium
- Validity
- Status
- Follow-up actions

## Tasks & Calendar

Tasks and appointments cover follow-ups, meetings, renewals, and operational actions.

## Support Center

Support tickets use:

```
Open
In Progress
Waiting for User
Resolved
Closed
```

## Knowledge Base

The Admin application manages articles and guides through the `knowledgeBase` collection.

## Analytics

The current User App calculates bounded operational metrics including:

- Lead conversion
- Policy count
- Premium
- Commission
- Renewal count
- Claim count
- Open claim amount

The data model leaves room for broader sales, client, renewal, and claims analytics.

## Security

The UI is not the security boundary.

Firestore rules enforce:

- Authenticated access
- Personal ownership
- Organization membership
- Organization role permissions
- Platform admin custom claims
- Recipient-scoped notifications
- Audit creation
- Deny-by-default fallback

Storage rules enforce the same workspace isolation model.

## Audit Logs

Sensitive operations are recorded in `auditLogs` with:

- Actor ID
- Actor email
- Organization ID when applicable
- Action
- Target type
- Target ID
- Timestamp
- Optional metadata

## Localization

Arabic is the default language:

- RTL
- Arabic UI strings

English is supported:

- LTR
- English UI strings

Strings are centralized in the shared application core.

## Performance

The application is designed for a free-tier Firebase deployment where practical:

- Bounded Firestore queries
- Workspace filters
- Limited listener scope
- No unbounded collection loads in the User App
- Lazy document upload operations
- Minimal compound indexes
- PWA caching for the application shell

## Environment Variables

`.env.example` documents deployment-time variables.

Do not commit:

- Service account JSON files
- `.env`
- Production secrets

The browser Firebase configuration is intentionally public client configuration. Authorization must always be enforced by Firebase Security Rules and Auth claims.

## Local Development

Serve the repository with any static HTTP server.

Example:

```bash
git clone https://github.com/eslamshahin1087-lab/InsurNex.git
cd InsurNex
npx serve .
```

Then open:

- `http://localhost:3000/`
- `http://localhost:3000/InsurNex-User.html`
- `http://localhost:3000/InsurNex-admin.html`
- `http://localhost:3000/user.html` (compatibility)
- `http://localhost:3000/admin.html` (compatibility)

Use a real hosted Firebase project for Authentication/Firestore/Storage integration.

## Firebase Setup

1. Create or select a Firebase project.
2. Enable Email/Password authentication.
3. Enable Firestore.
4. Enable Storage.
5. Configure the project values in `js/config.js` or generate that file during deployment.
6. Deploy rules and indexes.
7. Configure Firebase Hosting if the hosted PWA surface is required.

Deploy rules with:

```bash
firebase deploy --only firestore:rules,storage
```

Deploy Hosting with:

```bash
firebase deploy --only hosting
```

## Platform Admin Setup

Never set platform roles from the browser.

Use the server-side utility:

```bash
export FIREBASE_SERVICE_ACCOUNT_JSON='{"project_id":"..."}'
node scripts/set-admin-claims.cjs --uid <firebase-auth-uid> --role platformAdmin
```

The custom claim is then refreshed by the Auth session.

## Testing

Repository smoke test:

```bash
node scripts/smoke-test.cjs
```

The smoke test verifies:

- required files exist
- expected application entry points exist
- no forbidden legacy files remain
- no forbidden legacy references remain
- manifest identity is InsurNex
- Firebase configuration includes Firestore, Storage, and Hosting

GitHub Actions runs the smoke test and JavaScript syntax checks on push and pull request.

## Deployment

Recommended production order:

1. Configure Firebase.
2. Deploy Firestore rules.
3. Deploy Storage rules.
4. Verify the first platform admin claim.
5. Deploy Hosting.
6. Open `user.html` and complete a real registration.
7. Create a personal or organization workspace.
8. Create test CRM records.
9. Upload a document.
10. Verify that a second organization cannot read the first organization's data.
11. Test Admin authorization.
12. Review audit logs.

## Security Model

The security model follows least privilege. Organization A must not read or modify Organization B records, even if a user manipulates UI state or directly calls Firestore from the browser.

## Documentation

- `docs/ARCHITECTURE.md` — runtime and data architecture.
- `docs/MIGRATION.md` — what was retained, rebuilt, and removed.

## Repository Identity

The repository is intended to be entirely InsurNex-facing at runtime and in its documentation, configuration, tests, routes, assets, and deployment metadata.


## Broker CRM domains

The production User App now includes Customers, Customer 360, Leads, Opportunities, Quotations, Policies, Renewals, Claims, Tasks, Calendar, Payments, Commissions, Insurers, Insurance Products, Documents, Communications, Notifications, Reports, Analytics, Teams and Subscriptions.

## Safe legacy migration

Use `scripts/migrate-legacy-data.cjs` through `npm run migrate-data` from a trusted environment to copy compatible legacy records without deleting source data.


## Insurance Intelligence & workflow layer

The User App keeps the existing InsurNex visual system and wires its primary actions into the insurance lifecycle described in the product specification:

- Customer 360 and Insurance Portfolio Assessment
- Lead Needs Analysis and conversion to Opportunity
- Opportunity to Quotation to Policy
- Policy renewal, follow-up and payment recording
- Claims follow-up and Claim Assistant
- Document extraction/analysis requests
- Insurer/Product comparison
- Commission calculation and broker expenses
- AI action/audit records without pretending that an unavailable AI/OCR backend has run

AI/OCR workflows use explicit statuses such as `backend_required` until a secure backend service is connected. The application does not fabricate extracted document or medical results.

## Firebase collection blueprint

`firestore.collections.json` is the canonical repository blueprint for the collections used by InsurNex. It includes CRM, insurance operations, document intelligence, medical analysis, AI action logs, finance, communications, and platform administration collections.

The repository also includes matching Firestore rules for the workspace-scoped intelligence and finance collections. Firestore collections are created naturally when the first real document is written; the bootstrap utility remains create-only for approved reference/configuration data and never writes placeholder documents.

Run the read-only audit with the existing bootstrap utility:

```bash
node scripts/firestore-bootstrap.cjs
```

Operational data must continue to be created through the application workflows. Never seed placeholder business records into production.
