import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { DocumentStorageProvider } from './storage-provider';

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
const bucket =
  (import.meta.env.VITE_SUPABASE_DOCUMENT_BUCKET as string | undefined) ||
  'insurnex-documents';

// ============================================================
// Singleton Supabase client (avoids "Multiple GoTrueClient" warning)
// ============================================================

let cachedClient: SupabaseClient | null = null;

function configured(): SupabaseClient {
  if (!url || !publishableKey) throw new Error('DOCUMENT_STORAGE_NOT_CONFIGURED');
  if (!cachedClient) {
    cachedClient = createClient(url, publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return cachedClient;
}

function safeName(name: string) {
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, '') : '';
  const base = (dot >= 0 ? name.slice(0, dot) : name)
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80) || 'document';
  return `${base}${ext}`;
}

async function invoke<T>(
  action: string,
  body: Record<string, unknown>,
  token: string,
): Promise<T> {
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
  bucket,

  validate(file) {
    if (file.size <= 0) throw new Error('EMPTY_FILE');
    if (file.size > MAX_SIZE) throw new Error('FILE_TOO_LARGE');
    if (!ALLOWED.has(file.type)) throw new Error('FILE_TYPE_NOT_ALLOWED');
  },

  buildPath(file, context) {
    const safeSegment = /^[A-Za-z0-9_-]{1,128}$/;
    if (!safeSegment.test(context.organizationId) || !safeSegment.test(context.documentId)) {
      throw new Error('INVALID_DOCUMENT_CONTEXT');
    }

    const filename = `${context.documentId}-${safeName(file.name)}`;
    if (context.layout === 'general') {
      return `organizations/${context.organizationId}/documents/${context.documentId}/${safeName(file.name)}`;
    }

    if (!context.clientId || !safeSegment.test(context.clientId)) {
      throw new Error('INVALID_DOCUMENT_CONTEXT');
    }
    const area = context.area || 'onboarding';
    if (!['onboarding', 'quotation', 'issuance', 'policy', 'claim', 'renewal'].includes(area)) {
      throw new Error('INVALID_DOCUMENT_AREA');
    }
    // The document ID prefix binds client-linked objects to the Firestore metadata record.
    return `organizations/${context.organizationId}/clients/${context.clientId}/${area}/${filename}`;
  },

  async upload(file, context) {
    this.validate(file);
    const path = this.buildPath(file, context);
    const payload = await invoke<{ ok: true; token: string; path: string }>(
      'sign-upload',
      {
        organizationId: context.organizationId,
        documentId: context.documentId,
        path,
        contentType: file.type,
        size: file.size,
      },
      context.userToken,
    );

    const client = configured();
    const { error } = await client.storage
      .from(bucket)
      .uploadToSignedUrl(payload.path, payload.token, file, {
        contentType: file.type,
        cacheControl: '3600',
      });
    if (error) throw new Error(`DOCUMENT_UPLOAD_FAILED:${error.message}`);

    return {
      provider: 'supabase',
      bucket,
      path: payload.path,
      documentId: context.documentId,
      originalFileName: file.name,
      contentType: file.type,
      size: file.size,
    };
  },

  async remove(object, userToken, organizationId) {
    await invoke('delete', {
      organizationId,
      documentId: object.documentId,
      path: object.path,
    }, userToken);
  },

  async getTemporaryUrl(object, userToken, organizationId) {
    const payload = await invoke<{ ok: true; signedUrl: string }>(
      'sign-download',
      { organizationId, documentId: object.documentId, path: object.path },
      userToken,
    );
    return payload.signedUrl;
  },
};


export type OperationAttachmentStorageObject = {
  provider: 'supabase';
  bucket: string;
  path: string;
  attachmentId: string;
  operationId: string;
  organizationId: string;
  originalFileName: string;
  contentType: string;
  size: number;
};

const SAFE_STORAGE_SEGMENT = /^[A-Za-z0-9_-]{1,128}$/;

export function buildOperationAttachmentPath(
  organizationId: string,
  operationId: string,
  attachmentId: string,
  originalFileName: string,
) {
  if (![organizationId, operationId, attachmentId].every((value) => SAFE_STORAGE_SEGMENT.test(value))) {
    throw new Error('INVALID_OPERATION_ATTACHMENT_CONTEXT');
  }
  return `organizations/${organizationId}/operations/${operationId}/${attachmentId}-${safeName(originalFileName)}`;
}

export async function uploadOperationAttachment(
  file: File,
  input: {
    organizationId: string;
    operationId: string;
    attachmentId: string;
    userToken: string;
    contentType: string;
  },
): Promise<OperationAttachmentStorageObject> {
  const path = buildOperationAttachmentPath(input.organizationId, input.operationId, input.attachmentId, file.name);
  const payload = await invoke<{ ok: true; token: string; path: string }>(
    'operation-sign-upload',
    {
      organizationId: input.organizationId,
      operationId: input.operationId,
      attachmentId: input.attachmentId,
      path,
      contentType: input.contentType,
      size: file.size,
    },
    input.userToken,
  );
  const client = configured();
  const { error } = await client.storage.from(bucket).uploadToSignedUrl(payload.path, payload.token, file, {
    contentType: input.contentType,
    cacheControl: '3600',
  });
  if (error) throw new Error(`OPERATION_ATTACHMENT_UPLOAD_FAILED:${error.message}`);
  return {
    provider: 'supabase',
    bucket,
    path: payload.path,
    attachmentId: input.attachmentId,
    operationId: input.operationId,
    organizationId: input.organizationId,
    originalFileName: file.name,
    contentType: input.contentType,
    size: file.size,
  };
}

export async function getOperationAttachmentTemporaryUrl(
  object: OperationAttachmentStorageObject,
  userToken: string,
): Promise<string> {
  const payload = await invoke<{ ok: true; signedUrl: string }>(
    'operation-sign-download',
    {
      organizationId: object.organizationId,
      operationId: object.operationId,
      attachmentId: object.attachmentId,
      path: object.path,
    },
    userToken,
  );
  return payload.signedUrl;
}

export async function removeOperationAttachment(
  object: OperationAttachmentStorageObject,
  userToken: string,
): Promise<void> {
  await invoke('operation-delete', {
    organizationId: object.organizationId,
    operationId: object.operationId,
    attachmentId: object.attachmentId,
    path: object.path,
  }, userToken);
}
