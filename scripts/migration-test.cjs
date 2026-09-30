"use strict";

const assert = require("node:assert/strict");
const { TARGET_COLLECTIONS, sourceWorkspace, mapRecord } = require("./migration-utils.cjs");

assert.deepEqual(TARGET_COLLECTIONS, {
  clients: "customers",
  quotes: "quotations",
  appointments: "calendarEvents",
  messages: "communications",
  products: "insuranceProducts"
});

assert.deepEqual(sourceWorkspace({ ownerId: "user-1" }), {
  workspaceType: "personal", organizationId: null, ownerId: "user-1"
});
assert.deepEqual(sourceWorkspace({ organizationId: "org-1", createdBy: "user-1" }), {
  workspaceType: "organization", organizationId: "org-1", ownerId: "user-1"
});
assert.equal(sourceWorkspace({ name: "unowned legacy record" }), null);

const timestamp = { sentinel: true };
const source = {
  ownerId: "user-1",
  createdAt: "original-created-at",
  updatedAt: "original-updated-at",
  customerName: "Example"
};
const mapped = mapRecord("clients", "client-original-id", source, { serverTimestamp: timestamp });
assert.equal(mapped.ownerId, "user-1");
assert.equal(mapped.workspaceType, "personal");
assert.equal(mapped.createdAt, "original-created-at");
assert.equal(mapped.updatedAt, "original-updated-at");
assert.deepEqual(mapped.migratedFrom, { collection: "clients", documentId: "client-original-id" });
assert.equal(mapped.migratedAt, timestamp);
assert.equal(mapRecord("clients", "no-owner", { name: "No owner" }, { serverTimestamp: timestamp }), null);

console.log("Migration utility tests passed.");
