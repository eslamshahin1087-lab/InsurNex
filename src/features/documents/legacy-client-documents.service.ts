import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import type { DocumentCategory } from '../../types/document';
import { getLegacyClientDocumentTemporaryUrl } from '../storage/supabase-storage.provider';

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const DOCUMENT_CATEGORIES = new Set<DocumentCategory>([
  'policy', 'claim', 'client', 'identity', 'proposal', 'correspondence',
  'invoice', 'receipt', 'other',
]);

export type LegacyClientDocumentReference = {
  id: string;
  clientId: string;
  label: string;
  fileName: string;
  category: DocumentCategory;
  contentType: string;
  size: number | null;
  uploadedAt?: unknown;
  verified: boolean;
  source: 'embedded-legacy';
};

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asSize(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function inferCategory(item: Record<string, unknown>): DocumentCategory {
  const explicit = asText(item.category).toLowerCase();
  if (DOCUMENT_CATEGORIES.has(explicit as DocumentCategory)) return explicit as DocumentCategory;
  const oldType = asText(item.type).toLowerCase();
  if (oldType === 'claim') return 'claim';
  if (oldType === 'policy') return 'policy';
  if (oldType === 'proposal' || oldType === 'quotation') return 'proposal';
  if (['national-id', 'signatory-id', 'tax-card', 'commercial-register', 'license', 'identity'].includes(oldType)) {
    return 'identity';
  }
  return 'client';
}

function pointsToConfiguredSupabaseStorage(item: Record<string, unknown>): boolean {
  const provider = asText(item.storageProvider).toLowerCase();
  if (provider === 'firebase') return false;
  if (provider === 'supabase') return true;

  const rawUrl = asText(item.url) || asText(item.downloadUrl);
  const configuredUrl = asText(import.meta.env.VITE_SUPABASE_URL);
  if (!rawUrl || !configuredUrl) return false;

  try {
    const reference = new URL(rawUrl);
    const configured = new URL(configuredUrl);
    return reference.origin === configured.origin
      && /^\/storage\/v1\/object\/(sign|public|authenticated)\//.test(reference.pathname);
  } catch {
    return false;
  }
}

/**
 * Reads old embedded file references without returning their signed URLs.
 * The current user's active profile and client tenant are checked before
 * display metadata is exposed.
 */
export async function listLegacyClientDocuments(
  organizationId: string,
  clientId: string,
): Promise<LegacyClientDocumentReference[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('AUTH_REQUIRED');
  if (!SAFE_ID.test(organizationId) || !SAFE_ID.test(clientId)) {
    throw new Error('INVALID_LEGACY_CLIENT_DOCUMENT_CONTEXT');
  }

  const profileSnapshot = await getDoc(doc(db, 'users', currentUser.uid));
  if (!profileSnapshot.exists()) throw new Error('ACTIVE_PROFILE_REQUIRED');
  const profile = profileSnapshot.data();
  if (profile.status !== 'active' || profile.organizationId !== organizationId) {
    throw new Error('ORGANIZATION_ACCESS_DENIED');
  }

  const role = String(profile.role || '');
  if (!['owner', 'admin', 'broker', 'claims'].includes(role)) return [];

  const clientSnapshot = await getDoc(doc(db, 'clients', clientId));
  if (!clientSnapshot.exists()) return [];
  const client = clientSnapshot.data();
  if (client.organizationId !== organizationId) throw new Error('CLIENT_ACCESS_DENIED');

  const embeddedDocuments = Array.isArray(client.documents) ? client.documents : [];
  return embeddedDocuments.flatMap((value): LegacyClientDocumentReference[] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>;
    const id = asText(item.id);
    if (!SAFE_ID.test(id) || !pointsToConfiguredSupabaseStorage(item)) return [];

    const category = inferCategory(item);
    if (role === 'claims' && category !== 'claim') return [];

    const fileName = asText(item.originalFileName) || asText(item.fileName) || asText(item.label) || 'مستند قديم';
    const label = asText(item.label) || fileName;
    const contentType = asText(item.contentType) || asText(item.mimeType) || 'application/octet-stream';

    return [{
      id,
      clientId,
      label,
      fileName,
      category,
      contentType,
      size: asSize(item.size),
      uploadedAt: item.uploadedAt,
      verified: item.verified === true,
      source: 'embedded-legacy',
    }];
  });
}

/** Requests a fresh signed URL from the gateway; never navigates to a stored legacy URL. */
export async function getLegacyClientDocumentUrl(
  reference: LegacyClientDocumentReference,
  organizationId: string,
): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('AUTH_REQUIRED');
  const result = await getLegacyClientDocumentTemporaryUrl({
    organizationId,
    clientId: reference.clientId,
    documentId: reference.id,
    userToken: await currentUser.getIdToken(),
  });
  return result.signedUrl;
}
