#!/usr/bin/env node
"use strict";

/**
 * Safe Firestore collection audit/bootstrap for InsurNex.
 *
 * Default mode is read-only. It never creates empty collections, deletes data,
 * or overwrites documents. Firestore collections appear when their first real
 * document is written.
 *
 * Credentials:
 *   FIREBASE_SERVICE_ACCOUNT_JSON='{"project_id":"insurnex-8a9df",...}'
 * or GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *
 * Preview:
 *   node scripts/firestore-bootstrap.cjs
 *   node scripts/firestore-bootstrap.cjs --config ./firestore-bootstrap.json
 *
 * Apply only after reviewing the preview:
 *   node scripts/firestore-bootstrap.cjs --apply --confirm-project insurnex-8a9df
 */

const fs = require("node:fs");
const path = require("node:path");
const admin = require("firebase-admin");

const ROOT = path.resolve(__dirname, "..");
const EXPECTED_PROJECT_ID = "insurnex-8a9df";
const DEFAULT_CONFIG = path.join(ROOT, "firestore-bootstrap.json");

// Collection names declared in firestore.rules (excluding the rules namespace).
const RULE_COLLECTIONS = Object.freeze([
  "users", "organizations", "organizationMembers", "brokerProfiles",
  "notifications", "auditLogs", "knowledgeBase", "announcements", "insurers",
  "insuranceProducts", "settings", "reports", "analytics", "subscriptions",
  "invoices", "supportTickets", "documents", "clients", "leads", "policies",
  "quotes", "renewals", "claims", "payments", "tasks", "appointments",
  "activities", "notes", "messages", "conversations", "organizationRequests",
  "customers", "opportunities", "quotations", "calendarEvents", "communications",
  "commissions", "teams", "plans"
]);

// Bootstrap is intentionally limited to platform/reference data. Operational
// records must be created through the app's validated workflows.
const BOOTSTRAPPABLE_COLLECTIONS = new Set([
  "settings", "plans", "insurers", "insuranceProducts", "announcements", "knowledgeBase"
]);

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function readConfigFile(file) {
  if (!fs.existsSync(file)) return null;
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Bootstrap config must be a JSON object.");
  }
  if (parsed.projectId !== EXPECTED_PROJECT_ID) {
    throw new Error("Config projectId must be exactly " + EXPECTED_PROJECT_ID + ".");
  }
  if (!Array.isArray(parsed.documents)) {
    throw new Error('Bootstrap config must contain a "documents" array.');
  }
  return parsed;
}

function loadServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    const account = JSON.parse(raw);
    if (account.project_id !== EXPECTED_PROJECT_ID) {
      throw new Error("Service account project_id does not match " + EXPECTED_PROJECT_ID + ".");
    }
    return admin.credential.cert(account);
  }

  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (file) {
    const absolute = path.resolve(file);
    const account = JSON.parse(fs.readFileSync(absolute, "utf8"));
    if (account.project_id !== EXPECTED_PROJECT_ID) {
      throw new Error("Credential file project_id does not match " + EXPECTED_PROJECT_ID + ".");
    }
    return admin.credential.cert(account);
  }

  throw new Error(
    "No Firebase Admin credentials found. Set FIREBASE_SERVICE_ACCOUNT_JSON or " +
    "GOOGLE_APPLICATION_CREDENTIALS locally. Never commit or share the key."
  );
}

function validateDocuments(documents) {
  const ids = new Set();
  for (const [index, item] of documents.entries()) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("documents[" + index + "] must be an object.");
    }
    const { collection, id, data } = item;
    if (!BOOTSTRAPPABLE_COLLECTIONS.has(collection)) {
      throw new Error(
        "documents[" + index + "]: collection " + JSON.stringify(collection) +
        " is not on the bootstrap allowlist. Create operational records through InsurNex."
      );
    }
    if (typeof id !== "string" || !id.trim() || id.includes("/")) {
      throw new Error("documents[" + index + "].id must be a non-empty document ID without '/'.");
    }
    if (!data || typeof data !== "object" || Array.isArray(data) || Object.keys(data).length === 0) {
      throw new Error("documents[" + index + "].data must contain real fields; empty/placeholder documents are not allowed.");
    }
    const key = collection + "/" + id;
    if (ids.has(key)) throw new Error("Duplicate document in config: " + key);
    ids.add(key);
    if (Object.prototype.hasOwnProperty.call(data, "organizationId") &&
        data.organizationId !== null && typeof data.organizationId !== "string") {
      throw new Error(key + ": organizationId must be a string or null.");
    }
  }
}

