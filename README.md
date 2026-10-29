# InsurNex

Smarter Insurance Brokerage platform. Clean-rebuild foundation for React + TypeScript + Vite and Firebase project `insurnex-8a9df`.

## Local setup
1. Use Node.js 22.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and paste the Firebase Web App config values from Firebase Console.
4. Run `npm run dev`.

## Quality checks
- `npm run test:access` — admin/user access boundary smoke checks.
- `npm run test:plans` — subscription plan feature entitlement smoke checks.
- `npm run test:pwa` — PWA installability and privacy smoke checks.
- `npm run test:storage-gateway` — document-storage authorization policy regression tests.
- `npm run test:storage-inventory` — legacy storage inventory policy regression tests.
- `npm run test:legacy-client-backfill-plan` — deterministic read-only backfill planner tests.
- `npm run test:client-sensitive-inventory` — privacy-safe sensitive-field inventory tests.
- `npm run test:client-sensitive-separation-plan` — fail-closed field mapping proposal tests.
- `npm run lint`
- `npm run build`
- `npm run build --prefix functions`

## Access model
- [Admin and User Access Model](docs/ADMIN_ACCESS_MODEL.md)
- [Subscription Plan Feature Entitlements](docs/PLAN_FEATURE_ENTITLEMENTS.md)
- [InsurNex Development Roadmap](docs/INSURNEX_DEVELOPMENT_ROADMAP.md)
- [Client Sensitive-Field Inventory Runbook](docs/CLIENT_SENSITIVE_DATA_INVENTORY_RUNBOOK.md)
- [Client Sensitive-Data Separation Plan Runbook](docs/CLIENT_SENSITIVE_DATA_SEPARATION_PLAN_RUNBOOK.md)
- [Master Architecture](docs/MASTER_ARCHITECTURE.md)
- [Firestore Schema v2 Proposal](docs/FIRESTORE_SCHEMA_V2_PROPOSAL.md)
- [AI Module Contracts](docs/AI_MODULE_CONTRACTS.md)
- [Phase 3 Acceptance Plan](docs/PHASE_3_ACCEPTANCE_PLAN.md)

## Firebase
Install the Firebase CLI, authenticate locally, then from the project root run `firebase deploy` when the app is ready for production.

The repository does not contain passwords, private keys, service-account JSON, or production secrets.
