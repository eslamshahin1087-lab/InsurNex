# InsurNex

Smarter Insurance Brokerage platform. Clean-rebuild foundation for React + TypeScript + Vite and Firebase project `insurnex-8a9df`.

## Architecture references

- [Master Architecture](docs/MASTER_ARCHITECTURE.md) — current stack, target boundaries, data flows, security gates and rollout decisions.
- [Firestore Schema Baseline](docs/FIRESTORE_SCHEMA.md) — current collections, fields, indexes, tenant isolation and proposed future entities.
- [Web/PWA](docs/PWA.md) — installability, safe offline behavior and mobile validation.

## Local setup
1. Use Node.js 22.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and paste the Firebase Web App config values from Firebase Console.
4. Run `npm run dev`.

## Quality checks
- `npm run test:pwa`
- `npm run lint`
- `npm run build`

## Firebase
Install the Firebase CLI, authenticate locally, then from the project root run `firebase deploy` when the app is ready for production.

The repository does not contain passwords, private keys, service-account JSON, or production secrets.
