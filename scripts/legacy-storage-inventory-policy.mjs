const FIREBASE_STORAGE_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'firebasestorage.app',
]);

function safeDecode(value) {
  try { return decodeURIComponent(value); } catch { return null; }
}

export function normalizeLegacyStorageReference(value, expectedBucket) {
  if (typeof value !== 'string' || !value.trim()) return { status: 'empty' };
  const raw = value.trim();

  if (raw.startsWith('gs://')) {
    const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(raw);
    if (!match) return { status: 'invalid_reference' };
    const bucket = match[1];
    if (expectedBucket && bucket !== expectedBucket) {
      return { status: 'bucket_mismatch', bucket, path: match[2] };
    }
    return { status: 'resolved', bucket, path: match[2] };
  }

  if (/^https?:\/\//i.test(raw)) {
    let url;
    try { url = new URL(raw); } catch { return { status: 'invalid_url' }; }
    if (!FIREBASE_STORAGE_HOSTS.has(url.hostname)) return { status: 'unsupported_url', hostname: url.hostname };
    const match = /^\/v0\/b\/([^/]+)\/o\/(.+)$/.exec(url.pathname);
    if (!match) return { status: 'unrecognized_firebase_url' };
    const bucket = safeDecode(match[1]);
    const path = safeDecode(match[2]);
    if (!bucket || !path) return { status: 'invalid_url_encoding' };
    if (expectedBucket && bucket !== expectedBucket) {
      return { status: 'bucket_mismatch', bucket, path };
    }
    return { status: 'resolved', bucket, path };
  }

  if (raw.startsWith('/') || raw.includes('\\') || raw.split('/').some(part => part === '.' || part === '..')) {
    return { status: 'invalid_path' };
  }
  return { status: 'resolved', bucket: expectedBucket || null, path: raw };
}

/**
 * Identify Supabase Storage URLs without retaining signed query strings.
 * This extracts a bucket/object key from a signed URL; it does not verify that
 * the object still exists or that its signature has not expired.
 */
export function normalizeSupabaseStorageReference(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value.trim())) {
    return { status: 'not_supabase_storage_url' };
  }

  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return { status: 'invalid_url' };
  }

  const host = url.hostname.toLowerCase();
  const isSupabaseHost = host === 'supabase.co'
    || host.endsWith('.supabase.co')
    || host === 'supabase.in'
    || host.endsWith('.supabase.in');
  if (!isSupabaseHost) return { status: 'not_supabase_storage_url' };

  const parts = url.pathname.split('/').filter(Boolean);
  if (
    parts[0] !== 'storage' ||
    parts[1] !== 'v1' ||
    parts[2] !== 'object' ||
    !['sign', 'public', 'authenticated'].includes(parts[3]) ||
    parts.length < 6
  ) {
    return { status: 'unrecognized_supabase_storage_url', hostname: host };
  }

  const decoded = parts.map(safeDecode);
  if (decoded.some(part => !part)) {
    return { status: 'invalid_url_encoding' };
  }
  const bucket = decoded[4];
  const path = decoded.slice(5).join('/');
  if (!bucket || !path || path.startsWith('/') || path.includes('\\')
      || path.split('/').some(part => part === '.' || part === '..')) {
    return { status: 'invalid_path' };
  }

  return {
    status: 'resolved',
    provider: 'supabase',
    bucket,
    path,
    accessMode: decoded[3],
  };
}

function checksumCandidate(data) {
  for (const key of ['md5Hash', 'md5Checksum', 'storageMd5Hash']) {
    if (typeof data?.[key] === 'string' && data[key]) return { value: data[key], field: key };
  }
  return null;
}

function printable(value) {
  if (value == null) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return null;
}

/**
 * Metadata-only inventory for projects where Firebase Storage is inaccessible.
 * It reads only supplied Firestore metadata and does not infer whether an object
 * exists, whether it is orphaned, or whether its actual size/checksum matches.
 */
