import { useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileText, Trash2, Upload } from 'lucide-react';
import type {
  ClientDocument,
  ClientKind,
  InsuranceNeed,
} from '../client.types';
import { getRequiredDocuments } from '../document-requirements';


interface Props {
  type: ClientKind;
  needs: InsuranceNeed[];
  documents: ClientDocument[];

  onAdd: (doc: ClientDocument) => void;
  onRemove: (id: string) => void;
}

export default function Step5Documents({
  type,
  needs,
  documents,
  
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

  onUploaded,
}: {
  label: string;
  type: string;

  onUploaded: (doc: ClientDocument) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(file: File) {
    setUploading(true);
    setError('');
    try {
      const maxBytes = 10 * 1024 * 1024;
      const allowed = new Set([
        'application/pdf',
        'image/jpeg',
        'image/png',
      ]);
      if (file.size <= 0) throw new Error('EMPTY_FILE');
      if (file.size > maxBytes) throw new Error('FILE_TOO_LARGE');
      if (!allowed.has(file.type)) throw new Error('FILE_TYPE_NOT_ALLOWED');

      // Stage locally until the client record exists. The secured storage
      // gateway requires a real client ID and an authorized Firestore metadata
      // record; uploading against a placeholder client ID would be unsafe and
      // cannot be authorized correctly.
      const staged: ClientDocument = {
        id: `${type}-${crypto.randomUUID()}`,
        type,
        label,
        url: '',
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        uploadedAt: new Date(),
        verified: false,
        pendingFile: file,
      };
      onUploaded(staged);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setError(
        code === 'FILE_TOO_LARGE'
          ? 'الملف أكبر من 10 MB.'
          : code === 'FILE_TYPE_NOT_ALLOWED'
            ? 'نوع الملف غير مسموح.'
            : 'تعذر تجهيز المستند.',
      );
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