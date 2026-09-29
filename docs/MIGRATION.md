# InsurNex Migration

## Architecture Kept

- Static/PWA delivery model.
- Firebase client-side integration.
- Arabic/English UX direction.
- Mobile-first navigation philosophy.
- Reusable visual patterns such as cards, bottom navigation, dialogs and loading/empty/error states.
- Existing Firebase project connection was retained so existing backend data is not deleted automatically.

## Architecture Modified

- The previous monolithic HTML application was separated into User and Admin entry points.
- Shared Firebase/i18n/domain logic moved into `js/core.js`.
- Styling moved into `css/app.css`.
- Firebase Hosting and Storage configuration were added.
- Platform administration now uses custom claims instead of a UI-only gate.
- Workspace-aware query helpers were added for personal and organization records.

## Legacy Features Removed

The previous product-specific customer journey, loyalty points, health/drive behavior tracking, promotional landing flows, and corporate HR implementation were removed from the production User App because they do not belong to the InsurNex broker-operations domain.

The previous Cloudinary document path was replaced by Firebase Storage workspace paths.

The previous migration/admin scripts and test pages were replaced with InsurNex-specific utilities.

## InsurNex Features Added

- Individual Broker workspace.
- Brokerage Company workspace.
- Organization membership.
- RBAC vocabulary.
- Clients.
- Leads pipeline.
- Policies.
- Quotes.
- Renewals.
- Claims.
- Payments.
- Documents.
- Tasks.
- Calendar/Appointments.
- Notifications.
- Support tickets.
- Knowledge base.
- Analytics.
- Subscriptions.
- Invoices.
- Audit logs.
- Dedicated User App.
- Dedicated Admin App.
- Arabic RTL and English LTR.
- Default-deny Firestore rules.
- Workspace-isolated Storage rules.
- Production repository smoke test.

## Firebase Changes

- Authentication remains Firebase Authentication.
- Firestore remains the primary operational database.
- Firebase Storage is now the document store.
- Firebase Hosting configuration is present.
- Firestore rules were replaced with InsurNex workspace/RBAC rules.
- Storage rules were added.
- Required indexes were reduced to query patterns used by the rebuilt app.

## Database Changes

The core record contract is:

- Personal workspace: `ownerId = auth.uid`, `workspaceType = personal`.
- Organization workspace: `organizationId`, `workspaceType = organization`.
- Organization membership: deterministic member document IDs.
- Platform administration: Auth custom claim `platformRole`.

No automatic destructive migration is performed against the retained Firebase project.

## Admin Changes

Admin is now a separate application entry point with its own authentication gate, dashboard and management modules.

Admin-sensitive operations write an `auditLogs` record.

## Security Changes

- UI-only authorization is no longer relied upon.
- Organization A cannot query records owned by Organization B when rules are deployed.
- Personal workspace queries are owner-scoped.
- Admin access requires a platform claim.
- Notifications are recipient-scoped.
- Storage paths are workspace-scoped.
- Rules end with a deny-all fallback.

## Rollout Notes

Before production release:
1. Deploy Firestore and Storage rules.
2. Create one explicitly managed platform admin claim.
3. Verify Authentication providers.
4. Verify Storage billing/limits against expected file volume.
5. Run the repository smoke test.
6. Perform end-to-end checks for registration, workspace creation, CRUD, document upload, admin authorization and cross-organization isolation.
