#!/usr/bin/env node
"use strict";

const admin = require("firebase-admin");

function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(name + " is required.");
  return value;
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : "";
}

const role = arg("--role") || process.env.INSURNEX_PLATFORM_ROLE || "";
const uid = arg("--uid") || process.env.INSURNEX_ADMIN_UID || "";
const allowed = new Set(["superAdmin", "platformAdmin"]);

if (!allowed.has(role)) {
  throw new Error("Role must be superAdmin or platformAdmin.");
}
if (!uid) throw new Error("Use --uid <firebase-auth-uid>.");

const serviceAccount = JSON.parse(env("FIREBASE_SERVICE_ACCOUNT_JSON"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

(async () => {
  const user = await admin.auth().getUser(uid);
  const claims = Object.assign({}, user.customClaims || {}, { platformRole: role });
  await admin.auth().setCustomUserClaims(uid, claims);
  console.log(JSON.stringify({ uid, email: user.email || null, platformRole: role }, null, 2));
})().catch((error) => {
  console.error("ERROR:", error.message);
  process.exit(1);
});
