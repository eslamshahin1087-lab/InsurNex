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
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import {
  buildOperationAttachmentPath,
  getOperationAttachmentTemporaryUrl,
  removeOperationAttachment,
  uploadOperationAttachment,
  type OperationAttachmentStorageObject,
} from '../storage/supabase-storage.provider';

const MAX_OPERATION_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const OPERATION_ATTACHMENT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
};

export type OperationAttachmentRecord = {
  id: string;
  organizationId: string;
  operationId: string;
  name: string;
  contentType: string;
  size: number;
  storagePath?: string;
  storageProvider?: 'supabase' | 'firebase' | string;
  storageBucket?: string;
  storageKeyVersion?: number;
  downloadUrl?: string;
  uploadState?: 'pending' | 'ready' | 'failed' | string;
  uploadedBy: string;
  createdAt?: unknown;
};

export function validateOperationFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!Object.prototype.hasOwnProperty.call(OPERATION_ATTACHMENT_MIME, extension)) {
    throw new Error('UNSUPPORTED_FILE');
  }
  if (file.size <= 0) throw new Error('EMPTY_FILE');
  if (file.size > MAX_OPERATION_ATTACHMENT_SIZE) throw new Error('FILE_TOO_LARGE');
  const expectedMime = OPERATION_ATTACHMENT_MIME[extension];
  if (file.type && file.type !== expectedMime && !(extension === 'csv' && file.type === 'application/csv')) {
    throw new Error('FILE_TYPE_MISMATCH');
  }
  return expectedMime;
}

async function requireOperationProfile(org: string, uid: string) {
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new Error('AUTH_REQUIRED');
  const profile = await getDoc(doc(db, 'users', user.uid));
  if (!profile.exists() || profile.data().status !== 'active') throw new Error('ACTIVE_PROFILE_REQUIRED');
  if (profile.data().organizationId !== org) throw new Error('ORGANIZATION_ACCESS_DENIED');
  if (!['owner', 'admin', 'broker', 'claims'].includes(String(profile.data().role || ''))) {
    throw new Error('OPERATION_ATTACHMENT_ACCESS_DENIED');
  }
  return { user, role: String(profile.data().role || '') };
}

function asStoredObject(record: OperationAttachmentRecord): OperationAttachmentStorageObject {
  if (
    !record.storagePath ||
    record.storageProvider !== 'supabase' ||
    record.storageKeyVersion !== 2 ||
    record.uploadState !== 'ready'
  ) {
    throw new Error('LEGACY_OPERATION_ATTACHMENT_REQUIRES_MIGRATION');
  }
  return {
    provider: 'supabase',
    bucket: record.storageBucket || 'insurnex-documents',
    path: record.storagePath,
    attachmentId: record.id,
    operationId: record.operationId,
    organizationId: record.organizationId,
    originalFileName: record.name,
    contentType: record.contentType,
    size: record.size,
  };
}

/**
 * New operation attachments use metadata-first uploads through the private
 * Supabase gateway. The exact attachment ID, operation ID and path are bound
 * before the gateway will issue a signed upload token.
 */
