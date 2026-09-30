#!/usr/bin/env node
"use strict";

const admin = require("firebase-admin");
const { sourceWorkspace, mapRecord, TARGET_COLLECTIONS } = require("./migration-utils.cjs");

const PAGE_SIZE = 200;
const BATCH_SIZE = 400;
const APPLY = process.argv.includes("--apply");

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
  if (!APPLY) {
    console.log("DRY RUN: no documents will be written. Pass --apply to execute the migration.");
  }

  const service = JSON.parse(raw);
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(service) });
  const db = admin.firestore();
  const summary = [];

  for (const [source, target] of Object.entries(TARGET_COLLECTIONS)) {
    let cursor = null;
    let eligible = 0;
    let migrated = 0;
    let skippedNoWorkspace = 0;
    let skippedExisting = 0;
    let pending = [];

    async function flush() {
      if (!pending.length) return;
      const count = pending.length;
      const batch = db.batch();
      for (const item of pending) batch.create(item.ref, item.payload);
      await batch.commit();
      migrated += count;
      pending = [];
    }

    while (true) {
      let query = db.collection(source)
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(PAGE_SIZE);
      if (cursor) query = query.startAfter(cursor);
      const snap = await query.get();
      if (snap.empty) break;

      for (const doc of snap.docs) {
        const data = doc.data();
        if (!sourceWorkspace(data)) {
          skippedNoWorkspace++;
          continue;
        }
        eligible++;
        if (!APPLY) continue;

        const targetRef = db.collection(target).doc(doc.id);
        if ((await targetRef.get()).exists) {
          skippedExisting++;
          continue;
        }

        const payload = mapRecord(source, doc.id, data, {
          serverTimestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        if (target === "customers") {
          payload.fullName = payload.fullName || payload.name || payload.displayName || "";
          payload.type = payload.type || "individual";
        }
        if (target === "quotations") payload.status = payload.status || "Draft";
        if (target === "calendarEvents") payload.status = payload.status || "scheduled";
        if (target === "communications") payload.channel = payload.channel || "In-app";
        if (target === "insuranceProducts") payload.status = payload.status || "active";
        pending.push({ ref: targetRef, payload });
        if (pending.length >= BATCH_SIZE) await flush();
      }

      cursor = snap.docs[snap.docs.length - 1];
      if (snap.size < PAGE_SIZE) break;
    }

    await flush();
    summary.push({ source, target, eligible, migrated, skippedNoWorkspace, skippedExisting });
  }

  console.table(summary);
  console.log(APPLY
    ? "Migration completed. Source collections and source document IDs were not modified."
    : "Dry run completed. Source collections were not modified; target collisions are checked only during --apply.");
}

main().catch(error => {
  console.error("InsurNex migration failed safely:", error.message || error);
  process.exit(1);
});
