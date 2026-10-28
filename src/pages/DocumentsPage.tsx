import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileText, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import DocumentUploadForm from '../features/documents/DocumentUploadForm';
import {
  deleteDocumentRecord,
  getDocumentTemporaryUrl,
  listDocuments,
} from '../features/documents/document.service';
import type { DocumentRecord, DocumentRelationType } from '../types/document';

const relationLabels: Record<string, string> = {
  general: 'عام',
  client: 'عميل',
  policy: 'وثيقة',
  claim: 'مطالبة',
};

function sizeLabel(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function documentError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('LEGACY_DOCUMENT_REQUIRES_MIGRATION')) {
    return 'هذا الملف ما زال في التخزين القديم. حافظنا عليه لحين ترحيله والتحقق من سلامته.';
  }
  if (message.includes('DOCUMENT_ROLE_ACCESS_DENIED')) return 'ليس لديك صلاحية لهذه العملية.';
  if (message.includes('ORGANIZATION_ACCESS_DENIED')) return 'لا توجد صلاحية للوصول إلى مستندات هذه المؤسسة.';
  return 'تعذر تنفيذ العملية. تحقق من الاتصال والصلاحيات ثم حاول مجددًا.';
}

export default function DocumentsPage() {
  const { profile, user } = useAuth();
  const [items, setItems] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | DocumentRelationType>('all');
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!profile) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setItems(await listDocuments(profile.organizationId));
    } catch (reason) {
      console.error(reason);
      setError(documentError(reason));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter(item =>
      (filter === 'all' || item.relatedType === filter)
      && (!term || [
        item.name,
        item.originalFileName,
        item.notes,
        item.relatedId,
      ].join(' ').toLowerCase().includes(term)),
    );
  }, [items, filter, search]);

  async function openDocument(record: DocumentRecord) {
    setBusyId(record.id);
    setError('');
    try {
      const url = await getDocumentTemporaryUrl(record);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (reason) {
      console.error(reason);
      setError(documentError(reason));
    } finally {
      setBusyId('');
    }
  }

  async function remove(record: DocumentRecord) {
    if (!window.confirm('حذف المستند نهائيًا؟')) return;
    setBusyId(record.id);
    setError('');
    try {
      await deleteDocumentRecord(record);
      await load();
    } catch (reason) {
      console.error(reason);
      setError(documentError(reason));
    } finally {
      setBusyId('');
    }
  }

  return (
    <main className="mobile-page docs-page" dir="rtl">
      <header className="docs-heading">
        <div>
          <span className="eyebrow">Document Center</span>
          <h1>المستندات</h1>
          <p>ملفات المؤسسة المرتبطة بالعملاء والوثائق والمطالبات.</p>
        </div>
        <button className="floating-add" type="button" onClick={() => setForm(true)} disabled={!user}>
          <Plus />
        </button>
      </header>

      <div className="docs-search">
        <Search />
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث في المستندات" />
      </div>

      <div className="docs-filters">
        {(['all', 'general', 'client', 'policy', 'claim'] as const).map(value => (
          <button className={filter === value ? 'active' : ''} onClick={() => setFilter(value)} key={value}>
            {value === 'all' ? 'الكل' : relationLabels[value]}
          </button>
        ))}
      </div>

      {error && <div className="client-documents-v804-error" role="alert">{error}</div>}

      <section className="docs-list">
        {loading ? (
          <div className="docs-empty">جارٍ التحميل...</div>
        ) : visible.length === 0 ? (
          <div className="docs-empty">لا توجد مستندات مطابقة.</div>
        ) : visible.map(record => (
          <article key={record.id}>
            <span className="docs-icon"><FileText /></span>
            <div>
              <b>{record.name}</b>
              <small>{record.originalFileName} · {sizeLabel(record.size)} · {relationLabels[record.relatedType]}</small>
              {record.notes && <p>{record.notes}</p>}
            </div>
            <div className="docs-actions">
              {(record.storagePath || record.downloadUrl) && (
                <button type="button" disabled={busyId === record.id} onClick={() => void openDocument(record)} title="عرض / تنزيل">
                  <Download />
                </button>
              )}
              <button type="button" disabled={busyId === record.id} onClick={() => void remove(record)} title="حذف">
                <Trash2 />
              </button>
            </div>
          </article>
        ))}
      </section>

      {form && profile && user && (
        <DocumentUploadForm
          organizationId={profile.organizationId}
          userId={user.uid}
          onCancel={() => setForm(false)}
          onUploaded={() => { setForm(false); void load(); }}
        />
      )}
    </main>
  );
}
