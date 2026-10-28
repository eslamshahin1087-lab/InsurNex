const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,128}$/;
const ALLOWED_AREAS = new Set(['onboarding', 'quotation', 'issuance', 'policy', 'claim', 'renewal']);

export function parseDocumentPath(path, organizationId) {
  if (typeof path !== 'string' || typeof organizationId !== 'string' || !SAFE_SEGMENT.test(organizationId)) return null;
  const match = /^organizations\/([A-Za-z0-9_-]{1,128})\/clients\/([A-Za-z0-9_-]{1,128})\/([A-Za-z0-9_-]{1,64})\/([A-Za-z0-9._-]{1,220})$/.exec(path);
  if (!match || match[1] !== organizationId || !ALLOWED_AREAS.has(match[3])) return null;
  if (match[4] === '.' || match[4] === '..') return null;
  return { organizationId: match[1], clientId: match[2], area: match[3], path };
}

export function areaForCategory(category) {
  if (category === 'claim') return 'claim';
  if (category === 'policy') return 'policy';
  if (category === 'proposal') return 'quotation';
  return 'onboarding';
}

/** Bind a storage path to the exact Firestore document record that authorized it. */
export function metadataMatchesPath(metadata, request) {
  if (!metadata || !request) return false;
  if (metadata.organizationId !== request.organizationId) return false;
  if (metadata.storagePath !== request.path) return false;
  if (metadata.storageProvider !== 'supabase') return false;
  if (metadata.relatedType !== 'client' || metadata.relatedId !== request.clientId) return false;
  if (areaForCategory(metadata.category) !== request.area) return false;
  if (request.contentType && metadata.contentType !== request.contentType) return false;
  if (typeof request.size === 'number' && metadata.size !== request.size) return false;
  return true;
}

export function roleCanAccessDocument(role, category, area, action) {
  if (!['onboarding', 'quotation', 'issuance', 'policy', 'claim', 'renewal'].includes(area)) return false;
  if (area !== areaForCategory(category)) return false;
  if (['owner', 'admin', 'broker'].includes(role)) return ['read', 'write', 'delete'].includes(action);
  if (role === 'claims') return category === 'claim' && area === 'claim' && action !== 'delete' && ['read', 'write'].includes(action);
  return false;
}
