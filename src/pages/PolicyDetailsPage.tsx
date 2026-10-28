// ============================================================
// src/pages/PolicyDetailsPage.tsx
// صفحة تفاصيل البوليصة - متوافقة مع الهوية البصرية للمشروع
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle,
  Download,
  Edit2,
  FileText,
  History as HistoryIcon,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
  XCircle,
  AlertTriangle,
  CircleDollarSign,
} from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import {
  getPolicy,
  cancelPolicy,
  deletePolicy,
  getClientPolicyHistory,
} from '../features/policies/policy-lifecycle.service';
import { getPolicyDocuments } from '../features/documents/document-lifecycle.service';
import { getDocumentTemporaryUrl } from '../features/documents/document.service';
import type { Policy, PolicyStatus } from '../types/insurance';
import type { DocumentRecord } from '../types/document';
import {
  POLICY_STATUS_LABELS,
  INSURANCE_LINE_LABELS,
} from '../types/insurance';
import RenewPolicyModal from '../features/policies/RenewPolicyModal';

// ============================================================
// أدوات مساعدة
// ============================================================

function formatDate(dateStr: string): string {
  if (!dateStr) return 'غير محدد';
  try {
    return new Date(dateStr).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatMoney(amount: number, currency = 'EGP'): string {
  return `${amount.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ${currency}`;
}

function daysUntil(dateStr: string): number {
  if (!dateStr) return 0;
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

// ============================================================
// مكونات فرعية
// ============================================================

function StatusBadge({ status }: { status: PolicyStatus }) {
  const tone =
    status === 'active' ? 'success' :
    status === 'pending' ? 'warning' :
    status === 'expired' ? 'danger' : 'neutral';

  return (
    <span className={`inx-badge inx-badge-${tone}`}>
      {POLICY_STATUS_LABELS[status]}
    </span>
  );
}

function InfoCard({
  icon,
  label,
  value,
  subtitle,
  tone = 'cyan',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  tone?: string;
}) {
  return (
    <article className="inx-kpi" style={{ textAlign: 'right' }}>
      <div className="inx-kpi-head">
        <span className={`inx-3d-icon sm tone-${tone}`}>{icon}</span>
      </div>
      <div className="inx-kpi-value" style={{ fontSize: '1.2rem', marginTop: '8px' }}>
        {value}
      </div>
      <small className="inx-kpi-label" style={{ fontSize: '0.9rem' }}>
        {label}
      </small>
      {subtitle && (
        <div style={{ fontSize: '0.75rem', color: 'var(--inx-muted)', marginTop: '4px' }}>
          {subtitle}
        </div>
      )}
    </article>
  );
}

// ============================================================
// المكون الرئيسي
// ============================================================

export default function PolicyDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [policy, setPolicy] = useState<Policy | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [history, setHistory] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'history'>('overview');
  const [actionLoading, setActionLoading] = useState(false);
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);
  const [documentActionError, setDocumentActionError] = useState('');

  // Dialogs state
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showRenewModal, setShowRenewModal] = useState(false);

  const loadData = useCallback(async () => {
    if (!id || !profile) return;
    setLoading(true);
    setError('');
    try {
      const policyData = await getPolicy(id);
      if (!policyData) {
        setError('البوليصة غير موجودة');
        setLoading(false);
        return;
      }
      setPolicy(policyData);

      try {
        const docs = await getPolicyDocuments(profile.organizationId, id);
        setDocuments(docs);
      } catch (e) {
        console.warn('Failed to load documents', e);
      }

      try {
        const hist = await getClientPolicyHistory(profile.organizationId, policyData.clientId);
        setHistory(hist);
      } catch (e) {
        console.warn('Failed to load history', e);
      }
    } catch (e) {
      console.error(e);
      setError('تعذر تحميل البوليصة');
    } finally {
      setLoading(false);
    }
  }, [id, profile]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function handleOpenPolicyDocument(record: DocumentRecord) {
    let popup: Window | null = null;
    setOpeningDocumentId(record.id);
    setDocumentActionError('');
    try {
      // Open the tab synchronously to avoid popup blockers while the gateway
      // generates a fresh signed URL for private Supabase objects.
      popup = window.open('about:blank', '_blank');
      if (popup) popup.opener = null;
      if (!popup) throw new Error('POPUP_BLOCKED');

      const url = await getDocumentTemporaryUrl(record);
      popup.location.replace(url);
    } catch (reason) {
      popup?.close();
      console.warn('Failed to open policy document', reason);
      const code = reason instanceof Error ? reason.message : '';
      setDocumentActionError(
        code.includes('POPUP_BLOCKED')
          ? 'المتصفح منع فتح نافذة المستند. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.'
          : code.includes('LEGACY_DOCUMENT_REQUIRES_MIGRATION')
            ? 'هذا المستند القديم يحتاج إلى مراجعة مسار التخزين قبل فتحه.'
            : 'تعذر فتح المستند. تحقق من صلاحيتك أو أعد المحاولة.',
      );
    } finally {
      setOpeningDocumentId(null);
    }
  }

  async function handleCancel() {
    if (!policy || !cancelReason.trim()) return;
    setActionLoading(true);
    try {
      await cancelPolicy(policy.id, cancelReason);
      await loadData();
      setShowCancelDialog(false);
      setCancelReason('');
    } catch (e) {
      alert('تعذر إلغاء البوليصة');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    if (!policy) return;
    if (!confirm('هل أنت متأكد من حذف البوليصة؟ لا يمكن التراجع.')) return;
    setActionLoading(true);
    try {
      await deletePolicy(policy.id);
      navigate('/policies');
    } catch (e) {
      alert('تعذر حذف البوليصة');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-empty" style={{ marginTop: 80 }}>
          <Loader2 className="animate-spin text-[var(--inx-blue)]" size={32} />
          <b>جاري تحميل البوليصة...</b>
        </div>
      </main>
    );
  }

  if (error || !policy) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-empty" style={{ marginTop: 80 }}>
          <AlertTriangle size={32} className="text-[var(--inx-danger)]" />
          <b>{error || 'البوليصة غير موجودة'}</b>
          <button onClick={() => navigate('/policies')} className="inx-btn inx-btn-secondary" style={{ marginTop: 16 }}>
            العودة للوثائق
          </button>
        </div>
      </main>
    );
  }

  const daysLeft = daysUntil(policy.expiryDate);
  const isExpiringSoon = daysLeft > 0 && daysLeft <= 30 && policy.status === 'active';
  const isExpired = daysLeft < 0 && policy.status === 'active';

  return (
    <main className="mobile-page" dir="rtl">
      <div className="inx-container">

        {/* Header */}
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0 16px', flexWrap: 'wrap' }}>
          <button onClick={() => navigate(-1)} className="inx-circle-btn" title="رجوع">
            <ArrowRight size={20} />
          </button>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--inx-text)' }}>
                {policy.policyNumber}
              </h2>
              <StatusBadge status={policy.status} />
              {isExpiringSoon && (
                <span className="inx-badge inx-badge-warning">⏰ تنتهي خلال {daysLeft} يوم</span>
              )}
              {isExpired && (
                <span className="inx-badge inx-badge-danger">⚠️ منتهية منذ {Math.abs(daysLeft)} يوم</span>
              )}
            </div>
            <small style={{ color: 'var(--inx-muted)', marginTop: 4, display: 'block' }}>
              {INSURANCE_LINE_LABELS[policy.line]} · {policy.product}
            </small>
          </div>
        </header>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {policy.status === 'active' && (
            <button onClick={() => setShowRenewModal(true)} className="inx-btn inx-btn-primary">
              <RefreshCw size={16} /> تجديد
            </button>
          )}
          <button onClick={() => navigate(`/policies/${policy.id}/edit`)} className="inx-btn inx-btn-secondary">
            <Edit2 size={16} /> تعديل
          </button>
          {policy.status === 'active' && (
            <button
              onClick={() => setShowCancelDialog(true)}
              className="inx-btn inx-btn-secondary"
              style={{ color: 'var(--inx-warning)' }}
            >
              <XCircle size={16} /> إلغاء
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={actionLoading}
            className="inx-btn inx-btn-secondary"
            style={{ color: 'var(--inx-danger)' }}
          >
            <Trash2 size={16} /> حذف
          </button>
        </div>

        {/* Info Cards */}
        <div className="inx-kpi-grid" style={{ marginBottom: 20 }}>
          <InfoCard
            icon={<UserRound size={18} />}
            label="العميل"
            value={policy.clientName || 'غير محدد'}
            tone="cyan"
          />
          <InfoCard
            icon={<Building2 size={18} />}
            label="شركة التأمين"
            value={policy.insurerName}
            tone="blue"
          />
          <InfoCard
            icon={<CircleDollarSign size={18} />}
            label="القسط"
            value={formatMoney(policy.premium, policy.currency)}
            subtitle={`العمولة: ${formatMoney(policy.commissionAmount, policy.currency)}`}
            tone="success"
          />
          <InfoCard
            icon={<CalendarDays size={18} />}
            label="تاريخ الانتهاء"
            value={formatDate(policy.expiryDate)}
            subtitle={
              daysLeft > 0 ? `متبقي ${daysLeft} يوم` :
              daysLeft < 0 ? `انتهت منذ ${Math.abs(daysLeft)} يوم` : 'تنتهي اليوم'
            }
            tone={isExpiringSoon ? 'warning' : isExpired ? 'danger' : 'neutral'}
          />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--inx-border)', marginBottom: 20, overflowX: 'auto' }}>
          {[
            { key: 'overview', label: 'نظرة عامة', icon: <ShieldCheck size={16} /> },
            { key: 'documents', label: `الوثائق (${documents.length})`, icon: <FileText size={16} /> },
            { key: 'history', label: 'سلسلة التجديد', icon: <HistoryIcon size={16} /> },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: activeTab === tab.key ? 'bold' : 'normal',
                color: activeTab === tab.key ? 'var(--inx-blue)' : 'var(--inx-muted)',
                borderBottom: activeTab === tab.key ? '2px solid var(--inx-blue)' : '2px solid transparent',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="inx-card" style={{ padding: 20, marginBottom: 40 }}>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 24 }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: 12, color: 'var(--inx-text)' }}>
                  معلومات الوثيقة
                </h3>
                <dl style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <DetailRow label="رقم الوثيقة" value={policy.policyNumber} />
                  <DetailRow label="النوع" value={INSURANCE_LINE_LABELS[policy.line]} />
                  <DetailRow label="المنتج" value={policy.product || '—'} />
                  <DetailRow label="تاريخ البداية" value={formatDate(policy.startDate)} />
                  <DetailRow label="تاريخ الانتهاء" value={formatDate(policy.expiryDate)} />
                </dl>
              </div>

              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: 12, color: 'var(--inx-text)' }}>
                  المعلومات المالية
                </h3>
                <dl style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <DetailRow label="القسط" value={formatMoney(policy.premium, policy.currency)} />
                  <DetailRow label="نسبة العمولة" value={`${policy.commissionRate}%`} />
                  <DetailRow label="مبلغ العمولة" value={formatMoney(policy.commissionAmount, policy.currency)} />
                  <DetailRow label="العملة" value={policy.currency} />
                </dl>
              </div>

              {policy.coverage && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: 8, color: 'var(--inx-text)' }}>
                    التغطية
                  </h3>
                  <div style={{ background: 'var(--inx-bg)', padding: 16, borderRadius: 'var(--inx-radius)', color: 'var(--inx-text)', whiteSpace: 'pre-wrap' }}>
                    {policy.coverage}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div>
              {documentActionError && (
                <div role="alert" className="client-documents-v804-error" style={{ marginBottom: 12 }}>
                  {documentActionError}
                </div>
              )}
              {documents.length === 0 ? (
                <div className="inx-empty">
                  <FileText size={32} />
                  <b>لا توجد وثائق مرتبطة</b>
                </div>
              ) : (
                <ul className="inx-list">
                  {documents.map((doc) => (
                    <li key={doc.id} className="inx-list-item">
                      <span className="inx-icon-circle tone-cyan"><FileText size={18} /></span>
                      <div className="inx-list-copy">
                        <b>{doc.name}</b>
                        <small>{doc.originalFileName} · {(doc.size / 1024).toFixed(1)} KB</small>
                      </div>
                      {doc.verified && <CheckCircle size={18} className="text-[var(--inx-success)]" />}
                      <button
                        type="button"
                        disabled={openingDocumentId === doc.id}
                        onClick={() => void handleOpenPolicyDocument(doc)}
                        aria-label={`فتح ${doc.name}`}
                        title={openingDocumentId === doc.id ? 'جارٍ فتح المستند...' : 'فتح المستند'}
                        className="inx-circle-btn"
                        style={{ marginRight: 8, opacity: openingDocumentId === doc.id ? 0.6 : 1 }}
                      >
                        {openingDocumentId === doc.id ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: 16, color: 'var(--inx-text)' }}>
                سلسلة التجديد
              </h3>
              {history.length === 0 ? (
                <div className="inx-empty">
                  <HistoryIcon size={32} />
                  <b>لا يوجد سجل تجديد لهذه الوثيقة</b>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {history.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        padding: 16,
                        border: `1px solid ${p.id === policy.id ? 'var(--inx-blue)' : 'var(--inx-border)'}`,
                        borderRadius: 'var(--inx-radius)',
                        background: p.id === policy.id ? 'var(--inx-blue-light)' : 'transparent',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 12,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <b style={{ color: 'var(--inx-text)' }}>{p.policyNumber}</b>
                          {p.id === policy.id && <span className="inx-badge inx-badge-info">الحالية</span>}
                        </div>
                        <small style={{ color: 'var(--inx-muted)', display: 'block', marginTop: 4 }}>
                          {formatDate(p.startDate)} — {formatDate(p.expiryDate)}
                        </small>
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <StatusBadge status={p.status} />
                        <div style={{ fontWeight: 'bold', marginTop: 4, fontSize: '0.9rem', color: 'var(--inx-text)' }}>
                          {formatMoney(p.premium, p.currency)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Cancel Dialog */}
      {showCancelDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div className="inx-card" style={{ width: '100%', maxWidth: 400, padding: 24 }}>
            <h3 style={{ fontWeight: 'bold', marginBottom: 12, color: 'var(--inx-text)' }}>إلغاء الوثيقة</h3>
            <p style={{ color: 'var(--inx-muted)', fontSize: '0.9rem', marginBottom: 16 }}>
              هل أنت متأكد من إلغاء الوثيقة {policy.policyNumber}؟
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="سبب الإلغاء (إلزامي)"
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 'var(--inx-radius)',
                border: '1px solid var(--inx-border)',
                background: 'var(--inx-bg)',
                color: 'var(--inx-text)',
                marginBottom: 16,
                fontFamily: 'inherit',
              }}
              rows={3}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCancelDialog(false)} className="inx-btn inx-btn-secondary">
                تراجع
              </button>
              <button
                onClick={handleCancel}
                disabled={!cancelReason.trim() || actionLoading}
                className="inx-btn inx-btn-primary"
                style={{ background: 'var(--inx-danger)' }}
              >
                {actionLoading ? 'جاري الإلغاء...' : 'تأكيد الإلغاء'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renew Modal */}
      {showRenewModal && (
        <RenewPolicyModal
          policy={policy}
          onClose={() => setShowRenewModal(false)}
          onSuccess={() => {
            setShowRenewModal(false);
            void loadData();
          }}
        />
      )}
    </main>
  );
}

// ============================================================
// مكون مساعد للصفوف
// ============================================================
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--inx-border)', paddingBottom: 8 }}>
      <span style={{ color: 'var(--inx-muted)', fontSize: '0.9rem' }}>{label}</span>
      <span style={{ fontWeight: 500, color: 'var(--inx-text)', fontSize: '0.9rem' }}>{value}</span>
    </div>
  );
}
