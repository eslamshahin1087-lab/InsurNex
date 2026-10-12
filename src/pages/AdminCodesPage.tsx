import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Copy,
  KeyRound,
  Plus,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import {
  createBulkCodes,
  createCode,
  isCurrentUserAdmin,
  listCodes,
  revokeCode,
} from '../features/subscription/subscription.service';
import type { SubscriptionCode } from '../features/subscription/subscription.types';

type Filter = 'all' | 'unused' | 'used' | 'revoked';

const FILTERS: Filter[] = ['all', 'unused', 'used', 'revoked'];
const FILTER_LABELS: Record<Filter, string> = {
  all: 'الكل',
  unused: 'غير مستخدمة',
  used: 'مستخدمة',
  revoked: 'ملغاة',
};

export default function AdminCodesPage() {
  const { user, profile } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [codes, setCodes] = useState<SubscriptionCode[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState('5');
  const [duration, setDuration] = useState('30');
  const [amount, setAmount] = useState('300');
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.uid) return;
    void isCurrentUserAdmin(user.uid).then(setAllowed);
  }, [user?.uid]);

  const load = useCallback(async () => {
    if (allowed !== true) return;
    setLoading(true);
    try {
      const rows = await listCodes({ status: filter, limitCount: 300 });
      setCodes(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [allowed, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleGenerate() {
    if (!user) return;
    setError('');
    setBusy(true);
    try {
      const n = Math.max(1, Math.min(50, Number(count) || 1));
      const d = Math.max(1, Math.min(365, Number(duration) || 30));
      const a = Math.max(1, Number(amount) || 300);

      if (n === 1) {
        await createCode({
          duration: d,
          amount: a,
          createdBy: user.uid,
          createdByName: profile?.displayName || '',
          notes: 'Single code',
        });
      } else {
        await createBulkCodes({
          count: n,
          duration: d,
          amount: a,
          createdBy: user.uid,
          createdByName: profile?.displayName || '',
          notes: `Bulk of ${n}`,
        });
      }
      await load();
    } catch (e) {
      console.error(e);
      setError('تعذر إنشاء الأكواد.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(code: string) {
    if (!window.confirm('إلغاء هذا الكود؟')) return;
    try {
      await revokeCode(code);
      setCodes((prev) =>
        prev.map((c) => (c.code === code ? { ...c, status: 'revoked' } : c)),
      );
    } catch (e) {
      console.error(e);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }

  async function copyAllUnused() {
    const unusedCodes = codes.filter((c) => c.status === 'unused').map((c) => c.code);
    if (!unusedCodes.length) return;
    try {
      await navigator.clipboard.writeText(unusedCodes.join('\n'));
      setCopied('ALL');
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }

  if (allowed === null) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-container">
          <div className="inx-empty">
            <b>جاري التحقق...</b>
          </div>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-container">
          <div className="inx-empty">
            <b>غير مصرح</b>
            <Link to="/" className="inx-btn inx-btn-secondary" style={{ marginTop: 8 }}>
              <ArrowLeft size={16} /> العودة
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mobile-page" dir="rtl">
      <div className="inx-container">
        {/* HEADER */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            padding: '4px 0 14px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <Link
              to="/admin"
              className="inx-link"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6 }}
            >
              <ArrowLeft size={16} /> لوحة التحكم
            </Link>
            <span className="eyebrow">Admin · Codes</span>
            <h2 style={{ margin: '2px 0 0', fontSize: 20, color: 'var(--inx-text)' }}>
              إدارة أكواد الاشتراك
            </h2>
          </div>
          <button
            type="button"
            className="inx-icon-btn"
            onClick={() => void load()}
            title="تحديث"
          >
            <RefreshCw size={16} />
          </button>
        </header>

        {/* GENERATOR */}
        <section className="inx-card inx-card-lg" style={{ marginBottom: 16 }}>
          <div className="inx-card-head">
            <h3>إنشاء أكواد جديدة</h3>
            <KeyRound size={18} style={{ color: 'var(--inx-muted)' }} />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--inx-muted)' }}>العدد</span>
              <input
                type="number"
                min="1"
                max="50"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--inx-muted)' }}>المدة (يوم)</span>
              <input
                type="number"
                min="1"
                max="365"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--inx-muted)' }}>السعر (ج.م)</span>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={inputStyle}
              />
            </label>
          </div>

          {error && (
            <div
              style={{
                background: 'var(--inx-danger-bg)',
                color: 'var(--inx-danger)',
                padding: '10px 12px',
                borderRadius: 'var(--inx-radius-sm)',
                fontSize: 12.5,
                marginBottom: 10,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="inx-btn inx-btn-primary"
              onClick={() => void handleGenerate()}
              disabled={busy}
            >
              <Plus size={16} /> {busy ? 'جاري الإنشاء...' : `إنشاء ${count} كود`}
            </button>
            <button
              type="button"
              className="inx-btn inx-btn-secondary"
              onClick={() => void copyAllUnused()}
            >
              {copied === 'ALL' ? <Check size={16} /> : <Copy size={16} />}
              نسخ الأكواد غير المستخدمة
            </button>
          </div>
        </section>

        {/* FILTERS */}
        <div className="inx-card" style={{ marginBottom: 16, padding: 12 }}>
          <div className="inx-chips">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={`inx-chip ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {/* LIST */}
        <div className="inx-section-head">
          <h2>قائمة الأكواد</h2>
          <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
            {codes.length} كود
          </small>
        </div>

        {loading ? (
          <div className="inx-empty">جاري التحميل...</div>
        ) : codes.length === 0 ? (
          <div className="inx-empty">
            <KeyRound size={28} />
            <b>لا توجد أكواد</b>
          </div>
        ) : (
          <ul className="inx-list">
            {codes.map((c) => (
              <li key={c.code} className="inx-list-item">
                <span
                  className={`inx-icon-circle ${
                    c.status === 'unused'
                      ? 'tone-success'
                      : c.status === 'used'
                      ? 'tone-primary'
                      : 'tone-neutral'
                  }`}
                >
                  {c.status === 'unused' ? (
                    <KeyRound size={16} />
                  ) : c.status === 'used' ? (
                    <Check size={16} />
                  ) : (
                    <XCircle size={16} />
                  )}
                </span>
                <div className="inx-list-copy">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 3,
                      flexWrap: 'wrap',
                    }}
                  >
                    <b
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 14,
                        letterSpacing: 1,
                      }}
                    >
                      {c.code}
                    </b>
                    <span
                      className={`inx-badge ${
                        c.status === 'unused'
                          ? 'inx-badge-success'
                          : c.status === 'used'
                          ? 'inx-badge-primary'
                          : 'inx-badge-neutral'
                      }`}
                    >
                      {FILTER_LABELS[c.status as Filter] || c.status}
                    </span>
                  </div>
                  <small>
                    {c.duration} يوم · {c.amount} {c.currency}
                    {c.usedBy?.userName ? ` · استخدمه: ${c.usedBy.userName}` : ''}
                  </small>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {c.status === 'unused' && (
                    <>
                      <button
                        type="button"
                        className="inx-icon-btn"
                        onClick={() => void copyCode(c.code)}
                        title="نسخ"
                      >
                        {copied === c.code ? (
                          <Check size={15} style={{ color: 'var(--inx-success)' }} />
                        ) : (
                          <Copy size={15} />
                        )}
                      </button>
                      <button
                        type="button"
                        className="inx-icon-btn"
                        onClick={() => void handleRevoke(c.code)}
                        title="إلغاء"
                      >
                        <Trash2 size={15} style={{ color: 'var(--inx-danger)' }} />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

const inputStyle = {
  padding: '9px 12px',
  border: '1px solid var(--inx-border)',
  borderRadius: 'var(--inx-radius-sm)',
  background: 'var(--inx-surface)',
  color: 'var(--inx-text)',
  fontSize: 14,
} as const;