export async function uploadOperationAttachments(
  files: File[],
  org: string,
  operationId: string,
  uid: string,
): Promise<string[]> {
  const { user } = await requireOperationProfile(org, uid);
  const operationSnapshot = await getDoc(doc(db, 'operations', operationId));
  if (!operationSnapshot.exists() || operationSnapshot.data().organizationId !== org) {
    throw new Error('OPERATION_ACCESS_DENIED');
  }

  const uploadedIds: string[] = [];
  for (const file of files) {
    const contentType = validateOperationFile(file);
    const metadataRef = doc(collection(db, 'operationAttachments'));
    const path = buildOperationAttachmentPath(org, operationId, metadataRef.id, file.name);
    const metadata: Omit<OperationAttachmentRecord, 'id'> & Record<string, unknown> = {
      organizationId: org,
      operationId,
      name: file.name,
      contentType,
      size: file.size,
      storagePath: path,
      storageProvider: 'supabase',
      storageBucket: 'insurnex-documents',
      storageKeyVersion: 2,
      downloadUrl: '',
      uploadState: 'pending',
      uploadedBy: uid,
      createdAt: serverTimestamp(),
    };

    await setDoc(metadataRef, metadata);
    try {
      const token = await user.getIdToken();
      await uploadOperationAttachment(file, {
        organizationId: org,
        operationId,
        attachmentId: metadataRef.id,
        userToken: token,
        contentType,
      });
      await updateDoc(metadataRef, { uploadState: 'ready' });
      uploadedIds.push(metadataRef.id);
    } catch (error) {
      // Do not leave a failed object publicly reachable. The private cleanup
      // action is restricted to the uploader and a still-pending metadata row.
      const token = await user.getIdToken().catch(() => '');
      if (token) {
        const pendingObject: OperationAttachmentStorageObject = {
          provider: 'supabase',
          bucket: 'insurnex-documents',
          path,
          attachmentId: metadataRef.id,
          operationId,
          organizationId: org,
          originalFileName: file.name,
          contentType,
          size: file.size,
        };
        await cleanupPendingOperationAttachment(pendingObject, token).catch(() => undefined);
      }
      await deleteDoc(metadataRef).catch(() => undefined);
      throw error;
    }
  }
  return uploadedIds;
}

export async function listOperationAttachments(
  org: string,
  operationId: string,
): Promise<OperationAttachmentRecord[]> {
  await requireOperationProfile(org, auth.currentUser?.uid || '');
  const snapshot = await getDocs(
    query(
      collection(db, 'operationAttachments'),
      where('organizationId', '==', org),
      where('operationId', '==', operationId),
      limit(100),
    ),
  );
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as OperationAttachmentRecord));
}

export async function getOperationAttachmentUrl(record: OperationAttachmentRecord): Promise<string> {
  if (record.storageProvider !== 'supabase') {
    if (record.downloadUrl) return record.downloadUrl;
    throw new Error(record.storagePath ? 'LEGACY_OPERATION_ATTACHMENT_REQUIRES_MIGRATION' : 'OPERATION_ATTACHMENT_URL_UNAVAILABLE');
  }
  const { user } = await requireOperationProfile(record.organizationId, auth.currentUser?.uid || '');
  const object = asStoredObject(record);
  return getOperationAttachmentTemporaryUrl(object, await user.getIdToken());
}

export async function deleteOperationAttachmentRecord(record: OperationAttachmentRecord): Promise<void> {
  if (record.storageProvider === 'supabase' && record.storagePath) {
    const { user, role } = await requireOperationProfile(record.organizationId, auth.currentUser?.uid || '');
    if (!['owner', 'admin'].includes(role)) throw new Error('DELETE_NOT_ALLOWED');
    await removeOperationAttachment(asStoredObject(record), await user.getIdToken());
  } else if (record.storagePath) {
    throw new Error('LEGACY_OPERATION_ATTACHMENT_REQUIRES_MIGRATION');
  } else {
    const { role } = await requireOperationProfile(record.organizationId, auth.currentUser?.uid || '');
    if (!['owner', 'admin'].includes(role)) throw new Error('DELETE_NOT_ALLOWED');
  }
  await deleteDoc(doc(db, 'operationAttachments', record.id));
}

// Defined beside the workflow service because cleanup is only valid for a pending
// attachment created by this uploader. It intentionally has no UI-facing use.
async function cleanupPendingOperationAttachment(
  object: OperationAttachmentStorageObject,
  userToken: string,
): Promise<void> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!supabaseUrl || !publishableKey) return;
  const client = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.functions.invoke('document-storage', {
    body: {
      action: 'operation-cleanup',
      organizationId: object.organizationId,
      operationId: object.operationId,
      attachmentId: object.attachmentId,
      path: object.path,
    },
    headers: { 'x-firebase-token': userToken },
  });
  if (error || !data?.ok) throw new Error(data?.error || 'OPERATION_ATTACHMENT_CLEANUP_FAILED');
}
