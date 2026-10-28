import { createHash } from 'node:crypto';
import { normalizeSupabaseStorageReference } from './legacy-storage-inventory-policy.mjs';

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const CATEGORIES = new Set([
  'policy', 'claim', 'client', 'identity', 'proposal',
  'correspondence', 'invoice', 'receipt', 'other',
]);
const ALLOWED_AREAS = new Set(['onboarding', 'quotation', 'issuance', 'policy', 'claim', 'renewal']);

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
  const organizationId = text(clientRecord.data?.organizationId);
  const clientId = text(clientRecord.id);
  if (!SAFE_ID.test(organizationId) || !SAFE_ID.test(clientId)) return null;

  const provider = text(item.storageProvider).toLowerCase();
  if (provider && provider !== 'supabase') return null;

  const rawUrls = [item.url, item.downloadUrl].filter(value => typeof value === 'string' && value.trim());
  const candidates = [];
  const stablePath = text(item.storagePath);
  // A plain path without a confirming Supabase URL is accepted only when
  // the stored provider explicitly says Supabase. Otherwise keep it for review.
  if (stablePath) {
    if (provider !== 'supabase' && rawUrls.length === 0) return null;
    const stableBucket = text(item.storageBucket) || (provider === 'supabase' ? options.bucket : '');
    if (!stableBucket || stableBucket !== options.bucket) return null;
    candidates.push({ bucket: stableBucket, path: stablePath, source: 'storagePath' });
  }

  for (const rawUrl of rawUrls) {
    let url;
    try {
      url = new URL(rawUrl.trim());
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== options.supabaseHost.toLowerCase()) return null;
    const normalized = normalizeSupabaseStorageReference(rawUrl);
    if (normalized.status !== 'resolved' || normalized.bucket !== options.bucket) return null;
    candidates.push({ bucket: normalized.bucket, path: normalized.path, source: 'url' });
  }

  if (!candidates.length) return null;
  const first = candidates[0];
  if (candidates.some(candidate => candidate.bucket !== first.bucket || candidate.path !== first.path)) return null;

  const parts = first.path.split('/');
  if (
    parts.length !== 6 ||
    parts[0] !== 'organizations' ||
    parts[1] !== organizationId ||
    parts[2] !== 'clients' ||
    parts[3] !== clientId ||
    !ALLOWED_AREAS.has(parts[4]) ||
    !/^[A-Za-z0-9._-]{1,220}$/.test(parts[5])
  ) return null;

  return {
    bucket: first.bucket,
    path: first.path,
    area: parts[4],
    filename: parts[5],
    source: first.source,
  };
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
  const embeddedPathRefs = new Map();

  // Detect duplicate legacy references before checking existing mappings. A
  // first-class record must not make duplicate source references look safe.
  for (const clientRecord of clientRecords) {
    const data = clientRecord.data || {};
    const embeddedDocuments = Array.isArray(data.documents) ? data.documents : [];
    for (const item of embeddedDocuments) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const parsed = normalizedEmbeddedReference(clientRecord, item, { bucket, supabaseHost });
      if (!parsed) continue;
      const key = pathKey(parsed.bucket, parsed.path);
      embeddedPathRefs.set(key, (embeddedPathRefs.get(key) || 0) + 1);
    }
  }

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
    const clientData = clientRecord.data || {};
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
      const category = categoryFor(item);
      base.documentCategory = category;

      const key = pathKey(parsed.bucket, parsed.path);
      if ((embeddedPathRefs.get(key) || 0) > 1) {
        entries.push({ ...base, reason: 'DUPLICATE_EMBEDDED_OBJECT_REFERENCE' });
        return;
      }
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
          data.storageProvider === 'supabase' &&
          (text(data.storageBucket) === parsed.bucket || !text(data.storageBucket));
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

      if (category === 'claim') {
        entries.push({
          ...base,
          reason: 'CLAIM_LEGACY_PATH_ROLE_POLICY_REVIEW_REQUIRED',
          targetDocumentId,
        });
        return;
      }

      const originalFileName = text(item.originalFileName)
        || text(item.fileName)
        || text(item.label)
        || parsed.filename;
      const contentType = text(item.mimeType) || text(item.contentType);
      const size = safeSize(item.size);
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

  const duplicateEmbeddedObjectGroups = [...embeddedPathRefs.values()].filter(count => count > 1).length;

  const counts = {
    clientRecordsScanned: clientRecords.length,
    existingDocumentRecordsScanned: documentRecords.length,
    embeddedDocumentReferencesScanned: entries.length,
    eligibleCandidates: entries.filter(item => item.status === 'candidate').length,
    alreadyMapped: entries.filter(item => item.status === 'already_mapped').length,
    needsReview: entries.filter(item => item.status === 'needs_review').length,
    duplicateEmbeddedObjectGroups,
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
