import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { supabaseDocumentStorage, uploadOperationsAttachment } from '../storage/supabase-storage.provider';
import type { StoredObject } from '../storage/storage-provider';

export function validateOperationFile(file: File) {
  if (!/[.](pdf|xls|xlsx|csv)$/i.test(file.name)) throw new Error('UNSUPPORTED_FILE');
  if (file.size <= 0) throw new Error('EMPTY_FILE');
  if (file.size > 20 * 1024 * 1024) throw new Error('FILE_TOO_LARGE');
}

export type OperationAttachmentRecord = {
  id: string;
  organizationId: string;
  operationId: string;
  name: string;
  contentType: string;
  size: number;
  storagePath: string;
  storageProvider?: string;
  storageBucket?: string;
  downloadUrl?: string;
  uploadedBy: string;
};

export async function uploadOperationAttachments(
  files: File[],
  organizationId: string,
  operationId: string,
  uid: string,
) {
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new Error('AUTH_REQUIRED');
  const userToken = await user.getIdToken();
  const createdIds: string[] = [];

  for (const file of files) {
    validateOperationFile(file);
    let stored: StoredObject | null = null;
    try {
      stored = await uploadOperationsAttachment(file, {
        organizationId,
        operationId,
        userId: uid,
        userToken,
      });
      const record = await addDoc(collection(db, 'operationAttachments'), {
        organizationId,
        operationId,
        name: file.name,
        originalFileName: stored.originalFileName,
        contentType: stored.contentType,
        size: stored.size,
        storagePath: stored.path,
        storageProvider: stored.provider,
        storageBucket: stored.bucket,
        downloadUrl: '',
        uploadedBy: uid,
        createdAt: serverTimestamp(),
      });
      createdIds.push(record.id);
    } catch (error) {
      if (stored) {
        await supabaseDocumentStorage.remove(stored, userToken, organizationId).catch(() => undefined);
      }
      throw error;
    }
  }
  return createdIds;
}

export async function getOperationAttachmentUrl(
  record: OperationAttachmentRecord,
  organizationId: string,
) {
  if (record.organizationId !== organizationId) throw new Error('ORGANIZATION_MISMATCH');
  if (record.storageProvider === 'supabase' && record.storagePath) {
    const user = auth.currentUser;
    if (!user) throw new Error('AUTH_REQUIRED');
    const userToken = await user.getIdToken();
    return supabaseDocumentStorage.getTemporaryUrl({
      provider: 'supabase',
      bucket: record.storageBucket || 'insurnex-documents',
      path: record.storagePath,
      originalFileName: record.name,
      contentType: record.contentType,
      size: record.size,
    }, userToken, organizationId);
  }
  if (record.downloadUrl) return record.downloadUrl;
  throw new Error('ATTACHMENT_URL_UNAVAILABLE');
}
