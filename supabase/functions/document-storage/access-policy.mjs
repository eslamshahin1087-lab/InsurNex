const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,128}$/;
const ALLOWED_AREAS = new Set(['onboarding', 'quotation', 'issuance', 'policy', 'claim', 'renewal']);

const ALLOWED_RELATIONS = new Set(['general', 'client', 'policy', 'claim']);

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function parseDocumentPath(path, organizationId) {
  if (typeof path !== 'string' || typeof organizationId !== 'string' || !SAFE_SEGMENT.test(organizationId)) return null;

  const clientMatch = /^organizations\/([A-Za-z0-9_-]{1,128})\/clients\/([A-Za-z0-9_-]{1,128})\/([A-Za-z0-9_-]{1,64})\/([A-Za-z0-9._-]{1,220})$/.exec(path);
  if (clientMatch && clientMatch[1] === organizationId && ALLOWED_AREAS.has(clientMatch[3])
      && clientMatch[4] !== '.' && clientMatch[4] !== '..') {
    return {
      layout: 'client',
      organizationId: clientMatch[1],
      clientId: clientMatch[2],
      area: clientMatch[3],
      path,
      filename: clientMatch[4],
    };
  }

  const generalMatch = /^organizations\/([A-Za-z0-9_-]{1,128})\/documents\/([A-Za-z0-9_-]{1,128})\/([A-Za-z0-9._-]{1,220})$/.exec(path);
  if (generalMatch && generalMatch[1] === organizationId
      && generalMatch[3] !== '.' && generalMatch[3] !== '..') {
    return {
      layout: 'general',
      organizationId: generalMatch[1],
      documentId: generalMatch[2],
      path,
      filename: generalMatch[3],
    };
  }

  return null;
}

export function areaForCategory(category) {
  if (category === 'claim') return 'claim';
  if (category === 'policy') return 'policy';
  if (category === 'proposal') return 'quotation';
  return 'onboarding';
}


/**
 * Resolve a legacy document embedded in clients.documents[] to a safe Supabase
 * Storage key. The signed URL query string is intentionally ignored.
 *
 * This does not authenticate the caller; the Edge Function must first verify
 * the Firebase user, active profile, role and client tenant boundary.
 */
export function parseLegacyClientDocumentReference(reference, request) {
  if (!reference || typeof reference !== 'object' || !request) return null;
  const { organizationId, clientId, expectedBucket, expectedHost } = request;
  if (!SAFE_SEGMENT.test(organizationId || '') || !SAFE_SEGMENT.test(clientId || '')) return null;
  if (reference.storageProvider && reference.storageProvider !== 'supabase') return null;

  const candidates = [];
  if (typeof reference.storagePath === 'string' && reference.storagePath.trim()) {
    candidates.push({
      bucket: typeof reference.storageBucket === 'string' && reference.storageBucket
        ? reference.storageBucket : expectedBucket,
      path: reference.storagePath.trim(),
      source: 'storagePath',
    });
  }

  const rawUrl = [reference.url, reference.downloadUrl]
    .find(value => typeof value === 'string' && value.trim());
  if (rawUrl) {
    let url;
    try {
      url = new URL(rawUrl.trim());
    } catch {
      return null;
    }
    if (!['https:'].includes(url.protocol) || !expectedHost || url.hostname.toLowerCase() !== expectedHost.toLowerCase()) {
      return null;
    }

    const encodedParts = url.pathname.split('/').filter(Boolean);
    if (
      encodedParts[0] !== 'storage' ||
      encodedParts[1] !== 'v1' ||
      encodedParts[2] !== 'object' ||
      !['sign', 'public', 'authenticated'].includes(encodedParts[3]) ||
      encodedParts.length < 6
    ) return null;

    const decodedParts = encodedParts.map(safeDecode);
    if (decodedParts.some(part => !part || part.includes('/') || part.includes('\\'))) return null;
    candidates.push({
      bucket: decodedParts[4],
      path: decodedParts.slice(5).join('/'),
      source: 'url',
    });
  }

  if (!candidates.length) return null;
  const validated = candidates.map(candidate => {
    const pathParts = candidate.path.split('/');
    if (
      candidate.bucket !== expectedBucket ||
      pathParts.length !== 6 ||
      pathParts.some(part => !part || part === '.' || part === '..' || part.includes('\\')) ||
      pathParts[0] !== 'organizations' ||
      pathParts[1] !== organizationId ||
      pathParts[2] !== 'clients' ||
      pathParts[3] !== clientId ||
      !ALLOWED_AREAS.has(pathParts[4]) ||
      !/^[A-Za-z0-9._-]{1,220}$/.test(pathParts[5])
    ) return null;
    return {
      bucket: candidate.bucket,
      path: candidate.path,
      area: pathParts[4],
      filename: pathParts[5],
      source: candidate.source,
    };
  });
  if (validated.some(item => !item)) return null;
  if (validated.length > 1 && (validated[0].bucket !== validated[1].bucket || validated[0].path !== validated[1].path)) {
    return null;
  }
  return validated[0];
}

