# InsurNex

Smarter Insurance Brokerage platform. Clean-rebuild foundation for React + TypeScript + Vite and Firebase project `insurnex-8a9df`.

## Local setup
1. Use Node.js 22.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and paste the Firebase Web App config values from Firebase Console.
4. Run `npm run dev`.

## Quality checks
- `npm run test:access` — admin/user access boundary smoke checks.
- `npm run test:pwa` — PWA installability and privacy smoke checks.
- `npm run lint`
- `npm run build`

## Access model
See [Admin and User Access Model](docs/ADMIN_ACCESS_MODEL.md) for the approved separation between the Platform Admin backend and the broker application, current feature-gate behavior, and validation requirements.

## Firebase
Install the Firebase CLI, authenticate locally, then from the project root run `firebase deploy` when the app is ready for production.

The repository does not contain passwords, private keys, service-account JSON, or production secrets.
