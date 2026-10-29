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
import type { DocumentCategory, DocumentRecord } from '../../types/document';
import { supabaseDocumentStorage } from '../storage/supabase-storage.provider';
import type { StoredObject, UploadContext } from '../storage/storage-provider';

export const CLIENT_DOCUMENT_MAX_SIZE = 10 * 1024 * 1024;

export async function listClientDocuments(
  organizationId: string,
  clientId: string,
): Promise<DocumentRecord[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('AUTH_REQUIRED');

  const profile = await getDoc(doc(db, 'users', currentUser.uid));
  if (!profile.exists()) throw new Error('ACTIVE_PROFILE_REQUIRED');
  if (profile.data().status !== 'active' || profile.data().organizationId !== organizationId) {
    throw new Error('ORGANIZATION_ACCESS_DENIED');
  }

  const role = String(profile.data().role || '');
  if (!['owner', 'admin', 'broker', 'claims'].includes(role)) return [];

  const constraints = [
    where('organizationId', '==', organizationId),
    where('relatedType', '==', 'client'),
    where('relatedId', '==', clientId),
    ...(role === 'claims' ? [where('category', '==', 'claim')] : []),
    limit(300),
  ];
  const snapshot = await getDocs(query(collection(db, 'documents'), ...constraints));

  // Scope the query to the requested client before documents are downloaded.
  // Firestore Rules still provide authorization; query filters are minimization,
  // not a substitute for relation-aware read Rules.
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() } as DocumentRecord));
}

function storageAreaForCategory(category: DocumentCategory): NonNullable<UploadContext['area']> {
  if (category === 'claim') return 'claim';
  if (category === 'policy') return 'policy';
  if (category === 'proposal') return 'quotation';
  return 'onboarding';
}

function storedObjectFor(
  documentId: string,
  file: File,
  path: string,
): StoredObject {
  return {
    provider: 'supabase',
    bucket: supabaseDocumentStorage.bucket,
    path,
    documentId,
    originalFileName: file.name,
    contentType: file.type,
    size: file.size,
  };
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
  const metadataRef = doc(collection(db, 'documents'));
  const context: UploadContext = {
    organizationId: input.organizationId,
    clientId: input.clientId,
    documentId: metadataRef.id,
    userToken: firebaseToken,
    area: storageAreaForCategory(input.category),
  };
  const path = supabaseDocumentStorage.buildPath(input.file, context);
  const stored = storedObjectFor(metadataRef.id, input.file, path);

  try {
    // Save the intended path first, so the gateway can authorize the exact
    // metadata/path pair before issuing a signed upload token.
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
      storageKeyVersion: 2,
      downloadUrl: '',
      relatedType: 'client',
      relatedId: input.clientId,
      uploadedBy: input.userId,
      notes: input.notes.trim(),
      createdAt: serverTimestamp(),
    });
    await supabaseDocumentStorage.upload(input.file, context);
    return metadataRef.id;
  } catch (error) {
    // Cleanup is best-effort; the original failure must remain visible to the caller.
    await supabaseDocumentStorage.remove(stored, firebaseToken, input.organizationId).catch(() => undefined);
    await deleteDoc(metadataRef).catch(() => undefined);
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
      bucket: record.storageBucket || supabaseDocumentStorage.bucket,
      path: record.storagePath,
      documentId: record.id,
      originalFileName: record.originalFileName,
      contentType: record.contentType,
      size: record.size,
    }, firebaseToken, organizationId);
  }
  if (record.downloadUrl) return record.downloadUrl;
  throw new Error('DOCUMENT_URL_UNAVAILABLE');
}

export async function deleteClientDocumentV8(record: DocumentRecord, organizationId: string) {
  // Do not delete metadata for legacy Firebase-backed files: that would orphan
  // the original object before the explicit migration/verification phase.
  if (record.storageProvider !== 'supabase' || !record.storagePath) {
    throw new Error('LEGACY_DOCUMENT_REQUIRES_MIGRATION');
  }

  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('AUTH_REQUIRED');
  const firebaseToken = await currentUser.getIdToken();
  await supabaseDocumentStorage.remove({
    provider: 'supabase',
    bucket: record.storageBucket || supabaseDocumentStorage.bucket,
    path: record.storagePath,
    documentId: record.id,
    originalFileName: record.originalFileName,
    contentType: record.contentType,
    size: record.size,
  }, firebaseToken, organizationId);
  await deleteDoc(doc(db, 'documents', record.id));
}

export async function uploadInsurerQuoteDocumentV95(input: {
  organizationId: string;
  clientId: string;
  userId: string;
  rfqId: string;
  insurerId: string;
  insurerName: string;
  file: File;
}) {
  supabaseDocumentStorage.validate(input.file);
  const currentUser = auth.currentUser;
  if (!currentUser || currentUser.uid !== input.userId) throw new Error('AUTH_REQUIRED');
  const firebaseToken = await currentUser.getIdToken();
  const metadataRef = doc(collection(db, 'documents'));
  const context: UploadContext = {
    organizationId: input.organizationId,
    clientId: input.clientId,
    documentId: metadataRef.id,
    userToken: firebaseToken,
    area: 'quotation',
  };
  const path = supabaseDocumentStorage.buildPath(input.file, context);
  const stored = storedObjectFor(metadataRef.id, input.file, path);

  try {
    await setDoc(metadataRef, {
      organizationId: input.organizationId,
      name: input.file.name,
      category: 'proposal',
      originalFileName: input.file.name,
      contentType: input.file.type,
      size: input.file.size,
      storagePath: path,
      storageProvider: stored.provider,
      storageBucket: stored.bucket,
      storageKeyVersion: 2,
      downloadUrl: '',
      relatedType: 'client',
      relatedId: input.clientId,
      uploadedBy: input.userId,
      notes: 'QUOTE|RFQ:' + input.rfqId + '|INSURER:' + input.insurerId + '|' + input.insurerName,
      createdAt: serverTimestamp(),
    });
    await supabaseDocumentStorage.upload(input.file, context);
    return { documentId: metadataRef.id, documentName: input.file.name };
  } catch (error) {
    await supabaseDocumentStorage.remove(stored, firebaseToken, input.organizationId).catch(() => undefined);
    await deleteDoc(metadataRef).catch(() => undefined);
    throw error;
  }
}
