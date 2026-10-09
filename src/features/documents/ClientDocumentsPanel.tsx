import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Download, ExternalLink, FileCheck2, FileText, Paperclip, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import type { DocumentCategory, DocumentRecord } from '../../types/document';
import {deleteClientDocumentV8, getClientDocumentUrl, listClientDocuments, uploadClientDocumentV8 } from './client-documents-v8.service';

type Props = { clientId: string; organizationId: string };
const categoryLabel: Record<DocumentCategory, string> = {
  policy: 'وثيقة تأمين', claim: 'مطالبة', client: 'ملف عميل', identity: 'هوية', proposal: 'عرض', correspondence: 'مراسلات', other: 'أخرى',
};
function sizeLabel(value: number) { return value < 1024 * 1024 ? `${Math.max(1, Math.ceil(value / 1024))} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`; }
function errorLabel(error: unknown) {
  const value = error instanceof Error ? error.message : '';
  if (value.includes('FILE_TOO_LARGE')) return 'الملف أكبر من 10 MB.';
  if (value.includes('FILE_TYPE_NOT_ALLOWED')) return 'نوع الملف غير مسموح.';
  if (value.includes('AUTH_REQUIRED')) return 'انتهت جلسة المستخدم. أعد تسجيل الدخول.';
  if (value.includes('ORGANIZATION_ACCESS_DENIED')) return 'لا توجد صلاحية للوصول إلى مستندات هذه المؤسسة.';
  return 'تعذر تنفيذ عملية المستند. حاول مرة أخرى.';
}

export default function ClientDocumentsPanel({ clientId, organizationId }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setItems(await listClientDocuments(organizationId, clientId)); }
    catch (reason) { console.error(reason); setError('تعذر تحميل مستندات العميل.'); }
    finally { setLoading(false); }
  }, [clientId, organizationId]);
  useEffect(() => { void load(); }, [load]);

  const health = useMemo(() => ({ total: items.length, identity: items.filter(x => x.category === 'identity').length, client: items.filter(x => x.category === 'client').length }), [items]);

  async function open(record: DocumentRecord, download = false) {
    setBusyId(record.id); setError('');
    try {
      const url = await getClientDocumentUrl(record, organizationId);
      if (download) {
        const anchor = document.createElement('a'); anchor.href = url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.download = record.originalFileName; anchor.click();
      } else window.open(url, '_blank', 'noopener,noreferrer');
    } catch (reason) { console.error(reason); setError(errorLabel(reason)); }
    finally { setBusyId(''); }
  }

  async function remove(record: DocumentRecord) {
    if (!window.confirm(`حذف المستند: ${record.name}؟`)) return;
    setBusyId(record.id); setError('');
    try { await deleteClientDocumentV8(record, organizationId); await load(); }
    catch (reason) { console.error(reason); setError(errorLabel(reason)); }
    finally { setBusyId(''); }
  }

  return <section className="client-section client-documents-v804">
    <header className="section-heading"><div><span className="eyebrow">Documents</span><h2>مستندات العميل</h2><p>مستندات العميل المحفوظة والمرتبطة بملفه.</p></div><div className="client-documents-v804-actions"><span className="section-count">{items.length}</span><button type="button" className="primary-button" onClick={() => setShowUpload(true)}><Plus size={16}/>إضافة مستند</button></div></header>
    <div className="client-documents-v804-health"><span><FileCheck2 size={16}/>إجمالي {health.total}</span><span>ملف عميل {health.client}</span><span>هوية {health.identity}</span></div>
    {error && <div className="client-documents-v804-error">{error}</div>}
    {loading ? <div className="empty"><RefreshCw size={22}/><strong>جارٍ تحميل المستندات...</strong></div> : items.length === 0 ? <div className="empty"><FileText size={24}/><strong>لا توجد مستندات</strong><p>أضف مستندات العميل لتكون متاحة لاحقًا في طلبات عروض الأسعار والإصدار.</p></div> : <div className="client-documents-v804-list">{items.map(record => <article key={record.id}><span className="client-documents-v804-icon"><FileText/></span><div className="client-documents-v804-main"><strong>{record.name}</strong><small>{record.originalFileName} · {sizeLabel(record.size)} · {categoryLabel[record.category]}</small>{record.notes && <p>{record.notes}</p>}</div><div className="client-documents-v804-row-actions"><button disabled={busyId === record.id} onClick={() => void open(record)} title="عرض"><ExternalLink size={17}/></button><button disabled={busyId === record.id} onClick={() => void open(record, true)} title="تنزيل"><Download size={17}/></button><button disabled={busyId === record.id} onClick={() => void remove(record)} title="حذف" className="danger"><Trash2 size={17}/></button></div></article>)}</div>}
    {showUpload && user && <ClientDocumentUpload clientId={clientId} organizationId={organizationId} userId={user.uid} onClose={() => setShowUpload(false)} onUploaded={async () => { setShowUpload(false); await load(); }}/>} 
  </section>;
}

function ClientDocumentUpload({ clientId, organizationId, userId, onClose, onUploaded }: { clientId: string; organizationId: string; userId: string; onClose: () => void; onUploaded: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null); const [name, setName] = useState(''); const [category, setCategory] = useState<DocumentCategory>('client'); const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); if (!file) return; setBusy(true); setError(''); try { await uploadClientDocumentV8({ organizationId, clientId, userId, name, category, notes, file }); await onUploaded(); } catch (reason) { console.error(reason); setError(errorLabel(reason)); } finally { setBusy(false); } }
  return <div className="client-documents-v804-modal"><form onSubmit={submit}><header><div><span className="eyebrow">Client Document</span><h3>إضافة مستند للعميل</h3></div><button type="button" onClick={onClose}><X/></button></header><label><span>الملف *</span><input required type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" onChange={event => setFile(event.target.files?.[0] || null)}/><small>PDF / JPG / PNG / DOCX / XLSX حتى 10MB.</small></label><label><span>اسم المستند</span><input value={name} onChange={event => setName(event.target.value)} placeholder={file?.name || 'اسم واضح للمستند'}/></label><label><span>التصنيف</span><select value={category} onChange={event => setCategory(event.target.value as DocumentCategory)}>{Object.entries(categoryLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>ملاحظات</span><textarea value={notes} onChange={event => setNotes(event.target.value)} rows={3}/></label>{file && <div className="client-documents-v804-file"><Paperclip size={15}/>{file.name} · {sizeLabel(file.size)}</div>}{error && <div className="client-documents-v804-error">{error}</div>}<footer><button type="button" onClick={onClose}>إلغاء</button><button className="primary-button" disabled={busy || !file}>{busy ? 'جارٍ الرفع...' : 'رفع وربط المستند'}</button></footer></form></div>;
}
