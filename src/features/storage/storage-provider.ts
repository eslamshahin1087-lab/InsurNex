export type StoredObject = {
  provider: 'supabase';
  bucket: string;
  path: string;
  documentId: string;
  originalFileName: string;
  contentType: string;
  size: number;
};

export type UploadContext = {
  organizationId: string;
  clientId?: string;
  documentId: string;
  userToken: string;
  layout?: 'client' | 'general';
  area?: 'onboarding' | 'quotation' | 'issuance' | 'policy' | 'claim' | 'renewal';
};

export interface DocumentStorageProvider {
  readonly bucket: string;
  validate(file: File): void;
  buildPath(file: File, context: UploadContext): string;
  upload(file: File, context: UploadContext): Promise<StoredObject>;
  remove(object: StoredObject, userToken: string, organizationId: string): Promise<void>;
  getTemporaryUrl(object: StoredObject, userToken: string, organizationId: string): Promise<string>;
}
