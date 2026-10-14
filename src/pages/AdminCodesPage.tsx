import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  Copy,
  KeyRound,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import {
  createBulkCodes,
  createCode,
  deleteCode,
  isCurrentUserAdmin,
  listCodes,
} from '../features/subscription/subscription.service';
import type { SubscriptionCode } from '../features/subscription/subscription.types';
import {
  computePricing,
  formatEGP,
} from '../features/admin/pricing.config';
import { listPlans } from '../features/admin/plans.service';
import type { PricingPlanDoc } from '../features/admin/plans.types';

type Filter = 'all' | 'unused' | 'used';

const FILTERS: Filter[] = ['all', 'unused', 'used'];
const FILTER_LABELS: Record<Filter, string> = {
  all: 'الكل',
  unused: 'غير مستخدمة',
  used: 'مستخدمة',
};

export default function AdminCodesPage() {
  const { user, profile } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [codes, setCodes] = useState<SubscriptionCode[]>([]);
  const [plans, setPlans] = useState<PricingPlanDoc[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState('5');
  const [planType, setPlanType] = useState<string>('monthly');
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const activePlans = useMemo(() => plans.filter((p) => p.isActive), [plans]);
  const selectedPlan = useMemo(
    () => activePlans.find((p) => p.id === planType),
    [activePlans, planType],
  );
  const preview = useMemo(
    () => (selectedPlan ? computePricing(selectedPlan.subtotal) : null),
    [selectedPlan],
  );

  useEffect(() => {
    if (!user?.uid) return;
    void isCurrentUserAdmin(user.uid).then(setAllowed);
  }, [user?.uid]);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await listPlans();
        setPlans(rows);
        if (rows.length > 0 && !rows.some((p) => p.id === planType)) {
          setPlanType(rows[0].id);
        }
      } catch (e) {
        console.error(e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      if (n === 1) {
        await createCode({
          planType,
          createdBy: user.uid,
          createdByName: profile?.displayName || '',
          notes: 'Single code',
        });
      } else {
        await createBulkCodes({
          count: n,
          planType,
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

  async function handleDelete(code: string) {
    if (!user) return;
    const ok = window.confirm(
      `حذف الكود ${code}؟\nسيُحفظ في الأرشيف بشكل دائم ويمكن استعادته لاحقًا.`,
    );
    if (!ok) return;

    setDeleting(code);
    try {
      await deleteCode(
        code,
        {
          uid: user.uid,
          name: profile?.displayName || 'Admin',
          email: user.email || undefined,
        },
        'حذف نهائي من صفحة الأكواد',
      );
      setCodes((prev) => prev.filter((c) => c.code !== code));
    } catch (e) {
      console.error(e);
      alert('فشل الحذف: ' + (e as Error).message);
    } finally {
      setDeleting(null);
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
          <div className="inx-empty"><b>جاري التحقق...</b></div>
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
              to="/admin-panel"
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

        <section className="inx-card inx-card-lg" style={{ marginBottom: 16 }}>
          <div className="inx-card-head">
            <h3>إنشاء أكواد جديدة</h3>
            <KeyRound size={18} style={{ color: 'var(--inx-muted)' }} />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 10,
              marginBottom: 12,
            }}
          >
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 12, color: 'var(--inx-muted)' }}>عدد الأكواد</span>
              <input
                type="number"
                min="1"
                max="50"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                style={inputStyle}
              />
            </label>

            <label style={{ display: 'grid', gap: 6, gridColumn: 'span 2' }}>
              <span style={{ fontSize: 12, color: 'var(--inx-muted)' }}>نوع الخطة</span>
              <select
                value={planType}
                onChange={(e) => setPlanType(e.target.value)}
                style={inputStyle}
              >
                {activePlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatEGP(p.subtotal)} / {p.duration} يوم
                  </option>
                ))}
              </select>
            </label>
          </div>

          {preview && (
            <div
              style={{
                background: 'var(--inx-navy-bg)',
                padding: 12,
                borderRadius: 'var(--inx-radius-sm)',
                marginBottom: 12,
                display: 'grid',
                gap: 4,
                fontSize: 13,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>السعر قبل الضريبة:</span>
                <b>{formatEGP(preview.subtotal)}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>ضريبة القيمة المضافة (14%):</span>
                <b>{formatEGP(preview.vatAmount)}</b>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid var(--inx-border)',
                  paddingTop: 4,
                  marginTop: 4,
                }}
              >
                <span>الإجمالي:</span>
                <b style={{ color: 'var(--inx-success)' }}>{formatEGP(preview.total)}</b>
              </div>
            </div>
          )}

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
              disabled={busy || !selectedPlan}
            >
              <Plus size={16} /> {busy ? 'جاري الإنشاء...' : `إنشاء ${count} كود`}
            </button>
            <button
              type="button"
              className="inx-btn inx-btn-secondary"
              onClick={() => void copyAllUnused()}
            >
              {copied === 'ALL' ? <Check size={16} /> : <Copy size={16} />} نسخ الأكواد غير
              المستخدمة
            </button>
          </div>
        </section>

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
                    c.status === 'unused' ? 'tone-success' : 'tone-primary'
                  }`}
                >
                  {c.status === 'unused' ? <KeyRound size={16} /> : <Check size={16} />}
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
                    <b style={{ fontFamily: 'monospace', fontSize: 14, letterSpacing: 1 }}>
                      {c.code}
                    </b>
                    <span
                      className={`inx-badge ${
                        c.status === 'unused' ? 'inx-badge-success' : 'inx-badge-primary'
                      }`}
                    >
                      {FILTER_LABELS[c.status as Filter] || c.status}
                    </span>
                    <span className="inx-badge inx-badge-neutral">
                      {c.planName || c.planType || '—'}
                    </span>
                  </div>
                  <small>
                    {c.duration} يوم · {formatEGP(c.subtotal)} + ضريبة{' '}
                    {formatEGP(c.vatAmount)} = <b>{formatEGP(c.total)}</b>
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
                        onClick={() => void handleDelete(c.code)}
                        title="حذف نهائي (يُحفظ في الأرشيف)"
                        disabled={deleting === c.code}
                      >
                        <Trash2
                          size={15}
                          style={{
                            color: 'var(--inx-danger)',
                            opacity: deleting === c.code ? 0.4 : 1,
                          }}
                        />
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