import { createClient } from '@supabase/supabase-js';
import type { DocumentStorageProvider, StoredObject } from './storage-provider';
import type { DocumentRelationType } from '../../types/document';

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const bucket = (import.meta.env.VITE_SUPABASE_DOCUMENT_BUCKET as string | undefined) || 'insurnex-documents';

function configured() {
  if (!url || !publishableKey) throw new Error('DOCUMENT_STORAGE_NOT_CONFIGURED');
  return createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

function safeName(name: string) {
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, '') : '';
  const base = (dot >= 0 ? name.slice(0, dot) : name).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'document';
  return `${base}${ext}`;
}

async function invoke<T>(action: string, body: Record<string, unknown>, token: string): Promise<T> {
  const client = configured();
  const { data, error } = await client.functions.invoke('document-storage', {
    body: { action, ...body },
    headers: { 'x-firebase-token': token },
  });
  if (error) throw new Error(`DOCUMENT_GATEWAY_FAILED:${error.message}`);
  if (!data?.ok) throw new Error(data?.error || 'DOCUMENT_GATEWAY_REJECTED');
  return data as T;
}

export const supabaseDocumentStorage: DocumentStorageProvider = {
  validate(file) {
    if (file.size <= 0) throw new Error('EMPTY_FILE');
    if (file.size > MAX_SIZE) throw new Error('FILE_TOO_LARGE');
    if (!ALLOWED.has(file.type)) throw new Error('FILE_TYPE_NOT_ALLOWED');
  },

  async upload(file, context) {
    this.validate(file);
    const unique = crypto.randomUUID();
    const path = `organizations/${context.organizationId}/clients/${context.clientId}/${context.area || 'onboarding'}/${context.userId}/${unique}-${safeName(file.name)}`;
    const payload = await invoke<{ ok: true; token: string; path: string }>('sign-upload', {
      organizationId: context.organizationId,
      path,
      contentType: file.type,
      size: file.size,
    }, context.userToken);
    const client = configured();
    const { error } = await client.storage.from(bucket).uploadToSignedUrl(payload.path, payload.token, file, {
      contentType: file.type,
      cacheControl: '3600',
    });
    if (error) throw new Error(`DOCUMENT_UPLOAD_FAILED:${error.message}`);
    return { provider: 'supabase', bucket, path: payload.path, originalFileName: file.name, contentType: file.type, size: file.size };
  },

  async remove(object, userToken, organizationId) {
    await invoke('delete', { organizationId, path: object.path }, userToken);
  },

  async getTemporaryUrl(object, userToken, organizationId) {
    const payload = await invoke<{ ok: true; signedUrl: string }>('sign-download', { organizationId, path: object.path }, userToken);
    return payload.signedUrl;
  },
};

export async function uploadOrganizationDocument(
  file: File,
  context: {
    organizationId: string;
    documentId: string;
    userId: string;
    userToken: string;
    relatedType: DocumentRelationType;
    relatedId: string;
  },
): Promise<StoredObject> {
  supabaseDocumentStorage.validate(file);
  if (context.relatedType === 'general' && context.relatedId) {
    throw new Error('GENERAL_DOCUMENT_MUST_NOT_HAVE_RELATED_ID');
  }
  if (context.relatedType !== 'general' && !context.relatedId.trim()) {
    throw new Error('DOCUMENT_RELATION_REQUIRED');
  }

  const path = `organizations/${context.organizationId}/documents/${context.userId}/${context.documentId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const payload = await invoke<{ ok: true; token: string; path: string }>('sign-upload', {
    organizationId: context.organizationId,
    path,
    documentId: context.documentId,
    relatedType: context.relatedType,
    relatedId: context.relatedType === 'general' ? '' : context.relatedId,
    contentType: file.type,
    size: file.size,
  }, context.userToken);

  const client = configured();
  const { error } = await client.storage.from(bucket).uploadToSignedUrl(payload.path, payload.token, file, {
    contentType: file.type,
    cacheControl: '3600',
  });
  if (error) throw new Error(`DOCUMENT_UPLOAD_FAILED:${error.message}`);
  return {
    provider: 'supabase',
    bucket,
    path: payload.path,
    originalFileName: file.name,
    contentType: file.type,
    size: file.size,
  };
}

const OPERATION_MAX_SIZE = 20 * 1024 * 1024;
const OPERATION_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
};
const OPERATION_TYPES = new Set(Object.values(OPERATION_MIME_BY_EXTENSION));

export async function uploadOperationsAttachment(
  file: File,
  context: { organizationId: string; operationId: string; userId: string; userToken: string },
) {
  if (file.size <= 0) throw new Error('EMPTY_FILE');
  if (file.size > OPERATION_MAX_SIZE) throw new Error('FILE_TOO_LARGE');
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const expectedType = OPERATION_MIME_BY_EXTENSION[extension];
  if (!expectedType) throw new Error('FILE_TYPE_NOT_ALLOWED');
  if (file.type && file.type !== expectedType && !(extension === 'csv' && file.type === 'application/csv')) {
    throw new Error('FILE_TYPE_EXTENSION_MISMATCH');
  }
  if (!OPERATION_TYPES.has(expectedType)) throw new Error('FILE_TYPE_NOT_ALLOWED');

  const contentType = expectedType;
  const path = `organizations/${context.organizationId}/operations/${context.operationId}/${context.userId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const payload = await invoke<{ ok: true; token: string; path: string }>('sign-upload', {
    organizationId: context.organizationId,
    path,
    contentType,
    size: file.size,
  }, context.userToken);
  const client = configured();
  const { error } = await client.storage.from(bucket).uploadToSignedUrl(payload.path, payload.token, file, {
    contentType,
    cacheControl: '3600',
  });
  if (error) throw new Error(`DOCUMENT_UPLOAD_FAILED:${error.message}`);
  return {
    provider: 'supabase' as const,
    bucket,
    path: payload.path,
    originalFileName: file.name,
    contentType,
    size: file.size,
  };
}
