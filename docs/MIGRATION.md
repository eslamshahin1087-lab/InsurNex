# InsurNex Migration

## Source architecture reviewed
The supplied legacy User App used a 390px mobile application shell, safe-area handling and bottom navigation. fileciteturn334file1L135-L145 fileciteturn334file1L218-L289
The supplied legacy Admin App used a navy/gold SaaS-style design system with a fixed sidebar, topbar, cards, tables, badges and responsive controls. fileciteturn334file0L20-L38 fileciteturn334file0L95-L128
These reusable presentation patterns were retained while the old insurer/ecosystem business logic was removed from production.

## Architecture kept
- Static/PWA deployment model
- Firebase Authentication
- Firestore
- Firebase Storage
- Firebase Hosting configuration
- Shared responsive CSS
- Arabic RTL / English LTR direction
- Mobile-first navigation principles
- Existing Firebase project configuration

## Architecture modified
- Canonical User App: InsurNex-User.html
- Canonical Admin App: InsurNex-admin.html
- Compatibility redirects: user.html and admin.html
- Shared runtime: js/core.js
- User CRM runtime: js/user.js
- Admin runtime: js/admin-app.js
- Workspace-scoped Firestore queries and Rules
- PWA cache and CI checks

## Legacy features removed from runtime
- Insurer/ecosystem-specific navigation and journeys
- Loyalty/points workflows
- Corporate HR workflows
- Health/drive assessment workflows
- Promotional content workflows
- Legacy monolithic production entry points

## InsurNex features added
- Customer 360
- Leads and sales pipeline
- Opportunities
- Quotations
- Policies
- Renewal automation
- Claims
- Tasks and calendar
- Payments
- Commissions
- Insurer directory
- Insurance products
- Communications
- Documents
- Notifications
- Reports and analytics
- Teams
- Subscriptions and configurable plans
- Support and Knowledge Base
- Announcements
- Audit logs
- Global search
- Renewal-risk and cross-sell suggestions

## Firebase changes
Added workspace-aware Rules for customers, opportunities, quotations, calendarEvents, communications, commissions, teams and plans.
Insurers and insurance products are readable by authenticated users; writes remain platform-admin controlled.
Notifications are recipient-scoped. Client-side creation is limited to notifications addressed to the authenticated user.

## Data migration
scripts/migrate-legacy-data.cjs provides a non-destructive mapping layer:

clients -> customers
quotes -> quotations
appointments -> calendarEvents
messages -> communications
products -> insuranceProducts

Source collections are never deleted or modified.

## Admin changes
The Admin application is a separate platform boundary using Firebase Auth custom claim platformRole = superAdmin or platformAdmin.
Admin modules cover organizations, users, brokers, teams, insurers, products, plans, subscriptions, policies, renewals, claims, commissions, support, Knowledge Base, announcements, analytics, audit logs and settings.

## Verification
The latest GitHub Actions run completed successfully after repository smoke tests, JavaScript syntax checks and Firebase rule validation.