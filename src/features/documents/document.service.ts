import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import type {
  DocumentCategory,
  DocumentRecord,
  DocumentRelationType,
} from '../../types/document';
import { supabaseDocumentStorage } from '../storage/supabase-storage.provider';
import type { StoredObject, UploadContext } from '../storage/storage-provider';

export function validateDocumentFile(file: File) {
  supabaseDocumentStorage.validate(file);
}

function asStoredObject(record: DocumentRecord): StoredObject {
  if (!record.storagePath || !record.storageProvider || record.storageProvider !== 'supabase') {
    throw new Error('LEGACY_DOCUMENT_REQUIRES_MIGRATION');
  }
  return {
    provider: 'supabase',
    bucket: record.storageBucket || supabaseDocumentStorage.bucket,
    path: record.storagePath,
    documentId: record.id,
    originalFileName: record.originalFileName,
    contentType: record.contentType,
    size: record.size,
  };
}

async function requireActiveProfile(organizationId: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('AUTH_REQUIRED');
  const snapshot = await getDoc(doc(db, 'users', user.uid));
  if (!snapshot.exists()) throw new Error('ACTIVE_PROFILE_REQUIRED');
  const profile = snapshot.data();
  if (profile.status !== 'active') throw new Error('ACTIVE_PROFILE_REQUIRED');
  if (profile.organizationId !== organizationId) throw new Error('ORGANIZATION_ACCESS_DENIED');
  return { user, role: String(profile.role || '') };
}

/**
 * New general-document uploads use the private Supabase gateway. Metadata is
 * created first because the gateway only signs a path already bound to an
 * existing, caller-readable Firestore metadata record.
 */
export async function uploadDocument(input: {
  organizationId: string;
  userId: string;
  name: string;
  category: DocumentCategory;
  relatedType: DocumentRelationType;
  relatedId: string;
  notes: string;
  file: File;
  expiryDate?: string;
  issuedDate?: string;
  issuedBy?: string;
  description?: string;
  tags?: string[];
}): Promise<string> {
  validateDocumentFile(input.file);
  const { user, role } = await requireActiveProfile(input.organizationId);
  if (user.uid !== input.userId) throw new Error('AUTH_REQUIRED');

  if (input.relatedType !== 'general' && !/^[A-Za-z0-9_-]{1,128}$/.test(input.relatedId)) {
    throw new Error('INVALID_DOCUMENT_RELATION');
  }
  if (input.relatedType === 'general' && !['owner', 'admin', 'broker'].includes(role)) {
    throw new Error('GENERAL_DOCUMENT_ACCESS_DENIED');
  }
  if (role === 'claims' && (input.category !== 'claim' || input.relatedType === 'general')) {
    throw new Error('DOCUMENT_ROLE_ACCESS_DENIED');
  }
  if (!['owner', 'admin', 'broker', 'claims'].includes(role)) {
    throw new Error('DOCUMENT_ROLE_ACCESS_DENIED');
  }

  const metadataRef = doc(collection(db, 'documents'));
  const firebaseToken = await user.getIdToken();
  const context: UploadContext = {
    organizationId: input.organizationId,
    documentId: metadataRef.id,
    userToken: firebaseToken,
    layout: 'general',
  };
  const path = supabaseDocumentStorage.buildPath(input.file, context);
  const stored: StoredObject = {
    provider: 'supabase',
    bucket: supabaseDocumentStorage.bucket,
    path,
    documentId: metadataRef.id,
    originalFileName: input.file.name,
    contentType: input.file.type,
    size: input.file.size,
  };

  try {
    await setDoc(metadataRef, {
      organizationId: input.organizationId,
      name: input.name.trim() || input.file.name,
      category: input.category,
      originalFileName: input.file.name,
      contentType: input.file.type,
      size: input.file.size,
      storagePath: path,
      storageProvider: stored.provider,
      storageBucket: stored.bucket,
      downloadUrl: '',
      relatedType: input.relatedType,
      relatedId: input.relatedType === 'general' ? '' : input.relatedId,
      uploadedBy: input.userId,
      notes: input.notes.trim(),
      ...(input.expiryDate ? { expiryDate: input.expiryDate } : {}),
      ...(input.issuedDate ? { issuedDate: input.issuedDate } : {}),
      ...(input.issuedBy ? { issuedBy: input.issuedBy.trim() } : {}),
      ...(input.description ? { description: input.description.trim() } : {}),
      ...(input.tags ? { tags: input.tags } : {}),
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await supabaseDocumentStorage.upload(input.file, context);
    return metadataRef.id;
  } catch (error) {
    // Cleanup is best-effort. Keep the original failure visible to the caller.
    await supabaseDocumentStorage.remove(stored, firebaseToken, input.organizationId).catch(() => undefined);
    await deleteDoc(metadataRef).catch(() => undefined);
    throw error;
  }
}

export async function listDocuments(org: string): Promise<DocumentRecord[]> {
  const { role } = await requireActiveProfile(org);
  if (!['owner', 'admin', 'broker', 'claims'].includes(role)) return [];

  const constraints = [
    where('organizationId', '==', org),
    ...(role === 'claims' ? [where('category', '==', 'claim')] : []),
    limit(300),
  ];
  const snapshot = await getDocs(query(collection(db, 'documents'), ...constraints));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() } as DocumentRecord));
}

/** Get a short-lived URL for Supabase objects; old Firebase URLs remain read-only during migration. */
export async function getDocumentTemporaryUrl(record: DocumentRecord): Promise<string> {
  if (record.storageProvider !== 'supabase') {
    if (record.downloadUrl) return record.downloadUrl;
    throw new Error(record.storagePath ? 'LEGACY_DOCUMENT_REQUIRES_MIGRATION' : 'DOCUMENT_URL_UNAVAILABLE');
  }
  const { user } = await requireActiveProfile(record.organizationId);
  const token = await user.getIdToken();
  return supabaseDocumentStorage.getTemporaryUrl(asStoredObject(record), token, record.organizationId);
}

export async function deleteDocumentRecord(record: DocumentRecord): Promise<void> {
  if (record.storageProvider === 'supabase' && record.storagePath) {
    const { user } = await requireActiveProfile(record.organizationId);
    const token = await user.getIdToken();
    await supabaseDocumentStorage.remove(asStoredObject(record), token, record.organizationId);
  } else if (record.storagePath) {
    // Never discard metadata for a legacy Firebase object before a verified migration.
    throw new Error('LEGACY_DOCUMENT_REQUIRES_MIGRATION');
  }
  await deleteDoc(doc(db, 'documents', record.id));
}