async function main() {
  if (process.argv.includes("--help")) {
    console.log("Read-only by default. Use --apply --confirm-project insurnex-8a9df to write.");
    console.log("Only settings/plans/insurers/insuranceProducts/announcements/knowledgeBase are allowed.");
    process.exit(0);
  }

  const apply = process.argv.includes("--apply");
  const confirmedProject = argValue("--confirm-project");
  if (apply && confirmedProject !== EXPECTED_PROJECT_ID) {
    throw new Error("Writes require --confirm-project " + EXPECTED_PROJECT_ID + ".");
  }

  const firebaseRcPath = path.join(ROOT, ".firebaserc");
  const firebaseRc = JSON.parse(fs.readFileSync(firebaseRcPath, "utf8"));
  if (firebaseRc.projects?.default !== EXPECTED_PROJECT_ID) {
    throw new Error("Refusing to run: .firebaserc default project is not " + EXPECTED_PROJECT_ID + ".");
  }

  const configPath = path.resolve(argValue("--config") || DEFAULT_CONFIG);
  const config = readConfigFile(configPath);
  if (apply && !config) {
    throw new Error(
      "Apply requested, but config file was not found: " + configPath +
      ". Copy scripts/firestore-bootstrap.example.json to firestore-bootstrap.json and add real records."
    );
  }
  if (config) validateDocuments(config.documents);

  if (!admin.apps.length) {
    admin.initializeApp({ credential: loadServiceAccount(), projectId: EXPECTED_PROJECT_ID });
  }
  const db = admin.firestore();
  const existingRefs = await db.listCollections();
  const existing = new Set(existingRefs.map(ref => ref.id));

  console.log("InsurNex Firestore audit");
  console.log("Project: " + EXPECTED_PROJECT_ID);
  console.log("Mode: " + (apply ? "APPLY (create-only)" : "DRY RUN (read-only)"));
  console.log("");
  console.log("Collections declared in firestore.rules:");
  for (const name of RULE_COLLECTIONS) {
    console.log("  " + (existing.has(name) ? "[EXISTS] " : "[ABSENT] ") + name);
  }

  const unruled = [...existing].filter(name => !RULE_COLLECTIONS.includes(name));
  if (unruled.length) {
    console.log("");
    console.log("Existing top-level collections not declared by name in firestore.rules (review; not changed):");
    for (const name of unruled) console.log("  [REVIEW] " + name);
  }

  const docs = config ? config.documents : [];
  console.log("");
  console.log("Configured real bootstrap documents: " + docs.length);
  let created = 0;
  let skipped = 0;

  for (const item of docs) {
    const ref = db.collection(item.collection).doc(item.id);
    const snapshot = await ref.get();
    if (snapshot.exists) {
      skipped++;
      console.log("  [SKIP EXISTS] " + item.collection + "/" + item.id + " (not overwritten)");
      continue;
    }
    if (!apply) {
      console.log("  [WOULD CREATE] " + item.collection + "/" + item.id);
      continue;
    }
    await ref.create(item.data);
    created++;
    console.log("  [CREATED] " + item.collection + "/" + item.id);
  }

  console.log("");
  console.log("Summary: " + (apply ? "created " + created : "previewed " + docs.length) +
    ", skipped-existing " + skipped + ".");
  console.log("No documents were deleted or overwritten.");
  if (!apply) {
    console.log("No writes performed. Review the report, then use --apply --confirm-project " +
      EXPECTED_PROJECT_ID + " only if the listed real records are correct.");
  }
  if (!docs.length) {
    console.log("No seed records were supplied. This audit did not create any collections or placeholder documents.");
  }
}

main().catch(error => {
  console.error("Firestore bootstrap stopped safely: " + error.message);
  process.exitCode = 1;
});
