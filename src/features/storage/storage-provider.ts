export type StoredObject = {
  provider: 'supabase';
  bucket: string;
  path: string;
  originalFileName: string;
  contentType: string;
  size: number;
};

export type UploadContext = {
  organizationId: string;
  clientId: string;
  userToken: string;
  area?: 'onboarding' | 'quotation' | 'issuance' | 'policy' | 'claim' | 'renewal';
};

export interface DocumentStorageProvider {
  validate(file: File): void;
  upload(file: File, context: UploadContext): Promise<StoredObject>;
  remove(object: StoredObject, userToken: string, organizationId: string): Promise<void>;
  getTemporaryUrl(object: StoredObject, userToken: string, organizationId: string): Promise<string>;
}
