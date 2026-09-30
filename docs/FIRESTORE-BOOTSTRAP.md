# Safe Firestore audit and bootstrap

This utility targets the existing InsurNex Firebase project `insurnex-8a9df`.
It does not deploy rules or indexes, delete documents, or overwrite existing documents.

## Important Firestore behavior

Firestore does not retain empty collections. A collection appears when its first document is written. Do not create placeholder documents just to make collection names appear in the Console. Operational records (customers, leads, policies, claims, payments, tasks, etc.) should be created through InsurNex so the app supplies workspace and ownership fields expected by `firestore.rules`.

## 1. Prepare locally

Use a trusted local copy of this branch/repository. Install dependencies:

```powershell
npm install
```

Set `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON file stored locally and authorized for the existing project. Do not commit or share that file.

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\your\service-account.json"
```

Before proceeding, verify that the credential belongs to project `insurnex-8a9df`. The script refuses credentials for a different project.

## 2. Read-only audit (default)

```powershell
node scripts/firestore-bootstrap.cjs
```

This lists the top-level collections currently present and compares them with the collection names in `firestore.rules`. Missing names are informational only; no collection or document is created by this command. Existing collections not named in the rules are reported for review and are not changed.

## 3. Prepare only real configuration records

Copy the example file locally:

```powershell
Copy-Item scripts/firestore-bootstrap.example.json firestore-bootstrap.json
```

Edit `firestore-bootstrap.json` and add only verified, real configuration records that the app needs. The local file is ignored by Git. Do not add customer, policy, claim, payment, or other operational records here. The script only allows these configuration collections:

- `settings`
- `plans`
- `insurers`
- `insuranceProducts`
- `announcements`
- `knowledgeBase`

Use document IDs and field names verified against the current app code and rules. Do not include secrets. An empty `documents` array is valid for the audit but does not create any collection.

## 4. Preview, then explicitly apply

Preview the configured documents first:

```powershell
node scripts/firestore-bootstrap.cjs --config ./firestore-bootstrap.json
```

Review every `[WOULD CREATE]` and `[SKIP EXISTS]` line. If and only if the records are correct, explicitly apply:

```powershell
node scripts/firestore-bootstrap.cjs --config ./firestore-bootstrap.json --apply --confirm-project insurnex-8a9df
```

Apply mode uses create-only writes. If a document ID already exists, it is skipped and never overwritten. The script has no delete operation and does not deploy Firestore rules. Review the final summary and verify any created records in Firebase Console.

## Safety notes

- Never share service-account keys, passwords, or private credentials in chat or GitHub.
- Do not modify existing `users`, `organizations`, `organizationMembers`, or `admin` documents as part of collection setup.
- Do not change or deploy `firestore.rules` as part of this procedure.
- An absent collection is not necessarily a defect; it may be created naturally when a real workflow first writes a record.