/**
 * Legacy embedded files are read-only via the compatibility gateway.
 * Delete and migration actions must use a separate audited workflow.
 */
export function roleCanAccessLegacyClientDocument(role, action, category) {
  if (action !== 'read') return false;
  if (['owner', 'admin', 'broker'].includes(role)) return true;
  if (role === 'claims') return String(category || '').toLowerCase() === 'claim';
  return false;
}

/** Bind an object path to exactly one existing Firestore metadata record. */
export function metadataMatchesPath(metadata, request) {
  if (!metadata || !request) return false;
  if (metadata.organizationId !== request.organizationId) return false;
  if (metadata.storagePath !== request.path) return false;
  if (metadata.storageProvider !== 'supabase') return false;
  if (request.bucket && metadata.storageBucket !== request.bucket) return false;
  if (request.actorUid && metadata.uploadedBy !== request.actorUid) return false;
  if (request.contentType && metadata.contentType !== request.contentType) return false;
  if (typeof request.size === 'number' && metadata.size !== request.size) return false;
  if (!ALLOWED_RELATIONS.has(metadata.relatedType)) return false;

  if (request.layout === 'client') {
    if (metadata.relatedType !== 'client' || metadata.relatedId !== request.clientId) return false;
    if (areaForCategory(metadata.category) !== request.area) return false;
    if (typeof request.documentId !== 'string' || !request.documentId) return false;
    // Version 2 paths embed the Firestore metadata ID. Missing version is treated
    // as a legacy object for backwards-compatible reads by privileged roles.
    if (metadata.storageKeyVersion === 2 && !request.filename.startsWith(request.documentId + '-')) return false;
  } else if (request.layout === 'general') {
    if (request.documentId !== request.pathDocumentId) return false;
    if (metadata.relatedType === 'general' && metadata.relatedId !== '') return false;
    if (metadata.relatedType !== 'general' && (!metadata.relatedId || !SAFE_SEGMENT.test(metadata.relatedId))) return false;
  } else {
    return false;
  }

  return true;
}

export function roleCanAccessDocument(role, category, action, options = {}) {
  const { layout = 'client', relatedType = 'client' } = options;
  if (!['read', 'write', 'delete'].includes(action)) return false;

  if (['owner', 'admin', 'broker'].includes(role)) return true;

  // Claims staff may only handle claims-category files that are related to
  // a client or claim, never organization-wide/general, policy, or identity files.
  if (role === 'claims') {
    return category === 'claim'
      && ['client', 'claim'].includes(relatedType)
      && action !== 'delete'
      && ['client', 'general'].includes(layout)
      && (layout !== 'client' || options.documentIdMatchesPath === true);
  }
  return false;
}


const SAFE_OPERATION_SEGMENT = /^[A-Za-z0-9_-]{1,128}$/;

/** Parse an operation attachment path without accepting arbitrary object keys. */
export function parseOperationAttachmentPath(path, organizationId) {
  if (typeof path !== 'string' || typeof organizationId !== 'string'
      || !SAFE_OPERATION_SEGMENT.test(organizationId)) return null;
  const match = /^organizations\/([A-Za-z0-9_-]{1,128})\/operations\/([A-Za-z0-9_-]{1,128})\/([A-Za-z0-9._-]{1,220})$/.exec(path);
  if (!match || match[1] !== organizationId || match[3] === '.' || match[3] === '..') return null;
  return {
    layout: 'operation',
    organizationId: match[1],
    operationId: match[2],
    path,
    filename: match[3],
  };
}

/** Bind an operation attachment key to its exact metadata and parent operation. */
export function operationAttachmentMetadataMatchesPath(metadata, request) {
  if (!metadata || !request) return false;
  if (metadata.organizationId !== request.organizationId
      || metadata.operationId !== request.operationId
      || metadata.storagePath !== request.path
      || metadata.storageProvider !== 'supabase'
      || metadata.storageKeyVersion !== 2) return false;
  if (request.bucket && metadata.storageBucket !== request.bucket) return false;
  if (request.actorUid && metadata.uploadedBy !== request.actorUid) return false;
  if (request.contentType && metadata.contentType !== request.contentType) return false;
  if (typeof request.size === 'number' && metadata.size !== request.size) return false;
  if (typeof metadata.size !== 'number' || !Number.isFinite(metadata.size) || metadata.size <= 0
      || typeof metadata.contentType !== 'string' || !metadata.contentType) return false;
  if (typeof request.attachmentId !== 'string' || !request.attachmentId
      || typeof request.filename !== 'string'
      || !request.filename.startsWith(request.attachmentId + '-')) return false;
  if (metadata.downloadUrl !== '') return false;
  return true;
}

/** Keep attachment deletion stricter than read/upload access. */
export function roleCanAccessOperationAttachment(role, action) {
  if (!['read', 'write', 'delete'].includes(action)) return false;
  if (['owner', 'admin'].includes(role)) return true;
  return ['broker', 'claims'].includes(role) && action !== 'delete';
}