export function buildLegacyStorageMetadataInventory({
  projectId,
  collections,
  metadataRecords,
  generatedAt = new Date().toISOString(),
  retryLog = [],
}) {
  const legacyRecords = [];
  const supabaseUrlRecords = [];
  let ignoredSupabaseRecords = 0;
  let ignoredWithoutStorageReference = 0;
  const expandedMetadataRecords = [];

  // Some older client-wizard flows persisted document references inside
  // clients.documents[]. Project only the document metadata needed for audit;
  // never copy full client records or their unrelated personal data into report.
  for (const record of metadataRecords) {
    const data = record.data || {};
    if (record.collection !== 'clients') {
      expandedMetadataRecords.push(record);
      continue;
    }

    const clientHasTopLevelStorageRef =
      (typeof data.storagePath === 'string' && data.storagePath.trim()) ||
      (typeof data.downloadUrl === 'string' && data.downloadUrl.trim());
    if (clientHasTopLevelStorageRef) expandedMetadataRecords.push(record);
    if (!Array.isArray(data.documents)) continue;

    data.documents.forEach((embedded, index) => {
      if (!embedded || typeof embedded !== 'object' || Array.isArray(embedded)) return;
      const storagePath = typeof embedded.storagePath === 'string' ? embedded.storagePath.trim() : '';
      const downloadUrl = [embedded.downloadUrl, embedded.url]
        .find(value => typeof value === 'string' && value.trim())?.trim() || '';
      if (!storagePath && !downloadUrl) {
        ignoredWithoutStorageReference += 1;
        return;
      }
      const embeddedId = typeof embedded.id === 'string' && embedded.id.trim()
        ? embedded.id.trim()
        : String(index);
      expandedMetadataRecords.push({
        collection: 'clients.documents',
        id: record.id + '::' + embeddedId,
        data: {
          organizationId: data.organizationId,
          storageProvider: embedded.storageProvider,
          storagePath,
          downloadUrl,
          originalFileName: embedded.originalFileName || embedded.fileName || embedded.label,
          name: embedded.label || embedded.fileName,
          size: embedded.size,
          contentType: embedded.contentType || embedded.mimeType,
          createdAt: embedded.uploadedAt,
        },
      });
    });
  }

  for (const record of expandedMetadataRecords) {
    const data = record.data || {};
    const storagePath = typeof data.storagePath === 'string' ? data.storagePath.trim() : '';
    const downloadUrl = typeof data.downloadUrl === 'string' ? data.downloadUrl.trim() : '';
    const supabaseUrlResult = normalizeSupabaseStorageReference(downloadUrl);

    if (supabaseUrlResult.status === 'resolved') {
      const issues = [];
      if (data.storageProvider && data.storageProvider !== 'supabase') {
        issues.push('STORAGE_PROVIDER_URL_MISMATCH');
      }

      if (storagePath) {
        const pathResult = normalizeLegacyStorageReference(storagePath, null);
        if (pathResult.status === 'resolved' && pathResult.path !== supabaseUrlResult.path) {
          issues.push('STORAGE_PATH_URL_MISMATCH');
        } else if (pathResult.status !== 'resolved' && pathResult.status !== 'empty') {
          issues.push('STORAGE_PATH_' + pathResult.status.toUpperCase());
        }
      }

      const pathOrganizationMatch = /^organizations\/([^/]+)\//.exec(supabaseUrlResult.path);
      if (pathOrganizationMatch && typeof data.organizationId === 'string'
          && pathOrganizationMatch[1] !== data.organizationId) {
        issues.push('PATH_ORGANIZATION_MISMATCH');
      }

      supabaseUrlRecords.push({
        collection: record.collection,
        documentId: record.id,
        organizationId: printable(data.organizationId),
        provider: 'supabase',
        bucket: supabaseUrlResult.bucket,
        objectPath: supabaseUrlResult.path,
        accessMode: supabaseUrlResult.accessMode,
        fileName: printable(data.originalFileName) || printable(data.name) || supabaseUrlResult.path.split('/').pop() || null,
        declaredSize: data.size === undefined || data.size === null || data.size === ''
          ? null : (Number.isFinite(Number(data.size)) ? Number(data.size) : null),
        declaredContentType: printable(data.contentType),
        createdAt: printable(data.createdAt),
        status: issues.length ? 'needs_review' : 'provider_identified_unverified',
        issues: [...new Set(issues)],
        objectVerified: false,
      });
      continue;
    }

    if (data.storageProvider === 'supabase') {
      ignoredSupabaseRecords += 1;
      continue;
    }

    if (!storagePath && !downloadUrl) {
      ignoredWithoutStorageReference += 1;
      continue;
    }

    const pathResult = storagePath
      ? normalizeLegacyStorageReference(storagePath, null)
      : { status: 'empty' };
    const urlResult = downloadUrl
      ? normalizeLegacyStorageReference(downloadUrl, null)
      : { status: 'empty' };
    const issues = [];
    let objectPath = null;
    let objectBucket = null;

    if (pathResult.status === 'resolved') {
      objectPath = pathResult.path;
      objectBucket = pathResult.bucket || null;
    } else if (pathResult.status !== 'empty') {
      issues.push(pathResult.status.toUpperCase());
    }

    if (urlResult.status === 'resolved') {
      if (objectPath && objectPath !== urlResult.path) {
        issues.push('STORAGE_PATH_URL_MISMATCH');
      } else if (!objectPath) {
        objectPath = urlResult.path;
      }
      if (objectBucket && urlResult.bucket && objectBucket !== urlResult.bucket) {
        issues.push('BUCKET_MISMATCH');
      } else if (!objectBucket && urlResult.bucket) {
        objectBucket = urlResult.bucket;
      }
    } else if (urlResult.status !== 'empty') {
      if (!objectPath) issues.push(urlResult.status.toUpperCase());
      else issues.push('DOWNLOAD_URL_' + urlResult.status.toUpperCase());
    }

    const pathOrganizationMatch = objectPath
      ? /^organizations\/([^/]+)\//.exec(objectPath)
      : null;
    if (pathOrganizationMatch && typeof data.organizationId === 'string'
        && pathOrganizationMatch[1] !== data.organizationId) {
      issues.push('PATH_ORGANIZATION_MISMATCH');
    }

    if (!objectPath && !issues.length) issues.push('UNRESOLVED_STORAGE_REFERENCE');

    legacyRecords.push({
      collection: record.collection,
      documentId: record.id,
      organizationId: printable(data.organizationId),
      objectPath,
      bucket: objectBucket,
      fileName: printable(data.originalFileName) || printable(data.name) || objectPath?.split('/').pop() || null,
      declaredSize: data.size === undefined || data.size === null || data.size === ''
        ? null : (Number.isFinite(Number(data.size)) ? Number(data.size) : null),
      declaredContentType: printable(data.contentType),
      createdAt: printable(data.createdAt),
      status: issues.length ? 'needs_review' : 'metadata_consistent',
      issues: [...new Set(issues)],
      objectVerified: false,
    });
  }

  const referencesByObjectKey = new Map();
  for (const record of legacyRecords) {
    if (!record.objectPath) continue;
    const bucketScope = record.bucket || '<bucket-not-known>';
    const key = bucketScope + '\u0000' + record.objectPath;
    const rows = referencesByObjectKey.get(key) || [];
    rows.push(record);
    referencesByObjectKey.set(key, rows);
  }
  for (const rows of referencesByObjectKey.values()) {
    if (rows.length > 1) {
      for (const row of rows) {
        if (!row.issues.includes('DUPLICATE_METADATA_REFERENCE')) {
          row.issues.push('DUPLICATE_METADATA_REFERENCE');
        }
        row.status = 'needs_review';
      }
    }
  }

  const supabaseReferencesByKey = new Map();
  for (const record of supabaseUrlRecords) {
    const key = record.bucket + '\\u0000' + record.objectPath;
    const rows = supabaseReferencesByKey.get(key) || [];
    rows.push(record);
    supabaseReferencesByKey.set(key, rows);
  }
  for (const rows of supabaseReferencesByKey.values()) {
    if (rows.length > 1) {
      for (const row of rows) {
        if (!row.issues.includes('DUPLICATE_METADATA_REFERENCE')) {
          row.issues.push('DUPLICATE_METADATA_REFERENCE');
        }
        row.status = 'needs_review';
      }
    }
  }

  const summary = {
    collectionsScanned: collections.length,
    collectionNames: collections,
    metadataRecordsScanned: metadataRecords.length,
    legacyMetadataRecords: legacyRecords.length,
    ignoredSupabaseRecords,
    inferredSupabaseUrlReferences: supabaseUrlRecords.length,
    supabaseUrlReferencesNeedingReview: supabaseUrlRecords.filter(item => item.status === 'needs_review').length,
    duplicateSupabaseMetadataPaths: supabaseUrlRecords.filter(item => item.issues.includes('DUPLICATE_METADATA_REFERENCE')).length,
    ignoredWithoutStorageReference,
    metadataConsistentRecords: legacyRecords.filter(item => item.status === 'metadata_consistent').length,
    metadataRecordsNeedingReview: legacyRecords.filter(item => item.status === 'needs_review').length,
    duplicateMetadataPaths: legacyRecords.filter(item => item.issues.includes('DUPLICATE_METADATA_REFERENCE')).length,
    unresolvedMetadataReferences: legacyRecords.filter(item => !item.objectPath).length,
    storageObjectsInspected: 0,
    retryEvents: retryLog.length,
  };

  return {
    schemaVersion: 1,
    generatedAt,
    projectId,
    mode: 'metadata-only-read-only',
    noCloudChangesMade: true,
    storageObjectsInspected: false,
    limitations: [
      'Does not verify object existence or accessibility in Cloud Storage.',
      'Does not identify unreferenced/orphaned Cloud Storage objects.',
      'Does not compare declared size or checksums with actual object metadata.',
      'A metadata_consistent status means only that the stored references are internally consistent.',
    ],
    summary,
    metadataRecords: legacyRecords,
    supabaseUrlReferences: supabaseUrlRecords,
    retryLog,
  };
}

