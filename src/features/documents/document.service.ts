import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref } from 'firebase/storage';
import { auth, db, storage } from '../../firebase/config';
import { supabaseDocumentStorage, uploadOrganizationDocument } from '../storage/supabase-storage.provider';
import type { DocumentCategory, DocumentRecord, DocumentRelationType } from '../../types/document';
import type { StoredObject } from '../storage/storage-provider';

const MAX = 10 * 1024 * 1024;
const allowed = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export function validateDocumentFile(file: File) {
  if (file.size <= 0) throw new Error('EMPTY_FILE');
  if (file.size > MAX) throw new Error('FILE_TOO_LARGE');
  if (!allowed.has(file.type)) throw new Error('FILE_TYPE_NOT_ALLOWED');
}

export async function uploadDocument(input: {
  organizationId: string;
  userId: string;
  name: string;
  category: DocumentCategory;
  relatedType: DocumentRelationType;
  relatedId: string;
  notes: string;
  file: File;
}) {
  validateDocumentFile(input.file);
  const user = auth.currentUser;
  if (!user || user.uid !== input.userId) throw new Error('AUTH_REQUIRED');

  const documentRef = doc(collection(db, 'documents'));
  const userToken = await user.getIdToken();
  let stored: StoredObject | null = null;
  try {
    stored = await uploadOrganizationDocument(input.file, {
      organizationId: input.organizationId,
      documentId: documentRef.id,
      userId: input.userId,
      userToken,
      relatedType: input.relatedType,
      relatedId: input.relatedType === 'general' ? '' : input.relatedId,
    });
    await setDoc(documentRef, {
      organizationId: input.organizationId,
      name: input.name.trim() || input.file.name,
      category: input.category,
      originalFileName: stored.originalFileName,
      contentType: stored.contentType,
      size: stored.size,
      storagePath: stored.path,
      storageProvider: stored.provider,
      storageBucket: stored.bucket,
      downloadUrl: '',
      relatedType: input.relatedType,
      relatedId: input.relatedType === 'general' ? '' : input.relatedId,
      uploadedBy: input.userId,
      notes: input.notes.trim(),
      createdAt: serverTimestamp(),
    });
    return documentRef.id;
  } catch (error) {
    if (stored) {
      await supabaseDocumentStorage.remove(stored, userToken, input.organizationId).catch(() => undefined);
    }
    await deleteDoc(documentRef).catch(() => undefined);
    throw error;
  }
}

export async function listDocuments(organizationId: string): Promise<DocumentRecord[]> {
  const snapshot = await getDocs(query(
    collection(db, 'documents'),
    where('organizationId', '==', organizationId),
    limit(300),
  ));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() } as DocumentRecord));
}

export async function getDocumentDownloadUrl(record: DocumentRecord): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('AUTH_REQUIRED');

  if (record.storageProvider === 'supabase' && record.storagePath) {
    const userToken = await user.getIdToken();
    return supabaseDocumentStorage.getTemporaryUrl({
      provider: 'supabase',
      bucket: record.storageBucket || 'insurnex-documents',
      path: record.storagePath,
      originalFileName: record.originalFileName,
      contentType: record.contentType,
      size: record.size,
    }, userToken, record.organizationId);
  }

  // Legacy Firebase Storage objects are never migrated or deleted by this path.
  // They may work on Blaze; on Spark Firebase can reject the download request.
  if (record.downloadUrl) return record.downloadUrl;
  if (record.storagePath && record.storageProvider === 'firebase') {
    return getDownloadURL(ref(storage, record.storagePath));
  }
  throw new Error('DOCUMENT_STORAGE_NOT_AVAILABLE');
}

export async function deleteDocumentRecord(record: DocumentRecord) {
  const user = auth.currentUser;
  if (!user) throw new Error('AUTH_REQUIRED');
  const userToken = await user.getIdToken();

  if (record.storagePath && record.storageProvider === 'supabase') {
    await supabaseDocumentStorage.remove({
      provider: 'supabase',
      bucket: record.storageBucket || 'insurnex-documents',
      path: record.storagePath,
      originalFileName: record.originalFileName,
      contentType: record.contentType,
      size: record.size,
    }, userToken, record.organizationId);
  } else if (record.storagePath) {
    // Attempt legacy Firebase removal before removing metadata. If Firebase
    // Storage is unavailable on Spark, this throws and the Firestore record is
    // preserved for later recovery rather than orphaning an inaccessible file.
    await deleteObject(ref(storage, record.storagePath));
  }
  await deleteDoc(doc(db, 'documents', record.id));
}
