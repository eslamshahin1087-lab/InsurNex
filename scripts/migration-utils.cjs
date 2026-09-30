"use strict";

const TARGET_COLLECTIONS = Object.freeze({
  clients: "customers",
  quotes: "quotations",
  appointments: "calendarEvents",
  messages: "communications",
  products: "insuranceProducts"
});

function sourceWorkspace(data) {
  const organizationId = data.organizationId || null;
  const ownerId = data.ownerId || data.userId || data.createdBy || data.uid || null;
  if (organizationId) return { workspaceType: "organization", organizationId, ownerId };
  if (ownerId) return { workspaceType: "personal", organizationId: null, ownerId };
  return null;
}

function mapRecord(source, sourceDocumentId, data, timestamps) {
  const workspace = sourceWorkspace(data);
  if (!workspace) return null;
  const timestamp = timestamps && timestamps.serverTimestamp;
  return {
    ...data,
    ...workspace,
    migratedFrom: { collection: source, documentId: sourceDocumentId },
    migratedAt: timestamp,
    updatedAt: data.updatedAt || timestamp
  };
}

module.exports = { TARGET_COLLECTIONS, sourceWorkspace, mapRecord };