/**
 * Pure reconciliation: it only inspects supplied Firestore metadata and bucket
 * listings. It has no Firebase/Supabase client and performs no writes.
 */
export function buildLegacyStorageInventory({ projectId, bucket, collections, metadataRecords, objects, generatedAt = new Date().toISOString(), retryLog = [] }) {
  const objectByPath = new Map();
  for (const object of objects) {
    if (typeof object.name !== 'string' || !object.name) continue;
    const rows = objectByPath.get(object.name) || [];
    rows.push(object);
    objectByPath.set(object.name, rows);
  }

  const legacyRecords = [];
  let ignoredSupabaseRecords = 0;
  let ignoredWithoutStorageReference = 0;
  for (const record of metadataRecords) {
    const data = record.data || {};
    if (data.storageProvider === 'supabase') {
      ignoredSupabaseRecords += 1;
      continue;
    }
    const storagePath = typeof data.storagePath === 'string' ? data.storagePath.trim() : '';
    const downloadUrl = typeof data.downloadUrl === 'string' ? data.downloadUrl.trim() : '';
    if (!storagePath && !downloadUrl) {
      ignoredWithoutStorageReference += 1;
      continue;
    }

    const pathResult = storagePath
      ? normalizeLegacyStorageReference(storagePath, bucket)
      : { status: 'empty' };
    const urlResult = downloadUrl
      ? normalizeLegacyStorageReference(downloadUrl, bucket)
      : { status: 'empty' };
    const issues = [];
    let objectPath = null;

    if (pathResult.status === 'resolved') objectPath = pathResult.path;
    else if (pathResult.status !== 'empty') issues.push(pathResult.status.toUpperCase());

    if (urlResult.status === 'resolved') {
      if (objectPath && objectPath !== urlResult.path) issues.push('STORAGE_PATH_URL_MISMATCH');
      else if (!objectPath) objectPath = urlResult.path;
    } else if (urlResult.status !== 'empty') {
      if (!objectPath) issues.push(urlResult.status.toUpperCase());
      else issues.push('DOWNLOAD_URL_' + urlResult.status.toUpperCase());
    }

    const pathOrganizationMatch = objectPath
      ? /^organizations\/([^/]+)\//.exec(objectPath)
      : null;
    if (pathOrganizationMatch && typeof data.organizationId === 'string'
        && pathOrganizationMatch[1] !== data.organizationId) {
      issues.push('PATH_ORGANIZATION_MISMATCH');
    }

    if (!objectPath) {
      if (!issues.length) issues.push('UNRESOLVED_STORAGE_REFERENCE');
      legacyRecords.push({
        collection: record.collection,
        documentId: record.id,
        organizationId: printable(data.organizationId),
        objectPath: null,
        fileName: printable(data.originalFileName) || printable(data.name),
        declaredSize: Number.isFinite(Number(data.size)) ? Number(data.size) : null,
        declaredContentType: printable(data.contentType),
        status: 'needs_review',
        issues: [...new Set(issues)],
      });
      continue;
    }

    const bucketObjects = objectByPath.get(objectPath) || [];
    const object = bucketObjects.length ? bucketObjects[0] : null;
    if (!object) issues.push('OBJECT_NOT_FOUND');
    if (bucketObjects.length > 1) issues.push('DUPLICATE_BUCKET_LISTING');

    const declaredSize = data.size === undefined || data.size === null || data.size === ''
      ? null : Number(data.size);
    const actualSize = object?.size === undefined || object?.size === null ? null : Number(object.size);
    if (declaredSize !== null && !Number.isFinite(declaredSize)) issues.push('INVALID_DECLARED_SIZE');
    else if (object && declaredSize !== null && actualSize !== null && declaredSize !== actualSize) {
      issues.push('SIZE_MISMATCH');
    }

    const expectedMd5 = checksumCandidate(data);
    if (object && expectedMd5 && object.md5Hash && expectedMd5.value !== object.md5Hash) {
      issues.push('MD5_MISMATCH');
    }

    legacyRecords.push({
      collection: record.collection,
      documentId: record.id,
      organizationId: printable(data.organizationId),
      objectPath,
      bucket,
      fileName: printable(data.originalFileName) || printable(data.name) || object?.name?.split('/').pop() || null,
      declaredSize,
      actualSize,
      declaredContentType: printable(data.contentType),
      actualContentType: printable(object?.contentType),
      actualMd5Hash: printable(object?.md5Hash),
      actualCrc32c: printable(object?.crc32c),
      createdAt: printable(data.createdAt),
      objectUpdatedAt: printable(object?.updated),
      status: issues.length ? 'needs_review' : 'matched',
      issues: [...new Set(issues)],
    });
  }

  const referencesByPath = new Map();
  for (const record of legacyRecords) {
    if (!record.objectPath) continue;
    const rows = referencesByPath.get(record.objectPath) || [];
    rows.push(record);
    referencesByPath.set(record.objectPath, rows);
  }
  for (const rows of referencesByPath.values()) {
    if (rows.length > 1) {
      for (const row of rows) {
        if (!row.issues.includes('DUPLICATE_METADATA_REFERENCE')) row.issues.push('DUPLICATE_METADATA_REFERENCE');
        row.status = 'needs_review';
      }
    }
  }

  const unreferencedObjects = objects
    .filter(object => !referencesByPath.has(object.name))
    .map(object => ({
      objectPath: object.name,
      size: object.size === undefined ? null : Number(object.size),
      contentType: printable(object.contentType),
      md5Hash: printable(object.md5Hash),
      crc32c: printable(object.crc32c),
      created: printable(object.created),
      updated: printable(object.updated),
      status: 'unreferenced_object',
      issue: 'NO_LEGACY_METADATA_REFERENCE',
    }));

  const summary = {
    collectionsScanned: collections.length,
    collectionNames: collections,
    metadataRecordsScanned: metadataRecords.length,
    legacyMetadataRecords: legacyRecords.length,
    ignoredSupabaseRecords,
    ignoredWithoutStorageReference,
    bucketObjectsScanned: objects.length,
    matchedMetadataRecords: legacyRecords.filter(item => item.status === 'matched').length,
    metadataRecordsNeedingReview: legacyRecords.filter(item => item.status === 'needs_review').length,
    missingObjects: legacyRecords.filter(item => item.issues.includes('OBJECT_NOT_FOUND')).length,
    sizeMismatches: legacyRecords.filter(item => item.issues.includes('SIZE_MISMATCH')).length,
    md5Mismatches: legacyRecords.filter(item => item.issues.includes('MD5_MISMATCH')).length,
    duplicateMetadataPaths: legacyRecords.filter(item => item.issues.includes('DUPLICATE_METADATA_REFERENCE')).length,
    unreferencedBucketObjects: unreferencedObjects.length,
    unresolvedMetadataReferences: legacyRecords.filter(item => !item.objectPath).length,
    retryEvents: retryLog.length,
  };

  return {
    schemaVersion: 1,
    generatedAt,
    projectId,
    bucket,
    mode: 'read-only-dry-run',
    noCloudChangesMade: true,
    checksumNote: 'MD5/CRC32C are provider-listed object metadata. This report does not download bytes or compute a new cryptographic checksum.',
    summary,
    metadataRecords: legacyRecords,
    unreferencedObjects,
    retryLog,
  };
}
