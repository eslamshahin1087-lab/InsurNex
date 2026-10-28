const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,128}$/;
const ALLOWED_AREAS = new Set(['onboarding', 'quotation', 'issuance', 'policy', 'claim', 'renewal']);
const ALLOWED_RELATIONS = new Set(['general', 'client', 'policy', 'claim']);

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
    if (!request.filename.startsWith(request.documentId + '-')) return false;
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
      && ['client', 'general'].includes(layout);
  }
  return false;
}
