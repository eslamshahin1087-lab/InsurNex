import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  FileClock,
  FileText,
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import ClaimForm from '../features/claims/ClaimForm';
import { listClaims } from '../features/claims/claim.service';
import type { Claim } from '../types/claim';

const STATUS_LABELS: Record<string, string> = {
  new: 'جديدة',
  documents: 'جمع المستندات',
  submitted: 'تم الإرسال',
  review: 'قيد المراجعة',
  additional_documents: 'مستندات إضافية',
  approved: 'مقبولة',
  settled: 'تمت التسوية',
  settlement: 'التسوية',
  rejected: 'مرفوضة',
  closed: 'مغلقة',
};

type ClaimFilter = 'all' | 'open' | 'approved' | 'rejected' | 'closed';

const FILTER_LABELS: Record<ClaimFilter, string> = {
  all: 'الكل',
  open: 'قيد المتابعة',
  approved: 'مقبولة',
  rejected: 'مرفوضة',
  closed: 'مغلقة',
};

const OPEN_STATUSES = new Set([
  'new',
  'documents',
  'submitted',
  'review',
  'additional_documents',
  'settlement',
]);

function statusLabel(status: string) {
  return STATUS_LABELS[status] || status || 'غير محدد';
}

function isOpenClaim(status: string) {
  return OPEN_STATUSES.has(status);
}

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('ar-EG', {
      style: 'currency',
      currency: currency || 'EGP',
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  } catch {
    return `${new Intl.NumberFormat('ar-EG').format(Number(value || 0))} ${currency || 'EGP'}`;
  }
}

