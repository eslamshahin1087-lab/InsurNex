import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Download, ExternalLink, FileCheck2, FileText, Paperclip, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import type { DocumentCategory, DocumentRecord } from '../../types/document';
import {
  deleteClientDocumentV8,
  getClientDocumentUrl,
  listClientDocuments,
  uploadClientDocumentV8,
} from './client-documents-v8.service';
import {
  getLegacyClientDocumentUrl,
  listLegacyClientDocuments,
  type LegacyClientDocumentReference,
} from './legacy-client-documents.service';
import { DOCUMENT_CATEGORY_LABELS as categoryLabel } from '../../types/document';

type Props = { clientId: string; organizationId: string };

function sizeLabel(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 'الحجم غير متاح';
  return value < 1024 * 1024
    ? `${Math.max(1, Math.ceil(value / 1024))} KB`
    : `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function errorLabel(error: unknown) {
  const value = error instanceof Error ? error.message : '';
  if (value.includes('FILE_TOO_LARGE')) return 'الملف أكبر من 10 MB.';
  if (value.includes('FILE_TYPE_NOT_ALLOWED')) return 'نوع الملف غير مسموح.';
  if (value.includes('AUTH_REQUIRED')) return 'انتهت جلسة المستخدم. أعد تسجيل الدخول.';
  if (value.includes('ORGANIZATION_ACCESS_DENIED') || value.includes('CLIENT_ACCESS_DENIED')) {
    return 'لا توجد صلاحية للوصول إلى مستندات هذا العميل.';
  }
  if (value.includes('LEGACY_CLIENT_DOCUMENT_ACCESS_DENIED')) {
    return 'دور المستخدم لا يسمح بفتح هذا المستند القديم.';
  }
  if (value.includes('LEGACY_CLIENT_DOCUMENT_NOT_FOUND')
      || value.includes('LEGACY_CLIENT_DOCUMENT_REFERENCE_INVALID')
      || value.includes('LEGACY_CLIENT_DOCUMENT_REFERENCE_AMBIGUOUS')) {
    return 'مرجع المستند القديم غير صالح أو مكرر أو لم يعد متاحًا. لم يتم تعديل الملف الأصلي.';
  }
  if (value.includes('LEGACY_CLIENT_DOCUMENT_UNAVAILABLE')) {
    return 'الملف القديم غير متاح حاليًا. تحقق من التخزين أو صلاحية المرجع.';
  }
  if (value.includes('LEGACY_CLIENT_DOCUMENT_METADATA_MISMATCH')) {
    return 'بيانات المستند لا تتطابق مع بيانات التخزين؛ تم منع فتح الملف احترازيًا.';
  }
  if (value.includes('POPUP_BLOCKED')) {
    return 'المتصفح منع فتح نافذة المستند. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.';
  }
  if (value.includes('UNKNOWN_ACTION') || value.includes('DOCUMENT_GATEWAY_REJECTED')) {
    return 'بوابة المستندات تحتاج إلى تحديث قبل فتح المستندات القديمة.';
  }
  return 'تعذر تنفيذ عملية المستند. حاول مرة أخرى.';
}

export default function ClientDocumentsPanel({ clientId, organizationId }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<DocumentRecord[]>([]);
  const [legacyItems, setLegacyItems] = useState<LegacyClientDocumentReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [currentDocuments, legacyDocuments] = await Promise.all([
        listClientDocuments(organizationId, clientId),
        listLegacyClientDocuments(organizationId, clientId),
      ]);
      setItems(currentDocuments);
      setLegacyItems(legacyDocuments);
    } catch (reason) {
      console.error('Failed to load client documents', reason);
      setError('تعذر تحميل مستندات العميل.');
    } finally {
      setLoading(false);
    }
  }, [clientId, organizationId]);

  useEffect(() => { void load(); }, [load]);

  const health = useMemo(() => {
    const allCategories = [
      ...items.map(item => item.category),
      ...legacyItems.map(item => item.category),
    ];
    return {
      total: items.length + legacyItems.length,
      identity: allCategories.filter(category => category === 'identity').length,
      client: allCategories.filter(category => category === 'client').length,
      legacy: legacyItems.length,
    };
  }, [items, legacyItems]);

  async function open(record: DocumentRecord, download = false) {
    setBusyId(record.id);
    setError('');
    let popup: Window | null = null;
    try {
      if (!download) {
        popup = window.open('about:blank', '_blank');
        if (popup) popup.opener = null;
      }
      const url = await getClientDocumentUrl(record, organizationId);
      if (download) {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.download = record.originalFileName;
        anchor.click();
      } else if (popup) {
        popup.location.replace(url);
      } else {
        throw new Error('POPUP_BLOCKED');
      }
    } catch (reason) {
      popup?.close();
      console.error('Failed to open client document', reason);
      setError(errorLabel(reason));
    } finally {
      setBusyId('');
    }
  }

  async function openLegacy(record: LegacyClientDocumentReference, download = false) {
    const key = `legacy:${record.id}`;
    setBusyId(key);
    setError('');
    let popup: Window | null = null;
    try {
      // Open the viewing tab while still in the click handler so popup blockers
      // do not prevent the later redirect after the signed URL is requested.
      if (!download) {
        popup = window.open('about:blank', '_blank');
        if (popup) popup.opener = null;
      }
      const url = await getLegacyClientDocumentUrl(record, organizationId);
      if (download) {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.download = record.fileName;
        anchor.click();
      } else if (popup) {
        popup.location.replace(url);
      } else {
        throw new Error('POPUP_BLOCKED');
      }
    } catch (reason) {
      popup?.close();
      console.error('Failed to open legacy client document', reason);
      setError(errorLabel(reason));
    } finally {
      setBusyId('');
    }
  }

  async function remove(record: DocumentRecord) {
    if (!window.confirm(`حذف المستند: ${record.name}؟`)) return;
    setBusyId(record.id);
    setError('');
    try {
      await deleteClientDocumentV8(record, organizationId);
      await load();
    } catch (reason) {
      console.error('Failed to delete client document', reason);
      setError(errorLabel(reason));
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="client-section client-documents-v804">
      <header className="section-heading">
        <div>
          <span className="eyebrow">Documents</span>
          <h2>مستندات العميل</h2>
          <p>مستندات العميل المحفوظة والمرتبطة بملفه.</p>
        </div>
        <div className="client-documents-v804-actions">
          <span className="section-count">{health.total}</span>
          <button type="button" className="primary-button" onClick={() => setShowUpload(true)}>
            <Plus size={16} /> إضافة مستند
          </button>
        </div>
      </header>

      <div className="client-documents-v804-health">
        <span><FileCheck2 size={16} />إجمالي {health.total}</span>
        <span>ملف عميل {health.client}</span>
        <span>هوية {health.identity}</span>
        {health.legacy > 0 && <span>مستندات قديمة {health.legacy}</span>}
      </div>

      {error && <div className="client-documents-v804-error" role="alert">{error}</div>}

      {loading ? (
        <div className="empty"><RefreshCw size={22} /><strong>جارٍ تحميل المستندات...</strong></div>
      ) : health.total === 0 ? (
        <div className="empty">
          <FileText size={24} />
          <strong>لا توجد مستندات</strong>
          <p>أضف مستندات العميل لتكون متاحة لاحقًا في طلبات عروض الأسعار والإصدار.</p>
        </div>
      ) : (
        <div className="client-documents-v804-list">
          {items.map(record => (
            <article key={record.id}>
              <span className="client-documents-v804-icon"><FileText /></span>
              <div className="client-documents-v804-main">
                <strong>{record.name}</strong>
                <small>{record.originalFileName} · {sizeLabel(record.size)} · {categoryLabel[record.category]}</small>
                {record.notes && <p>{record.notes}</p>}
              </div>
              <div className="client-documents-v804-row-actions">
                <button type="button" disabled={busyId === record.id} onClick={() => void open(record)} title="عرض" aria-label={`عرض ${record.name}`}>
                  <ExternalLink size={17} />
                </button>
                <button type="button" disabled={busyId === record.id} onClick={() => void open(record, true)} title="تنزيل" aria-label={`تنزيل ${record.name}`}>
                  <Download size={17} />
                </button>
                <button type="button" disabled={busyId === record.id} onClick={() => void remove(record)} title="حذف" aria-label={`حذف ${record.name}`} className="danger">
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}

          {legacyItems.map(record => {
            const key = `legacy:${record.id}`;
            return (
              <article key={key}>
                <span className="client-documents-v804-icon"><FileText /></span>
                <div className="client-documents-v804-main">
                  <strong>{record.label}</strong>
                  <small>{record.fileName} · {sizeLabel(record.size)} · {categoryLabel[record.category]}</small>
                  <p>مستند قديم — يتم إنشاء رابط وصول مؤقت عند الطلب، ولا يُستخدم الرابط القديم المحفوظ.</p>
                </div>
                <div className="client-documents-v804-row-actions">
                  <button type="button" disabled={busyId === key} onClick={() => void openLegacy(record)} title="عرض" aria-label={`عرض ${record.label}`}>
                    <ExternalLink size={17} />
                  </button>
                  <button type="button" disabled={busyId === key} onClick={() => void openLegacy(record, true)} title="تنزيل" aria-label={`تنزيل ${record.label}`}>
                    <Download size={17} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showUpload && user && (
        <ClientDocumentUpload
          clientId={clientId}
          organizationId={organizationId}
          userId={user.uid}
          onClose={() => setShowUpload(false)}
          onUploaded={async () => { setShowUpload(false); await load(); }}
        />
      )}
    </section>
  );
}

function ClientDocumentUpload({
  clientId,
  organizationId,
  userId,
  onClose,
  onUploaded,
}: {
  clientId: string;
  organizationId: string;
  userId: string;
  onClose: () => void;
  onUploaded: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('client');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      await uploadClientDocumentV8({ organizationId, clientId, userId, name, category, notes, file });
      await onUploaded();
    } catch (reason) {
      console.error('Failed to upload client document', reason);
      setError(errorLabel(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="client-documents-v804-modal">
      <form onSubmit={submit}>
        <header>
          <div><span className="eyebrow">Client Document</span><h3>إضافة مستند للعميل</h3></div>
          <button type="button" onClick={onClose} aria-label="إغلاق"><X /></button>
        </header>
        <label>
          <span>الملف *</span>
          <input required type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" onChange={event => setFile(event.target.files?.[0] || null)} />
          <small>PDF / JPG / PNG / DOCX / XLSX حتى 10MB.</small>
        </label>
        <label><span>اسم المستند</span><input value={name} onChange={event => setName(event.target.value)} placeholder={file?.name || 'اسم واضح للمستند'} /></label>
        <label>
          <span>التصنيف</span>
          <select value={category} onChange={event => setCategory(event.target.value as DocumentCategory)}>
            {Object.entries(categoryLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label><span>ملاحظات</span><textarea value={notes} onChange={event => setNotes(event.target.value)} rows={3} /></label>
        {file && <div className="client-documents-v804-file"><Paperclip size={15} />{file.name} · {sizeLabel(file.size)}</div>}
        {error && <div className="client-documents-v804-error" role="alert">{error}</div>}
        <footer>
          <button type="button" onClick={onClose}>إلغاء</button>
          <button className="primary-button" disabled={busy || !file}>{busy ? 'جارٍ الرفع...' : 'رفع وربط المستند'}</button>
        </footer>
      </form>
    </div>
  );
}
