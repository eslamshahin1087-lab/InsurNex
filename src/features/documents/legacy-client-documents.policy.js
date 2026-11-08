export const LEGACY_CLIENT_DOCUMENT_READ_ROLES = Object.freeze([
  'owner',
  'admin',
  'broker',
]);

/**
 * Legacy embedded document references are stored inside the mixed-sensitivity
 * clients/{clientId} document. Keep this role gate identical to Firestore's
 * legacy client read rule; Claims uses claim-related documents metadata instead.
 */
export function canReadLegacyClientDocumentReferences(role) {
  return LEGACY_CLIENT_DOCUMENT_READ_ROLES.includes(role);
}
