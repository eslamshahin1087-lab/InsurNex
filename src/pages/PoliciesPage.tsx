import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CalendarDays,
  CircleDollarSign,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import PolicyForm from '../features/policies/PolicyForm';
import {
  listPoliciesForOrganization,
  type RelatedPolicy,
} from '../features/relationships/relationship.service';
import { setCurrentContext } from '../features/copilot/copilot-context.store';

type Filter = 'all' | 'active' | 'pending' | 'expired' | 'cancelled';
const FILTERS: Filter[] = ['all', 'active', 'pending', 'expired', 'cancelled'];

const FILTER_LABELS: Record<Filter, string> = {
  all: 'الكل',
  active: 'سارية',
  pending: 'قيد الانتظار',
  expired: 'منتهية',
  cancelled: 'ملغاة',
};

const LINE_LABELS: Record<string, string> = {
  medical: 'طبي',
  motor: 'سيارات',
  property: 'ممتلكات',
  marine: 'بحري',
  life: 'حياة',
  liability: 'مسؤولية',
  other: 'أخرى',
};

function formatMoney(value: number, currency: string) {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat('ar-EG', {
      style: 'currency',
      currency: currency || 'EGP',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(amount)} ${currency || 'EGP'}`;
  }
}

function statusLabel(status: string) {
  if (status === 'cancelled' || status === 'canceled') return 'ملغاة';
  return FILTER_LABELS[status as Filter] || status || 'غير محدد';
}

function statusTone(status: string) {
  if (status === 'active') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'expired') return 'danger';
  if (status === 'cancelled' || status === 'canceled') return 'neutral';
  return 'neutral';
}

function lineLabel(line: string) {
  return LINE_LABELS[line] || line || 'نوع غير محدد';
}

function formatDate(value: string) {
  if (!value) return 'غير محدد';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

export default function PoliciesPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<RelatedPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const loadPolicies = useCallback(async () => {
    if (!profile) { setItems([]); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      setItems(await listPoliciesForOrganization(profile.organizationId));
    } catch (err) {
      console.error('Failed to load policies', err);
      setError('تعذر تحميل الوثائق. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { void loadPolicies(); }, [loadPolicies]);

  // ✅ Set context for FAB
  useEffect(() => {
    if (!items.length) return;
    setCurrentContext({
      page: 'policies',
      policies: items.slice(0, 20).map((p) => ({
        policyNumber: p.policyNumber,
        clientName: p.clientName,
        insurerName: p.insurerName,
        line: p.line,
        expiryDate: p.expiryDate,
        premium: p.premium,
        currency: p.currency,
        status: p.status,
      })),
      notes: `The broker is viewing the policies list (${items.length} total)`,
    });
  }, [items]);

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter((i) => i.status === 'active').length,
    pending: items.filter((i) => i.status === 'pending').length,
    expired: items.filter((i) => i.status === 'expired').length,
    totalPremium: items.reduce((s, i) => s + Number(i.premium || 0), 0),
  }), [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      const ok = filter === 'all' || i.status === filter || (filter === 'cancelled' && i.status === 'canceled');
      if (!ok) return false;
      if (!q) return true;
      return [i.policyNumber, i.clientName, i.insurerName, lineLabel(i.line), i.line]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [items, search, filter]);

  const currency = items[0]?.currency || 'EGP';

  const askCopilot = () => {
    navigate('/copilot', {
      state: {
        context: {
          page: 'policies',
          policies: items.slice(0, 20).map((p) => ({
            policyNumber: p.policyNumber,
            clientName: p.clientName,
            insurerName: p.insurerName,
            line: p.line,
            expiryDate: p.expiryDate,
            premium: p.premium,
            currency: p.currency,
            status: p.status,
          })),
          notes: `The broker is viewing the policies list (${items.length} total)`,
        },
      },
    });
  };

  return (
    <main className="mobile-page" dir="rtl">
      <div className="inx-container">
        <header className="inx-section-head" style={{ marginTop: 0 }}>
          <div>
            <span className="eyebrow">Policy Management</span>
            <h2>الوثائق</h2>
            <small style={{ color: 'var(--inx-muted)' }}>
              إدارة محفظة الوثائق التأمينية وتتبع حالتها.
            </small>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" className="inx-icon-btn filled" onClick={askCopilot} aria-label="اسأل المساعد">
              <Bot size={18} />
            </button>
            <button type="button" className="inx-icon-btn" onClick={() => setShowCreate(true)} aria-label="إضافة وثيقة">
              <Plus size={20} />
            </button>
          </div>
        </header>

        <div className="inx-kpi-grid" style={{ marginBottom: 16 }}>
          <article className="inx-kpi">
            <div className="inx-kpi-head"><span className="inx-icon-circle"><WalletCards size={18} /></span></div>
            <div className="inx-kpi-value">{stats.total}</div>
            <small className="inx-kpi-label">إجمالي الوثائق</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head"><span className="inx-icon-circle tone-success"><ShieldCheck size={18} /></span></div>
            <div className="inx-kpi-value">{stats.active}</div>
            <small className="inx-kpi-label">سارية</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head"><span className="inx-icon-circle tone-warning"><CalendarDays size={18} /></span></div>
            <div className="inx-kpi-value">{stats.pending}</div>
            <small className="inx-kpi-label">قيد الانتظار</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head"><span className="inx-icon-circle tone-danger"><CalendarDays size={18} /></span></div>
            <div className="inx-kpi-value">{stats.expired}</div>
            <small className="inx-kpi-label">منتهية</small>
          </article>
        </div>

        <div className="inx-card" style={{ marginBottom: 16, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--inx-border)', borderRadius: 'var(--inx-radius)', padding: '8px 12px', background: 'var(--inx-bg)', marginBottom: 12 }}>
            <Search size={18} style={{ color: 'var(--inx-muted)' }} />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث برقم الوثيقة، العميل، الشركة، نوع التغطية"
              style={{ flex: 1, border: 0, outline: 0, background: 'transparent', color: 'var(--inx-text)', fontSize: 13.5 }} />
          </div>
          <div className="inx-chips">
            {FILTERS.map((item) => (
              <button key={item} type="button" className={`inx-chip ${filter === item ? 'active' : ''}`} onClick={() => setFilter(item)}>
                {FILTER_LABELS[item]}
              </button>
            ))}
          </div>
        </div>

        <div className="inx-section-head">
          <h2>قائمة الوثائق</h2>
          <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
            {visible.length} وثيقة · {formatMoney(stats.totalPremium, currency)}
          </small>
        </div>

        {error && <div className="inx-empty"><ShieldCheck size={28} /><b>{error}</b>
          <button type="button" className="inx-btn inx-btn-secondary" onClick={() => void loadPolicies()}>إعادة المحاولة</button></div>}

        {!error && loading && <div className="inx-empty">جاري تحميل الوثائق...</div>}

        {!error && !loading && visible.length === 0 && (
          <div className="inx-empty">
            <ShieldCheck size={28} />
            <b>{items.length === 0 ? 'لا توجد وثائق مسجلة بعد' : 'لا توجد نتائج مطابقة'}</b>
            {items.length === 0 && (
              <button type="button" className="inx-btn inx-btn-primary" onClick={() => setShowCreate(true)} style={{ marginTop: 8 }}>
                <Plus size={16} /> إضافة وثيقة
              </button>
            )}
          </div>
        )}

        {!error && !loading && visible.length > 0 && (
          <ul className="inx-list">
            {visible.map((policy) => (
              <li key={policy.id}>
                <div className="inx-list-item">
                  <span className="inx-icon-circle tone-cyan"><ShieldCheck size={18} /></span>
                  <div className="inx-list-copy">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <b style={{ marginBottom: 0 }}>{policy.policyNumber || 'وثيقة'}</b>
                      <span className={`inx-badge inx-badge-${statusTone(policy.status)}`}>{statusLabel(policy.status)}</span>
                    </div>
                    <small style={{ marginBottom: 4 }}>{policy.clientName || 'عميل غير محدد'} · {policy.insurerName || 'شركة غير محددة'} · {lineLabel(policy.line)}</small>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 11.5, color: 'var(--inx-muted)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><UserRound size={12} />{policy.clientName || 'غير محدد'}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CalendarDays size={12} />{formatDate(policy.expiryDate)}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CircleDollarSign size={12} />{formatMoney(policy.premium, policy.currency)}</span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showCreate && (
        <PolicyForm onCancel={() => setShowCreate(false)} onDone={() => { setShowCreate(false); void loadPolicies(); }} />
      )}
    </main>
  );
}