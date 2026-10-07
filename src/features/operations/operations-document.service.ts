import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { supabaseDocumentStorage } from '../storage/supabase-storage.provider';
import type { StoredObject } from '../storage/storage-provider';
import type { DocumentCategory } from '../../types/document';

export type PendingClientDocument = {
  file: File;
  name: string;
  category: 'client' | 'identity' | 'other';
  notes?: string;
};

export function validatePendingClientDocuments(documents: PendingClientDocument[]) {
  for (const item of documents) supabaseDocumentStorage.validate(item.file);
}

export async function uploadClientDocumentsAtomic(input: {
  organizationId: string;
  clientId: string;
  userId: string;
  firebaseToken: string;
  documents: PendingClientDocument[];
  onProgress?: (message: string) => void;
}) {
  const uploaded: { stored: StoredObject; pending: PendingClientDocument }[] = [];
  const metadataIds: string[] = [];
  try {
    for (let index = 0; index < input.documents.length; index += 1) {
      const pending = input.documents[index];
      input.onProgress?.(`رفع المستند ${index + 1} من ${input.documents.length}...`);
      const stored = await supabaseDocumentStorage.upload(pending.file, {
        organizationId: input.organizationId,
        clientId: input.clientId,
        userToken: input.firebaseToken,
        area: 'onboarding',
      });
      uploaded.push({ stored, pending });
    }

    input.onProgress?.('ربط المستندات بملف العميل...');
    for (const item of uploaded) {
      const ref = await addDoc(collection(db, 'documents'), {
        organizationId: input.organizationId,
        name: item.pending.name.trim() || item.pending.file.name,
        category: item.pending.category as DocumentCategory,
        originalFileName: item.stored.originalFileName,
        contentType: item.stored.contentType,
        size: item.stored.size,
        storagePath: item.stored.path,
        storageProvider: item.stored.provider,
        storageBucket: item.stored.bucket,
        downloadUrl: '',
        relatedType: 'client',
        relatedId: input.clientId,
        uploadedBy: input.userId,
        notes: item.pending.notes?.trim() || '',
        createdAt: serverTimestamp(),
      });
      metadataIds.push(ref.id);
    }
    return { uploaded, metadataIds };
  } catch (error) {
    await Promise.allSettled(metadataIds.map(id => deleteDoc(doc(db, 'documents', id))));
    await Promise.allSettled(uploaded.map(item => supabaseDocumentStorage.remove(item.stored, input.firebaseToken, input.organizationId)));
    throw error;
  }
}
