# Local Firebase Emulator Testing

This runbook starts InsurNex against Firebase Local Emulator Suite without connecting the browser app to a production Firebase project.

## Requirements

- Node.js 22 (matches the repository CI runtime).
- Java 21 or a compatible installed Java runtime for the Firebase emulators.
- Dependencies installed with `npm ci`.

## Demo environment

Create `.env.demo.local` in the repository root. Keep this file local; do not commit it.

```dotenv
VITE_FIREBASE_API_KEY=fake-api-key
VITE_FIREBASE_AUTH_DOMAIN=demo-insurnex.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-insurnex
VITE_FIREBASE_STORAGE_BUCKET=demo-insurnex.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:rules-test
VITE_USE_FIREBASE_EMULATORS=true

VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_DOCUMENT_BUCKET=insurnex-documents
```

The `demo-*` project ID is required when emulator mode is enabled. The app fails closed if a non-demo project ID is configured in emulator mode.

## Start the emulators

In PowerShell window 1, from the repository root:

```powershell
npx --yes firebase-tools emulators:start --project demo-insurnex --only auth,firestore,storage
```

Keep this process running. The default ports used by this project are:

| Emulator | Port |
| --- | ---: |
| Authentication | 9099 |
| Firestore | 8080 |
| Storage | 9199 |

## Start the web app

In PowerShell window 2:

```powershell
npm run dev -- --mode demo --host 127.0.0.1
```

Open the exact local URL printed by Vite, normally `http://127.0.0.1:5173/`.

The app connects Auth, Firestore, and Storage to their emulators immediately after each SDK service is initialized. The browser must not be pointed at a production Firebase project during this workflow.

## Run security rules tests

With the emulators running, in a separate PowerShell window:

```powershell
$env:GCLOUD_PROJECT = 'demo-insurnex'
node scripts/firestore-rules-test.mjs
```

Stop the emulator process with Ctrl+C when testing is complete.

## Scope limitations

Supabase Copilot and document-storage flows remain unavailable unless a separate staging Supabase project is configured. Do not add production credentials to this local demo environment. Firebase Emulator Suite is for local development and testing, not production hosting.
