import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileText, Trash2, Upload } from 'lucide-react';
import type {
  ClientDocument,
  ClientKind,
  InsuranceNeed,
} from '../client.types';
import { getRequiredDocuments } from '../document-requirements';
import { supabaseDocumentStorage } from '../../storage/supabase-storage.provider';

interface Props {
  type: ClientKind;
  needs: InsuranceNeed[];
  documents: ClientDocument[];
  organizationId: string;
  firebaseToken: string;
  onAdd: (doc: ClientDocument) => void;
  onRemove: (id: string) => void;
}

export default function Step5Documents({
  type,
  needs,
  documents,
  organizationId,
  firebaseToken,
  onAdd,
  onRemove,
}: Props) {
  const required = useMemo(
    () => getRequiredDocuments(type, needs),
    [type, needs],
  );

  const uploadedByType = useMemo(() => {
    const map: Record<string, ClientDocument> = {};
    documents.forEach((d) => {
      map[d.type] = d;
    });
    return map;
  }, [documents]);

  const missing = required.filter((r) => !uploadedByType[r.type]);

  return (
    <div className="step-content">
      <p className="step-intro">
        ارفع المستندات المطلوبة. جميع المستندات <b>إلزامية</b> لإكمال إنشاء
        العميل.
      </p>

      <div className="docs-list">
        {required.map((req) => {
          const uploaded = uploadedByType[req.type];
          return (
            <div
              key={req.type}
              className={`doc-row ${uploaded ? 'is-uploaded' : 'is-missing'}`}
            >
              <span className="doc-icon">
                {uploaded ? (
                  <CheckCircle2
                    size={20}
                    style={{ color: 'var(--inx-success)' }}
                  />
                ) : (
                  <FileText
                    size={20}
                    style={{ color: 'var(--inx-warning)' }}
                  />
                )}
              </span>

              <div className="doc-copy">
                <b>{req.label}</b>
                {req.description && <small>{req.description}</small>}
              </div>

              {uploaded ? (
                <div className="doc-actions">
                  {uploaded.url && (
                    <a
                      href={uploaded.url}
                      target="_blank"
                      rel="noreferrer"
                      className="doc-link"
                    >
                      عرض
                    </a>
                  )}
                  <button
                    type="button"
                    className="inx-icon-btn"
                    onClick={() => onRemove(uploaded.id)}
                    title="حذف"
                  >
                    <Trash2 size={15} style={{ color: 'var(--inx-danger)' }} />
                  </button>
                </div>
              ) : (
                <UploadButton
                  label={req.label}
                  type={req.type}
                  organizationId={organizationId}
                  firebaseToken={firebaseToken}
                  onUploaded={(doc) => onAdd(doc)}
                />
              )}
            </div>
          );
        })}
      </div>

      {missing.length > 0 && (
        <div className="wizard-hint">
          ⚠️ متبقي {missing.length} مستند لرفعه قبل المتابعة
        </div>
      )}
    </div>
  );
}

function UploadButton({
  label,
  type,
  organizationId,
  firebaseToken,
  onUploaded,
}: {
  label: string;
  type: string;
  organizationId: string;
  firebaseToken: string;
  onUploaded: (doc: ClientDocument) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file: File) {
    setUploading(true);
    setError('');
    try {
      supabaseDocumentStorage.validate(file);

      // 1. Upload to Supabase
      const stored = await supabaseDocumentStorage.upload(file, {
        organizationId,
        clientId: 'draft',
        userToken: firebaseToken,
        area: 'onboarding',
      });

      if (!stored) {
        setError('تعذر رفع الملف');
        return;
      }

      // 2. Get a temporary URL (signed) for preview
      let tempUrl = '';
      try {
        tempUrl = await supabaseDocumentStorage.getTemporaryUrl(
          stored,
          firebaseToken,
          organizationId,
        );
      } catch (e) {
        console.warn('Failed to get temp URL', e);
      }

      // 3. Build the ClientDocument object
      const doc: ClientDocument = {
        id: `${type}-${Date.now()}`,
        type,
        label,
        url: tempUrl,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        uploadedAt: new Date(),
        verified: false,
      };

      onUploaded(doc);
    } catch (e) {
      console.error(e);
      setError((e as Error).message || 'تعذر رفع الملف');
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="inx-btn inx-btn-secondary inx-btn-sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        <Upload size={14} /> {uploading ? 'جاري الرفع...' : 'رفع'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = '';
        }}
      />
      {error && <small style={{ color: 'var(--inx-danger)' }}>{error}</small>}
    </>
  );
}