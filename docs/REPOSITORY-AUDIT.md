# InsurNex Repository Audit

## Audit scope

The repository was reviewed at the root/configuration level, application pages, Firebase configuration, security rules, service worker, package metadata, documentation, tests, deployment files, and assets.

## KEEP

### Generic repository/configuration foundation
- \`.firebaserc\` — retained because it points to the existing Firebase project intentionally reused by the migration.
- \`.htmlhintrc\` — generic lint configuration.
- \`.nojekyll\` — compatible with static hosting.
- \`.gitignore\` — retained and hardened for environment/service-account files.
- Existing proprietary licensing approach — retained and rewritten for the new product identity.

### Technical approach
- Lightweight PWA/static delivery.
- Firebase client SDK approach.
- Mobile-first UI philosophy.
- Reusable card/dialog/navigation patterns.
- Existing bilingual direction.

## MODIFY

- \`index.html\` — new InsurNex entry/landing surface.
- \`manifest.json\` — new app identity and User App entry.
- \`sw.js\` — new InsurNex cache shell.
- \`firebase.json\` — Firestore, Storage and Hosting configuration.
- \`firestore.indexes.json\` — reduced to current query patterns.
- \`firestore.rules\` — complete RBAC/workspace rewrite.
- \`package.json\` — InsurNex scripts and server-side utility dependency.
- \`README.md\` — full product documentation rewrite.
- \`LICENSE\` — product identity rewrite.
- \`.gitignore\` — environment and credential hardening.

## REBUILD

### Applications
- User application shell.
- Admin application shell.
- User workflows.
- Admin workflows.

### Shared layer
- Firebase bootstrap.
- Authentication/session state.
- Localization.
- Workspace switching.
- Domain contracts.
- Firestore query scoping.
- Audit logging.
- Shared responsive UI system.

### Backend/security
- Firestore rules.
- Storage rules.
- Admin custom-claim utility.
- Repository smoke tests.
- CI workflow.

### Assets
- InsurNex SVG logo.
- InsurNex application icon.

### Documentation
- Architecture documentation.
- Migration documentation.
- Repository audit documentation.

## REMOVE

The migration removes repository material whose runtime or documentation purpose was tied to the previous product, including:

- The previous monolithic User App page.
- The previous monolithic Admin page.
- Product-specific migration/test scripts.
- Product-specific hardening notes and historical changelog.
- Product-specific loyalty, behavior tracking, corporate HR and assessment documentation.
- Legacy application icons and splash assets.

Removal was performed only after checking current imports, configuration references and the new application entry points.

## Dependency decisions

No framework replacement was introduced. The project remains a lightweight PWA because that architecture is technically suitable for the repository. Business logic and data access were rebuilt rather than preserving incompatible product behavior.

## Firebase preservation decision

The existing Firebase project is retained to avoid automatic destructive data loss. Existing legacy collections are not deleted by this repository migration. The new InsurNex application uses the new workspace-scoped schema and rules.

## Final state target

The repository should read as one coherent InsurNex system:

- User Application
- Admin Application
- Shared Client Services
- Authentication
- Firestore
- Storage
- Notifications
- RBAC
- Personal Workspace
- Organization Workspace
- CRM
- Insurance Operations
- Analytics
- Support
- Audit Logs
- Subscription architecture
