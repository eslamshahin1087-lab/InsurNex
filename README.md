# InsurNex

Smarter Insurance Brokerage platform. Clean-rebuild foundation for React + TypeScript + Vite and Firebase project `insurnex-8a9df`.

## Local setup
1. Use Node.js 22.
2. Run `npm ci`.
3. For local development, create `.env.local` with the Firebase Web App config for the intended project.
4. Run `npm run dev`.

## Production Hosting configuration
1. Copy `.env.example` to `.env.production.local`.
2. Replace the Firebase placeholders with the exact Web App config from Firebase Console > Project settings > Your apps > Web app > Config. The production project ID must be `insurnex-8a9df`.
3. Run `npm run test:hosting-config` and `npm run verify:hosting-config`.
4. Deploy only through `npm run deploy:hosting`. The command validates the production configuration before building and deploying.
5. Never use `.env.demo.local`, an Admin SDK private key, or a service-account JSON file for a production web build. Local `.env.*.local` files are ignored by Git.

Vite embeds `VITE_*` values into the client bundle during build. They must be the public Firebase Web App configuration for the same project that serves Hosting.

## Quality checks
- `npm run test:access` — admin/user access boundary smoke checks.
- `npm run test:plans` — subscription plan feature entitlement smoke checks.
- `npm run test:pwa` — PWA installability and privacy smoke checks.
- `npm run test:storage-gateway` — document-storage authorization policy regression tests.
- `npm run test:storage-inventory` — legacy storage inventory policy regression tests.
- `npm run test:legacy-client-backfill-plan` — deterministic read-only backfill planner tests.
- `npm run test:client-sensitive-inventory` — privacy-safe sensitive-field inventory tests.
- `npm run test:client-sensitive-separation-plan` — fail-closed field mapping proposal tests.
- `npm run test:client-sensitive-separation-review` — plan safety and mapping invariants.
- `npm run test:client-data-access-audit` — static audit privacy and query-scope regression tests.
- `npm run audit:client-data-access` — source-only client-data access inventory; no cloud access.
- `npm run lint`
- `npm run build`
- `npm run build --prefix functions`

## Product identity
- [InsurNex Brand Identity System V3](docs/BRAND_IDENTITY_SYSTEM_V3.md)

## Access model
- [Local Firebase Emulator Testing](docs/LOCAL_FIREBASE_EMULATOR_TESTING.md)
- [Admin and User Access Model](docs/ADMIN_ACCESS_MODEL.md)
- [Subscription Plan Feature Entitlements](docs/PLAN_FEATURE_ENTITLEMENTS.md)
- [InsurNex Development Roadmap](docs/INSURNEX_DEVELOPMENT_ROADMAP.md)
- [Phase 0 Technical Baseline](docs/PHASE_0_TECHNICAL_BASELINE_2026-10-30.md)
- [Master Execution Backlog](docs/MASTER_EXECUTION_BACKLOG.md)
- [Phase 1 Runtime Compatibility](docs/PHASE_1_RUNTIME_COMPATIBILITY_2026-10-30.md)
- [Client Sensitive-Field Inventory Runbook](docs/CLIENT_SENSITIVE_DATA_INVENTORY_RUNBOOK.md)
- [Client Sensitive-Data Separation Plan Runbook](docs/CLIENT_SENSITIVE_DATA_SEPARATION_PLAN_RUNBOOK.md)
- [Client Sensitive-Data RBAC Matrix](docs/CLIENT_SENSITIVE_DATA_RBAC_MATRIX.md)
- [Client Data-Access Compatibility Audit](docs/CLIENT_DATA_ACCESS_COMPATIBILITY_AUDIT.md)
- [Master Architecture](docs/MASTER_ARCHITECTURE.md)
- [Firestore Schema v2 Proposal](docs/FIRESTORE_SCHEMA_V2_PROPOSAL.md)
- [AI Module Contracts](docs/AI_MODULE_CONTRACTS.md)
- [Phase 3 Acceptance Plan](docs/PHASE_3_ACCEPTANCE_PLAN.md)

## Firebase and release safety
- Do not run the generic `firebase deploy` command. It can target multiple Firebase resources and bypasses the repository's intended release sequence.
- Production Hosting is opt-in and must use `npm run deploy:hosting` only after a separate explicit release approval. The command checks the pinned project, production configuration and deployment opt-in before building and deploying.
- Firestore Rules/indexes, Firebase Functions, Supabase Edge Functions, secrets and storage changes require their own reviewed change, environment-specific validation and explicit approval. Do not deploy them as part of a generic release command.
- Firebase Functions deployment is blocked under the approved Spark-only constraint; keep Functions build/type-check validation separate from deployment.
- Use the `demo-insurnex` Firebase Emulator workflow in [Local Firebase Emulator Testing](docs/LOCAL_FIREBASE_EMULATOR_TESTING.md) for local security tests. Never point emulator-mode builds at a live project.

The repository does not contain passwords, private keys, service-account JSON, or production secrets.