function dateText(value?: string) {
  if (!value) return 'غير محدد';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export default function ClaimsPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Claim[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ClaimFilter>('all');
  const [loading, setLoading] = useState(true);
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
      setItems(await listClaims(profile.organizationId));
    } catch (errorValue) {
      console.error('Failed to load claims', errorValue);
      setItems([]);
      setError('تعذر تحميل المطالبات. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const open = items.filter((item) => isOpenClaim(item.status)).length;
    const approved = items.filter((item) => item.status === 'approved').length;
    const closed = items.filter((item) => item.status === 'closed').length;
    const rejected = items.filter((item) => item.status === 'rejected').length;
    const totalAmount = items.reduce((sum, item) => sum + Number(item.claimAmount || 0), 0);
    return { total: items.length, open, approved, closed, rejected, totalAmount };
  }, [items]);

  const visible = useMemo(() => {
    const text = search.trim().toLowerCase();

    return items.filter((claim) => {
      const filterMatch =
        filter === 'all' ||
        (filter === 'open' && isOpenClaim(claim.status)) ||
        (filter === 'approved' && claim.status === 'approved') ||
        (filter === 'rejected' && claim.status === 'rejected') ||
        (filter === 'closed' && claim.status === 'closed');

      if (!filterMatch) return false;
      if (!text) return true;

      return [claim.claimNumber, claim.clientName, claim.policyNumber, claim.insurerName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(text);
    });
  }, [items, search, filter]);

  const currency = items[0]?.currency || 'EGP';

  return (
    <main className="mobile-page claims-v2" dir="rtl">
      <header className="page-header claims-v2-header">
        <div>
          <span className="eyebrow">Claims Management</span>
          <h1>المطالبات</h1>
          <p>إدارة دورة المطالبة من الإخطار الأول وحتى المراجعة والتسوية والإغلاق.</p>
        </div>

        <button
          type="button"
          className="floating-add"
          onClick={() => setShowCreate(true)}
          aria-label="إضافة مطالبة"
          title="إضافة مطالبة"
        >
          <Plus size={22} aria-hidden="true" />
        </button>
      </header>

      <section className="claims-v2-kpis" aria-label="ملخص المطالبات">
        <article>
          <span><ClipboardCheck aria-hidden="true" /></span>
          <small>إجمالي المطالبات</small>
          <strong>{stats.total}</strong>
        </article>
        <article>
          <span><FileClock aria-hidden="true" /></span>
          <small>قيد المتابعة</small>
          <strong>{stats.open}</strong>
        </article>
        <article>
          <span><CheckCircle2 aria-hidden="true" /></span>
          <small>مقبولة</small>
          <strong>{stats.approved}</strong>
        </article>
        <article>
          <span><CircleDollarSign aria-hidden="true" /></span>
          <small>إجمالي قيمة المطالبات</small>
          <strong>{money(stats.totalAmount, currency)}</strong>
        </article>
      </section>

      <section className="claims-v2-tools">
        <div className="claims-v2-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث برقم المطالبة أو العميل أو الوثيقة أو شركة التأمين"
            aria-label="البحث في المطالبات"
          />
        </div>

        <div className="claims-v2-filters" aria-label="تصفية المطالبات">
          {(Object.keys(FILTER_LABELS) as ClaimFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? 'active' : ''}
              onClick={() => setFilter(item)}
            >
              {FILTER_LABELS[item]}
              {item === 'all' && <span>{stats.total}</span>}
              {item === 'open' && <span>{stats.open}</span>}
              {item === 'approved' && <span>{stats.approved}</span>}
              {item === 'rejected' && <span>{stats.rejected}</span>}
              {item === 'closed' && <span>{stats.closed}</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="claims-v2-list-section">
        <header className="section-heading">
          <div>
            <span className="eyebrow">Claim Portfolio</span>
            <h2>قائمة المطالبات</h2>
            <p>{visible.length} مطالبة في العرض الحالي</p>
          </div>
        </header>

        {error && (
          <div className="empty" role="alert">
            <AlertTriangle size={28} aria-hidden="true" />
            <strong>{error}</strong>
            <button type="button" className="secondary-button" onClick={() => void load()}>
              إعادة المحاولة
            </button>
          </div>
        )}

        {!error && loading && (
          <div className="empty">
            <ClipboardCheck size={28} aria-hidden="true" />
            <strong>جارٍ تحميل المطالبات...</strong>
          </div>
        )}

        {!error && !loading && visible.length === 0 && (
          <div className="empty">
            <ClipboardCheck size={28} aria-hidden="true" />
            <strong>{items.length === 0 ? 'لا توجد مطالبات حتى الآن' : 'لا توجد مطالبات مطابقة'}</strong>
            <p>{items.length === 0 ? 'ابدأ بإضافة أول مطالبة وربطها بوثيقة العميل.' : 'جرّب تغيير البحث أو فلتر الحالة.'}</p>
            {items.length === 0 && (
              <button type="button" className="primary-button" onClick={() => setShowCreate(true)}>
                <Plus size={18} aria-hidden="true" />
                إضافة مطالبة
              </button>
            )}
          </div>
        )}

        {!error && !loading && visible.length > 0 && (
          <div className="claims-v2-list">
            {visible.map((claim) => (
              <Link to={'/claims/' + claim.id} className="claims-v2-card" key={claim.id}>
                <div className="claims-v2-icon">
                  <ClipboardCheck size={22} aria-hidden="true" />
                </div>

                <div className="claims-v2-copy">
                  <div className="claims-v2-title-row">
                    <div>
                      <strong>{claim.claimNumber || 'مطالبة بدون رقم'}</strong>
                      <span>{claim.clientName || 'عميل غير محدد'}</span>
                    </div>
                    <span className={'claim-status status-' + claim.status}>
                      {statusLabel(claim.status)}
                    </span>
                  </div>

                  <div className="claims-v2-meta">
                    <span>
                      <ShieldCheck size={15} aria-hidden="true" />
                      {claim.policyNumber || 'وثيقة غير محددة'}
                    </span>
                    <span>
                      <FileText size={15} aria-hidden="true" />
                      {claim.insurerName || 'شركة التأمين غير محددة'}
                    </span>
                    <span>{dateText(claim.incidentDate)}</span>
                    <strong>{money(claim.claimAmount, claim.currency)}</strong>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {showCreate && (
        <ClaimForm
          onCancel={() => setShowCreate(false)}
          onDone={() => {
            setShowCreate(false);
            void load();
          }}
        />
      )}
    </main>
  );
}
