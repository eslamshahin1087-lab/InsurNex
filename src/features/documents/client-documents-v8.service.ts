import { addDoc, collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, where } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import type { DocumentCategory, DocumentRecord } from '../../types/document';
import { supabaseDocumentStorage } from '../storage/supabase-storage.provider';
import type { StoredObject } from '../storage/storage-provider';

export const CLIENT_DOCUMENT_MAX_SIZE = 10 * 1024 * 1024;

export async function listClientDocuments(organizationId: string, clientId: string): Promise<DocumentRecord[]> {
  const snapshot = await getDocs(query(
    collection(db, 'documents'),
    where('organizationId', '==', organizationId),
    limit(300),
  ));

  return snapshot.docs
    .map(item => ({ id: item.id, ...item.data() } as DocumentRecord))
    .filter(item => item.relatedType === 'client' && item.relatedId === clientId);
}

export async function uploadClientDocumentV8(input: {
  organizationId: string;
  clientId: string;
  userId: string;
  name: string;
  category: DocumentCategory;
  notes: string;
  file: File;
}) {
  supabaseDocumentStorage.validate(input.file);
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== input.userId) throw new Error('AUTH_REQUIRED');
  const firebaseToken = await currentUser.getIdToken();

  let stored: StoredObject | null = null;
  try {
    stored = await supabaseDocumentStorage.upload(input.file, {
      organizationId: input.organizationId,
      clientId: input.clientId,
      userToken: firebaseToken,
      area: 'onboarding',
    });

    const metadata = await addDoc(collection(db, 'documents'), {
      organizationId: input.organizationId,
      name: input.name.trim() || input.file.name,
      category: input.category,
      originalFileName: input.file.name,
      contentType: input.file.type,
      size: input.file.size,
      storagePath: stored.path,
      storageProvider: stored.provider,
      storageBucket: stored.bucket,
      downloadUrl: '',
      relatedType: 'client',
      relatedId: input.clientId,
      uploadedBy: input.userId,
      notes: input.notes.trim(),
      createdAt: serverTimestamp(),
    });
    return metadata.id;
  } catch (error) {
    if (stored) await supabaseDocumentStorage.remove(stored, firebaseToken, input.organizationId).catch(() => undefined);
    throw error;
  }
}

export async function getClientDocumentUrl(record: DocumentRecord, organizationId: string) {
  if (record.storageProvider === 'supabase' && record.storagePath) {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('AUTH_REQUIRED');
    const firebaseToken = await currentUser.getIdToken();
    return supabaseDocumentStorage.getTemporaryUrl({
      provider: 'supabase',
      bucket: record.storageBucket || 'insurnex-documents',
      path: record.storagePath,
      originalFileName: record.originalFileName,
      contentType: record.contentType,
      size: record.size,
    }, firebaseToken, organizationId);
  }
  if (record.downloadUrl) return record.downloadUrl;
  throw new Error('DOCUMENT_URL_UNAVAILABLE');
}

export async function deleteClientDocumentV8(record: DocumentRecord, organizationId: string) {
  if (record.storageProvider === 'supabase' && record.storagePath) {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('AUTH_REQUIRED');
    const firebaseToken = await currentUser.getIdToken();
    await supabaseDocumentStorage.remove({
      provider: 'supabase',
      bucket: record.storageBucket || 'insurnex-documents',
      path: record.storagePath,
      originalFileName: record.originalFileName,
      contentType: record.contentType,
      size: record.size,
    }, firebaseToken, organizationId);
  }
  await deleteDoc(doc(db, 'documents', record.id));
}


