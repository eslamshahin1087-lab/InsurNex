import {
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { supabaseDocumentStorage } from '../storage/supabase-storage.provider';
import type { StoredObject, UploadContext } from '../storage/storage-provider';
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
  const uploaded: { stored: StoredObject; pending: PendingClientDocument; metadataId: string }[] = [];
  const metadataIds: string[] = [];

  try {
    for (let index = 0; index < input.documents.length; index += 1) {
      const pending = input.documents[index];
      input.onProgress?.(`تجهيز المستند ${index + 1} من ${input.documents.length}...`);

      const metadataRef = doc(collection(db, 'documents'));
      const context: UploadContext = {
        organizationId: input.organizationId,
        clientId: input.clientId,
        documentId: metadataRef.id,
        userToken: input.firebaseToken,
        area: 'onboarding',
      };
      const path = supabaseDocumentStorage.buildPath(pending.file, context);
      const stored: StoredObject = {
        provider: 'supabase',
        bucket: supabaseDocumentStorage.bucket,
        path,
        documentId: metadataRef.id,
        originalFileName: pending.file.name,
        contentType: pending.file.type,
        size: pending.file.size,
      };

      // Metadata must exist before the gateway can issue a signed upload token.
      await setDoc(metadataRef, {
        organizationId: input.organizationId,
        name: pending.name.trim() || pending.file.name,
        category: pending.category as DocumentCategory,
        originalFileName: stored.originalFileName,
        contentType: stored.contentType,
        size: stored.size,
        storagePath: stored.path,
        storageProvider: stored.provider,
        storageBucket: stored.bucket,
        downloadUrl: '',
        relatedType: 'client',
        relatedId: input.clientId,
        uploadedBy: input.userId,
        notes: pending.notes?.trim() || '',
        createdAt: serverTimestamp(),
      });
      metadataIds.push(metadataRef.id);

      input.onProgress?.(`رفع المستند ${index + 1} من ${input.documents.length}...`);
      try {
        await supabaseDocumentStorage.upload(pending.file, context);
        uploaded.push({ stored, pending, metadataId: metadataRef.id });
      } catch (error) {
        // Include it in cleanup in case the object was created before the client
        // received an error response.
        uploaded.push({ stored, pending, metadataId: metadataRef.id });
        throw error;
      }
    }

    input.onProgress?.('اكتمل رفع وربط المستندات بملف العميل.');
    return { uploaded, metadataIds };
  } catch (error) {
    await Promise.allSettled(
      uploaded.map(item =>
        supabaseDocumentStorage.remove(item.stored, input.firebaseToken, input.organizationId),
      ),
    );
    await Promise.allSettled(metadataIds.map(id => deleteDoc(doc(db, 'documents', id))));
    throw error;
  }
}
