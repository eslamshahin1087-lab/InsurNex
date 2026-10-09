export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const OPERATION_MAX_BYTES = 20 * 1024 * 1024;

export const DOCUMENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export const OPERATION_TYPES = new Set([
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'application/csv',
]);

const UPLOAD_ROLES = new Set([
  'owner', 'admin', 'organizationOwner', 'organizationAdmin',
  'manager', 'broker', 'operations', 'claimsOfficer', 'customerSupport', 'finance',
]);
const MANAGER_ROLES = new Set([
  'owner', 'admin', 'organizationOwner', 'organizationAdmin', 'manager', 'operations',
]);
const CLIENT_AREAS = new Set(['onboarding', 'quotation', 'issuance', 'policy', 'claim', 'renewal']);

function safeSegment(value) {
  return typeof value === 'string'
    && value.length > 0
    && value !== '.'
    && value !== '..'
    && !value.includes('\\')
    && !/%2f|%5c/i.test(value);
}

export function classifyStoragePath(path, organizationId, uid) {
  if (typeof path !== 'string' || !path || path.startsWith('/') || path.endsWith('/')
    || path.includes('\\') || /%2f|%5c/i.test(path)) return null;
  const parts = path.split('/');
  if (parts.some((part) => !safeSegment(part))) return null;
  if (parts[0] !== 'organizations' || parts[1] !== organizationId) return null;

  // New uploads include the uploading UID in the path to permit safe cleanup
  // even if the metadata-document write fails after the object upload.
  if (parts[2] === 'clients' && parts.length === 7
    && safeSegment(parts[3]) && CLIENT_AREAS.has(parts[4])
    && safeSegment(parts[5]) && safeSegment(parts[6])) {
    return {
      kind: 'document',
      organizationId,
      resourceId: parts[3],
      area: parts[4],
      uploaderId: parts[5],
      fileName: parts[6],
      legacy: false,
      collectionName: 'documents',
    };
  }

  // Existing client-document paths remain readable/deletable by metadata
  // lookup; they are not accepted for new uploads or metadata-free cleanup.
  if (parts[2] === 'clients' && parts.length === 6
    && safeSegment(parts[3]) && CLIENT_AREAS.has(parts[4]) && safeSegment(parts[5])) {
    return {
      kind: 'document',
      organizationId,
      resourceId: parts[3],
      area: parts[4],
      uploaderId: null,
      fileName: parts[5],
      legacy: true,
      collectionName: 'documents',
    };
  }

  if (parts[2] === 'operations' && parts.length === 6
    && safeSegment(parts[3]) && safeSegment(parts[4]) && safeSegment(parts[5])) {
    return {
      kind: 'operation',
      organizationId,
      resourceId: parts[3],
      uploaderId: parts[4],
      fileName: parts[5],
      legacy: false,
      collectionName: 'operationAttachments',
    };
  }

  // Historical Supabase operation paths, if any, are only usable when a
  // Firestore attachment record proves ownership and organization linkage.
  if (parts[2] === 'operations' && parts.length === 5
    && safeSegment(parts[3]) && safeSegment(parts[4])) {
    return {
      kind: 'operation',
      organizationId,
      resourceId: parts[3],
      uploaderId: null,
      fileName: parts[4],
      legacy: true,
      collectionName: 'operationAttachments',
    };
  }

  return null;
}

export function authorizeUpload({ role, pathInfo, uid, size, contentType }) {
  if (!pathInfo || pathInfo.legacy || !UPLOAD_ROLES.has(role)
    || pathInfo.uploaderId !== uid) return false;
  if (pathInfo.kind === 'document') {
    return Number.isFinite(size) && size > 0 && size <= DOCUMENT_MAX_BYTES
      && DOCUMENT_TYPES.has(contentType);
  }
  if (pathInfo.kind === 'operation') {
    return Number.isFinite(size) && size > 0 && size <= OPERATION_MAX_BYTES
      && OPERATION_TYPES.has(contentType);
  }
  return false;
}

export function canManageStorage(role) {
  return MANAGER_ROLES.has(role);
}

export function authorizeRecordAction({ action, organizationId, path, pathInfo, role, uid, record }) {
  if (!pathInfo || (!UPLOAD_ROLES.has(role) && role !== 'viewer')) return false;
  const recordMatchesPath = Boolean(record
    && record.organizationId === organizationId
    && record.storagePath === path
    && (!pathInfo.uploaderId || record.uploadedBy === pathInfo.uploaderId)
    && (!record.storageProvider || record.storageProvider === 'supabase'));
  if (action === 'sign-download') {
    return recordMatchesPath;
  }
  if (action === 'delete') {
    if (recordMatchesPath) {
      // For UID-scoped paths, ownership is verifiable from both path and
      // immutable uploadedBy metadata. Legacy paths can only be deleted by
      // file managers because their path cannot prove uploader identity.
      if (!pathInfo.legacy && pathInfo.uploaderId === uid && record.uploadedBy === uid) return true;
      if (canManageStorage(role)) return true;
      return false;
    }
    // Cleanup of an upload that failed before its Firestore metadata write:
    // only the original uploader can delete a new UID-scoped object.
    return !record && pathInfo.uploaderId === uid && UPLOAD_ROLES.has(role) && !pathInfo.legacy;
  }
  return false;
}

export function resolveUniqueAttachmentRecord(records, organizationId, path, uploaderId = null) {
  const matching = records.filter((record) =>
    record
    && record.organizationId === organizationId
    && record.storagePath === path
    && (!record.storageProvider || record.storageProvider === 'supabase')
  );
  if (matching.length !== 1) return null;
  const record = matching[0];
  if (uploaderId && record.uploadedBy !== uploaderId) return null;
  return record;
}

export function parentRecordPath(pathInfo) {
  if (!pathInfo) return null;
  return pathInfo.kind === 'document'
    ? { collectionName: 'clients', documentId: pathInfo.resourceId }
    : { collectionName: 'operations', documentId: pathInfo.resourceId };
}

export function roleCanUpload(role) {
  return UPLOAD_ROLES.has(role);
}
