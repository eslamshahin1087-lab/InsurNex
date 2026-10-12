import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  FileClock,
  FileText,
  Plus,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import ClaimForm from '../features/claims/ClaimForm';
import { listClaims } from '../features/claims/claim.service';
import type { Claim } from '../types/claim';
import { setCurrentContext } from '../features/copilot/copilot-context.store';

const STATUS_LABELS: Record<string, string> = {
  new: 'جديدة',
  documents: 'جمع المستندات',
  submitted: 'تم التقديم',
  review: 'قيد المراجعة',
  additional_documents: 'مستندات إضافية',
  approved: 'مقبولة',
  settled: 'تم التسوية',
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

const OPEN_STATUSES = new Set(['new', 'documents', 'submitted', 'review', 'additional_documents', 'settlement']);

function statusLabel(s: string) { return STATUS_LABELS[s] || s || 'غير محدد'; }

function statusTone(s: string) {
  if (s === 'approved' || s === 'settled') return 'success';
  if (s === 'rejected') return 'danger';
  if (s === 'closed') return 'neutral';
  if (OPEN_STATUSES.has(s)) return 'warning';
  return 'primary';
}

function isOpen(status: string) { return OPEN_STATUSES.has(status); }

function money(v: number, c: string) {
  try { return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: c || 'EGP', maximumFractionDigits: 0 }).format(Number(v || 0)); }
  catch { return `${new Intl.NumberFormat('ar-EG').format(Number(v || 0))} ${c || 'EGP'}`; }
}

function dateText(v?: string) {
  if (!v) return 'غير محدد';
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
}

