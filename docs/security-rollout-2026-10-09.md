# InsurNex security rollout checklist (2026-10-09)

This rollout does not delete collections, documents, users, Storage objects, or change existing document IDs. Do not treat a green CI run as proof that production rules or the Supabase Edge Function have been deployed.

## What CI validates

- npm ci, npm run lint, and npm run build.
- Firestore and Firebase Storage rules against the demo-insurnex emulators only.
- Supabase document-storage authorization policy helpers in Node tests.
- Role isolation, immutable creator/organization/creation fields, protected financial fields, file MIME/size/path restrictions, uploader-bound deletion, suspended member handling, and legacy-profile compatibility.

## Deployment prerequisites

1. Back up the currently published Firestore Rules and Storage Rules source from Firebase Console.
2. Confirm the active project is insurnex-8a9df and the existing Supabase project/bucket is the one already used by InsurNex. Do not create a replacement project or bucket just to satisfy this checklist.
3. Run a read-only audit of active user profiles and organizations/{orgId}/members/{uid} records. New profiles have membershipEnforced: true. Existing profiles without that flag retain the legacy authorization path; explicit inactive or suspended membership records are denied. Only mark a legacy profile strict after confirming its nested member record has the same UID, status: active, and the intended role.
4. Make sure the insurnex-documents Supabase Storage bucket is private. The Edge Function uses the server-side service role, so all caller authorization must stay in the function; never put the service-role key in a VITE_ variable or client bundle.

## Suggested order

Run the commands below from a trusted machine after logging in to the existing projects. Do not put API keys, service-role keys, or access tokens into Git or chat.

### 1. Firestore indexes

The storage gateway queries document metadata by organizationId and storagePath. Deploy the additive composite indexes and wait until the Firebase Console shows them ready:

```powershell
firebase use insurnex-8a9df
firebase deploy --only firestore:indexes
```

This adds indexes; it does not rewrite or delete existing Firestore data.

### 2. Firestore Rules

After inspecting the published rules backup and confirming the read-only membership audit, publish the repository's firestore.rules:

```powershell
firebase deploy --only firestore:rules
```

After publishing, run a smoke test using existing accounts before removing or changing any legacy compatibility. Verify login, profile reads, clients, leads, policies, claims, payments, and organization switching.

### 3. Supabase document-storage gateway (required for Firebase Spark)

As of February 3, 2026, Firebase Cloud Storage access requires the Blaze plan. On Spark, Firebase Storage can remain in the project but upload/download calls are not available. This repository therefore routes new documents and operations attachments through the existing Supabase storage provider rather than treating storage.rules deployment as restoring Storage availability.

From a trusted terminal linked to the existing Supabase project:

```powershell
supabase link --project-ref <EXISTING_SUPABASE_PROJECT_REF>
supabase secrets set FIREBASE_PROJECT_ID=insurnex-8a9df FIREBASE_WEB_API_KEY=<FIREBASE_WEB_API_KEY> SUPABASE_DOCUMENT_BUCKET=insurnex-documents
supabase functions deploy document-storage
```

SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are Supabase server-side environment values; confirm they are available to the deployed function. Never expose the service-role key to the browser.

### 4. Rebuild and publish the client

The Vite build needs these environment variables, set in the trusted build environment:

- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY
- VITE_SUPABASE_DOCUMENT_BUCKET=insurnex-documents

They are not currently present in the tracked .env file, so verify the existing hosting build environment has them before publishing. Then:

```powershell
npm ci
npm run lint
npm run build
firebase deploy --only hosting
```

Do not publish the client if the Supabase environment is missing: the app deliberately reports DOCUMENT_STORAGE_NOT_CONFIGURED in that case.

## Post-deploy smoke test

Use two existing active users from different organizations, a manager/admin, a broker, a finance role, and a read-only viewer:

- Existing users can log in and read their current records without changing UIDs or IDs.
- Cross-organization reads and writes are denied.
- A broker can update allowed policy workflow fields but cannot change premiums, commission amounts, or claim settlement amounts.
- Finance can update allowed payment workflow fields but cannot alter a stored payment amount or delete a payment.
- A viewer can read permitted records but cannot create business records or upload new files.
- Storage upload rejects unsupported types, over-size files, cross-organization paths, inactive profiles, and suspended members.
- A user cannot delete another user's file by submitting forged or duplicate Firestore metadata.
- Existing legacy Supabase paths remain readable by matching records; legacy file deletion requires a file manager because the old path alone cannot prove uploader identity.

If any read/write smoke test fails, restore the saved published rules immediately from Firebase Console; do not delete or recreate any documents to make the test pass.
