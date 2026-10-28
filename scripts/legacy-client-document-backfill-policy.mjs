import { createHash } from 'node:crypto';
import { parseLegacyClientDocumentReference } from '../supabase/functions/document-storage/access-policy.mjs';

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const CATEGORIES = new Set([
  'policy', 'claim', 'client', 'identity', 'proposal',
  'correspondence', 'invoice', 'receipt', 'other',
]);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function safeSize(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function isoTimestamp(value) {
  try {
    if (value && typeof value.toDate === 'function') {
      const date = value.toDate();
      return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
    }
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
    if (typeof value === 'string' && value.trim()) {
      const date = new Date(value);
      return Number.isFinite(date.getTime()) ? date.toISOString() : null;
    }
  } catch {
    return null;
  }
  return null;
}

function categoryFor(item) {
  const explicit = text(item.category).toLowerCase();
  if (CATEGORIES.has(explicit)) return explicit;
  const legacyType = text(item.type).toLowerCase();
  if (legacyType === 'claim') return 'claim';
  if (legacyType === 'policy') return 'policy';
  if (['proposal', 'quotation'].includes(legacyType)) return 'proposal';
  if (['national-id', 'signatory-id', 'tax-card', 'commercial-register', 'license', 'identity'].includes(legacyType)) {
    return 'identity';
  }
  return 'client';
}

function pathKey(bucket, path) {
  return `${bucket}\u0000${path}`;
}

function deterministicDocumentId({ projectId, organizationId, clientId, embeddedDocumentId, bucket, path }) {
  const stableKey = [projectId, organizationId, clientId, embeddedDocumentId, bucket, path].join('\u0000');
  return `legacy_${createHash('sha256').update(stableKey).digest('hex').slice(0, 40)}`;
}

function normalizedEmbeddedReference(clientRecord, item, options) {
  return parseLegacyClientDocumentReference({
    id: text(item.id),
    storageProvider: text(item.storageProvider) || undefined,
    storageBucket: text(item.storageBucket) || undefined,
    storagePath: text(item.storagePath) || undefined,
    url: text(item.url) || undefined,
    downloadUrl: text(item.downloadUrl) || undefined,
  }, {
    organizationId: text(clientRecord.data?.organizationId),
    clientId: text(clientRecord.id),
    expectedBucket: options.bucket,
    expectedHost: options.supabaseHost,
  });
}

/**
 * Builds a deterministic manifest only. It performs no cloud calls and writes
 * no data. The caller supplies projected client/documents metadata.
 */
export function buildLegacyClientDocumentBackfillPlan({
  projectId,
  supabaseHost,
  bucket,
  clientRecords,
  documentRecords,
  generatedAt = new Date().toISOString(),
}) {
  const entries = [];
  const existingByPath = new Map();
  const existingById = new Map();

  for (const record of documentRecords) {
    const data = record.data || {};
    if (typeof record.id === 'string') existingById.set(record.id, data);
    const existingPath = text(data.storagePath);
    const existingBucket = text(data.storageBucket) || (data.storageProvider === 'supabase' ? bucket : '');
    if (!existingPath || !existingBucket) continue;
    const key = pathKey(existingBucket, existingPath);
    const rows = existingByPath.get(key) || [];
    rows.push(record);
    existingByPath.set(key, rows);
  }

  for (const clientRecord of clientRecords) {
    const organizationId = text(clientData.organizationId);
    const clientId = text(clientRecord.id);
    const embeddedDocuments = Array.isArray(clientData.documents) ? clientData.documents : [];
    embeddedDocuments.forEach((rawItem, index) => {
      if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) return;
      const item = rawItem;
      const embeddedDocumentId = text(item.id);
      const base = {
        sourceCollection: 'clients',
        sourceClientId: clientId,
        sourceEmbeddedDocumentId: embeddedDocumentId || null,
        sourceIndex: index,
        organizationId: organizationId || null,
        sourceUploadedAtIso: isoTimestamp(rawItem?.uploadedAt),
        status: 'needs_review',
        reason: '',
        bucket: null,
        objectPath: null,
        targetDocumentId: null,
        proposedRecord: null,
      };

      if (!SAFE_ID.test(organizationId) || !SAFE_ID.test(clientId) || !SAFE_ID.test(embeddedDocumentId)) {
        entries.push({ ...base, reason: 'INVALID_SOURCE_ID' });
        return;
      }

      const parsed = normalizedEmbeddedReference(clientRecord, item, { bucket, supabaseHost });
      if (!parsed) {
        entries.push({ ...base, reason: text(item.storageProvider) === 'firebase'
          ? 'FIREBASE_REFERENCE_REQUIRES_SEPARATE_INVENTORY'
          : 'REFERENCE_UNSUPPORTED_OR_CONFLICTING' });
        return;
      }
      base.bucket = parsed.bucket;
      base.objectPath = parsed.path;

      const key = pathKey(parsed.bucket, parsed.path);
      const existing = existingByPath.get(key) || [];
      if (existing.length > 1) {
        entries.push({ ...base, reason: 'DUPLICATE_EXISTING_DOCUMENT_MAPPINGS' });
        return;
      }
      if (existing.length === 1) {
        const match = existing[0];
        const data = match.data || {};
        const isSameTenantRelation =
          data.organizationId === organizationId &&
          data.relatedType === 'client' &&
          data.relatedId === clientId &&
          (data.storageProvider === 'supabase' || !data.storageProvider);
        if (isSameTenantRelation) {
          entries.push({
            ...base,
            status: 'already_mapped',
            reason: 'EXISTING_DOCUMENT_RECORD_MATCHES_PATH_AND_CLIENT',
            targetDocumentId: match.id,
          });
        } else {
          entries.push({ ...base, reason: 'EXISTING_PATH_HAS_DIFFERENT_METADATA_OWNER' });
        }
        return;
      }

      const targetDocumentId = deterministicDocumentId({
        projectId, organizationId, clientId, embeddedDocumentId,
        bucket: parsed.bucket, path: parsed.path,
      });
      const targetCollision = existingById.get(targetDocumentId);
      if (targetCollision) {
        const exact = targetCollision.organizationId === organizationId
          && targetCollision.relatedType === 'client'
          && targetCollision.relatedId === clientId
          && targetCollision.storageBucket === parsed.bucket
          && targetCollision.storagePath === parsed.path
          && targetCollision.storageProvider === 'supabase';
        entries.push({
          ...base,
          status: exact ? 'already_mapped' : 'needs_review',
          reason: exact ? 'DETERMINISTIC_TARGET_ALREADY_EXISTS' : 'DETERMINISTIC_TARGET_ID_COLLISION',
          targetDocumentId,
        });
        return;
      }

      const originalFileName = text(item.originalFileName)
        || text(item.fileName)
        || text(item.label)
        || parsed.filename;
      const category = categoryFor(item);
      const contentType = text(item.mimeType) || text(item.contentType);
      const size = safeSize(item.size);
      const uploadedAt = isoTimestamp(item.uploadedAt);
      const proposedRecord = {
        organizationId,
        name: text(item.label) || originalFileName,
        category,
        originalFileName,
        ...(contentType ? { contentType } : {}),
        ...(size !== null ? { size } : {}),
        storagePath: parsed.path,
        storageProvider: 'supabase',
        storageBucket: parsed.bucket,
        // Keep the URL blank. A new signed URL must be generated on demand.
        downloadUrl: '',
        relatedType: 'client',
        relatedId: clientId,
        ...(text(item.uploadedBy) ? { uploadedBy: text(item.uploadedBy) } : {}),
        notes: text(item.notes),
        status: 'active',
      };
      entries.push({
        ...base,
        status: 'candidate',
        reason: 'REVIEW_REQUIRED_BEFORE_BACKFILL',
        targetDocumentId,
        proposedRecord,
      });
    });
  }

  const candidatePathRefs = new Map();
  for (const entry of entries) {
    if (entry.status !== 'candidate' || !entry.bucket || !entry.objectPath) continue;
    const key = pathKey(entry.bucket, entry.objectPath);
    const refs = candidatePathRefs.get(key) || [];
    refs.push(entry);
    candidatePathRefs.set(key, refs);
  }
  for (const refs of candidatePathRefs.values()) {
    if (refs.length > 1) {
      for (const entry of refs) {
        entry.status = 'needs_review';
        entry.reason = 'DUPLICATE_EMBEDDED_OBJECT_REFERENCE';
        entry.proposedRecord = null;
      }
    }
  }

  const counts = {
    clientRecordsScanned: clientRecords.length,
    existingDocumentRecordsScanned: documentRecords.length,
    embeddedDocumentReferencesScanned: entries.length,
    eligibleCandidates: entries.filter(item => item.status === 'candidate').length,
    alreadyMapped: entries.filter(item => item.status === 'already_mapped').length,
    needsReview: entries.filter(item => item.status === 'needs_review').length,
    duplicateEmbeddedObjectGroups: [...candidatePathRefs.values()].filter(rows => rows.length > 1).length,
  };

  return {
    schemaVersion: 1,
    projectId,
    generatedAt,
    mode: 'read-only-dry-run-plan',
    noCloudChangesMade: true,
    writesAttempted: false,
    storageObjectsVerified: false,
    limitations: [
      'No Firestore records are created or updated by this planner.',
      'No Storage object existence, downloadability, byte checksum, or content is verified.',
      'Candidate records require human review and independent Storage verification before any backfill.',
      'The source embedded document arrays are left untouched.',
    ],
    counts,
    entries,
  };
}