export default function ClaimsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Claim[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ClaimFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!profile) { setItems([]); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      setItems(await listClaims(profile.organizationId));
    } catch (err) {
      console.error('Failed to load claims', err);
      setItems([]);
      setError('تعذر تحميل المطالبات. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { void load(); }, [load]);

  // ✅ Set context for FAB
  useEffect(() => {
    if (!items.length) return;
    setCurrentContext({
      page: 'claims',
      claims: items.slice(0, 15).map((c) => ({
        claimNumber: c.claimNumber,
        clientName: c.clientName,
        insurerName: c.insurerName,
        policyNumber: c.policyNumber,
        claimAmount: c.claimAmount,
        currency: c.currency,
        status: c.status,
        incidentDate: c.incidentDate,
      })),
      notes: `The broker is viewing the claims list (${items.length} total)`,
    });
  }, [items]);

  const stats = useMemo(() => ({
    total: items.length,
    open: items.filter((i) => isOpen(i.status)).length,
    approved: items.filter((i) => i.status === 'approved').length,
    closed: items.filter((i) => i.status === 'closed').length,
    rejected: items.filter((i) => i.status === 'rejected').length,
    totalAmount: items.reduce((s, i) => s + Number(i.claimAmount || 0), 0),
  }), [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((c) => {
      const ok =
        filter === 'all' ||
        (filter === 'open' && isOpen(c.status)) ||
        (filter === 'approved' && c.status === 'approved') ||
        (filter === 'rejected' && c.status === 'rejected') ||
        (filter === 'closed' && c.status === 'closed');
      if (!ok) return false;
      if (!q) return true;
      return [c.claimNumber, c.clientName, c.policyNumber, c.insurerName]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [items, search, filter]);

  const currency = items[0]?.currency || 'EGP';

  const askCopilot = () => {
    navigate('/copilot', {
      state: {
        context: {
          page: 'claims',
          claims: items.slice(0, 15).map((c) => ({
            claimNumber: c.claimNumber,
            clientName: c.clientName,
            insurerName: c.insurerName,
            policyNumber: c.policyNumber,
            claimAmount: c.claimAmount,
            currency: c.currency,
            status: c.status,
            incidentDate: c.incidentDate,
          })),
          notes: `The broker is viewing the claims list (${items.length} total)`,
        },
      },
    });
  };

  return (
    <main className="mobile-page" dir="rtl">
      <div className="inx-container">
        <header className="inx-section-head" style={{ marginTop: 0 }}>
          <div>
            <span className="eyebrow">Claims Management</span>
            <h2>المطالبات</h2>
            <small style={{ color: 'var(--inx-muted)' }}>إدارة دورة المطالبات حتى التسوية.</small>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="inx-icon-btn filled" onClick={askCopilot} aria-label="اسأل المساعد">
              <Bot size={18} />
            </button>
            <button type="button" className="inx-icon-btn" onClick={() => setShowCreate(true)} aria-label="إضافة مطالبة">
              <Plus size={20} />
            </button>
          </div>
        </header>

        <div className="inx-kpi-grid" style={{ marginBottom: 16 }}>
          <article className="inx-kpi">
            <div className="inx-kpi-head"><span className="inx-icon-circle"><ClipboardCheck size={18} /></span></div>
            <div className="inx-kpi-value">{stats.total}</div>
            <small className="inx-kpi-label">إجمالي المطالبات</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head"><span className="inx-icon-circle tone-warning"><FileClock size={18} /></span></div>
            <div className="inx-kpi-value">{stats.open}</div>
            <small className="inx-kpi-label">قيد المتابعة</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head"><span className="inx-icon-circle tone-success"><CheckCircle2 size={18} /></span></div>
            <div className="inx-kpi-value">{stats.approved}</div>
            <small className="inx-kpi-label">مقبولة</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head"><span className="inx-icon-circle tone-cyan"><CircleDollarSign size={18} /></span></div>
            <div className="inx-kpi-value" style={{ fontSize: 16 }}>{money(stats.totalAmount, currency)}</div>
            <small className="inx-kpi-label">إجمالي قيمة المطالبات</small>
          </article>
        </div>

        <div className="inx-card" style={{ marginBottom: 16, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--inx-border)', borderRadius: 'var(--inx-radius)', padding: '8px 12px', background: 'var(--inx-bg)', marginBottom: 12 }}>
            <Search size={18} style={{ color: 'var(--inx-muted)' }} />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث برقم المطالبة، العميل، الوثيقة، الشركة"
              style={{ flex: 1, border: 0, outline: 0, background: 'transparent', color: 'var(--inx-text)', fontSize: 13.5 }} />
          </div>
          <div className="inx-chips">
            {(Object.keys(FILTER_LABELS) as ClaimFilter[]).map((item) => (
              <button key={item} type="button" className={`inx-chip ${filter === item ? 'active' : ''}`} onClick={() => setFilter(item)}>
                {FILTER_LABELS[item]}
              </button>
            ))}
          </div>
        </div>

        <div className="inx-section-head">
          <h2>قائمة المطالبات</h2>
          <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>{visible.length} مطالبة</small>
        </div>

        {error && <div className="inx-empty"><AlertTriangle size={28} /><b>{error}</b>
          <button type="button" className="inx-btn inx-btn-secondary" onClick={() => void load()}>إعادة المحاولة</button></div>}

        {!error && loading && <div className="inx-empty"><ClipboardCheck size={28} /><b>جاري تحميل المطالبات...</b></div>}

        {!error && !loading && visible.length === 0 && (
          <div className="inx-empty">
            <ClipboardCheck size={28} />
            <b>{items.length === 0 ? 'لا توجد مطالبات مسجلة' : 'لا توجد نتائج مطابقة'}</b>
            {items.length === 0 && (
              <button type="button" className="inx-btn inx-btn-primary" onClick={() => setShowCreate(true)} style={{ marginTop: 8 }}>
                <Plus size={16} /> إضافة مطالبة
              </button>
            )}
          </div>
        )}

        {!error && !loading && visible.length > 0 && (
          <ul className="inx-list">
            {visible.map((claim) => (
              <li key={claim.id}>
                <Link to={`/claims/${claim.id}`} className="inx-list-item">
                  <span className={`inx-icon-circle tone-${statusTone(claim.status)}`}>
                    <ClipboardCheck size={18} />
                  </span>
                  <div className="inx-list-copy">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <b style={{ marginBottom: 0 }}>{claim.claimNumber || 'مطالبة'}</b>
                      <span className={`inx-badge inx-badge-${statusTone(claim.status)}`}>{statusLabel(claim.status)}</span>
                    </div>
                    <small>{claim.clientName || 'عميل غير محدد'} · {claim.policyNumber || 'وثيقة غير محددة'} · {claim.insurerName || 'شركة غير محددة'}</small>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11.5, color: 'var(--inx-muted)', marginTop: 4 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ShieldCheck size={12} />{claim.policyNumber || 'وثيقة غير محددة'}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><FileText size={12} />{claim.insurerName || 'شركة غير محددة'}</span>
                      <span>{dateText(claim.incidentDate)}</span>
                      <strong style={{ color: 'var(--inx-navy)' }}>{money(claim.claimAmount, claim.currency)}</strong>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showCreate && (
        <ClaimForm onCancel={() => setShowCreate(false)} onDone={() => { setShowCreate(false); void load(); }} />
      )}
    </main>
  );
}