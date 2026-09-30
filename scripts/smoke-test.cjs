#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const required = [
  "index.html",
  "InsurNex-User.html",
  "InsurNex-admin.html",
  "user.html",
  "admin.html",
  "manifest.json",
  "firebase.json",
  "firestore.rules",
  "storage.rules",
  "js/config.js",
  "js/core.js",
  "js/user.js",
  "js/admin-app.js",
  "scripts/migrate-legacy-data.cjs",
  "css/app.css",
  "assets/logo.svg",
  "assets/icon.svg",
  ".env.example",
  "README.md",
  "docs/MIGRATION.md"
];

const forbiddenNames = [
  "securepath-firebase-migration.js",
  "js/admin.js",
  "test-firebase.html",
  "wathiqati-app.html"
];

const legacyTokens = [
  new RegExp("Secure" + "Path", "i"),
  new RegExp("Wathi" + "qati", "i")
];

const ignore = new Set([".git", "node_modules"]);

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignore.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs));
    else out.push(abs);
  }
  return out;
}

const failures = [];
const firebaseRc = JSON.parse(fs.readFileSync(path.join(root, ".firebaserc"), "utf8"));
const projectId = firebaseRc.projects?.default;
if (projectId !== "insurnex-8a9df") failures.push("Firebase default project does not match the existing InsurNex project.");

const firebaseConfigSource = fs.readFileSync(path.join(root, "js/config.js"), "utf8");
const userAppSource = fs.readFileSync(path.join(root, "InsurNex-User.html"), "utf8");
const adminAppSource = fs.readFileSync(path.join(root, "InsurNex-admin.html"), "utf8");

for (const [label, source] of [
  ["shared config", firebaseConfigSource],
  ["user app", userAppSource],
  ["admin app", adminAppSource]
]) {
  if (!source.includes('projectId: "insurnex-8a9df"')) {
    failures.push("Firebase projectId is missing or inconsistent in " + label + ".");
  }
  if (!/apiKey:\\s*["'][^"']{20,}["']/.test(source)) {
    failures.push("Firebase Web API key is missing or looks like a placeholder in " + label + ".");
  }
  if (!source.includes("insurnex-8a9df.firebaseapp.com")) {
    failures.push("Firebase Auth domain is missing or inconsistent in " + label + ".");
  }
}

for (const rel of required) {
  if (!fs.existsSync(path.join(root, rel))) failures.push("Missing required file: " + rel);
}
for (const rel of forbiddenNames) {
  if (fs.existsSync(path.join(root, rel))) failures.push("Legacy file still present: " + rel);
}

const textExt = new Set([".html",".js",".cjs",".json",".css",".md",".rules",".xml",".yml",".yaml"]);
for (const abs of walk(root)) {
  const rel = path.relative(root, abs);
  if (path.resolve(abs) === path.resolve(__filename)) continue;
  if (!textExt.has(path.extname(abs)) && ![".firebaserc",".gitignore",".env.example"].includes(path.basename(abs))) continue;
  const content = fs.readFileSync(abs, "utf8");
  for (const re of legacyTokens) {
    if (re.test(content)) failures.push("Legacy reference in " + rel + ": " + re);
  }
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
if (manifest.name !== "InsurNex" || manifest.short_name !== "InsurNex") failures.push("Manifest identity is not InsurNex.");
if (manifest.start_url !== "./InsurNex-User.html") failures.push("Manifest start_url must be ./InsurNex-User.html.");

const firebase = JSON.parse(fs.readFileSync(path.join(root, "firebase.json"), "utf8"));
if (!firebase.firestore?.rules || !firebase.firestore?.indexes || !firebase.storage?.rules || !firebase.hosting?.public) {
  failures.push("Firebase configuration is incomplete.");
}

if (failures.length) {
  console.error("InsurNex smoke test FAILED:");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("InsurNex smoke test PASSED.");
console.log("Required files: " + required.length);
console.log("Legacy references/files: 0");
