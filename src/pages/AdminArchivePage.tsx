import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  Eye,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { isCurrentUserAdmin } from '../features/subscription/subscription.service';
import {
  listArchive,
  permanentlyDeleteArchive,
  restoreArchiveEntry,
} from '../features/admin/archive.service';
import type {
  ArchiveAction,
  ArchiveEntry,
  ArchiveType,
} from '../features/admin/archive.types';
import {
  ARCHIVE_ACTION_LABELS,
  ARCHIVE_TYPE_LABELS,
} from '../features/admin/archive.types';
import '../theme/admin-archive.css';

type TypeFilter = ArchiveType | 'all';
type ActionFilter = ArchiveAction | 'all';
type DaysFilter = 7 | 30 | 90 | 0;

const TYPE_FILTERS: TypeFilter[] = [
  'all',
  'code',
  'user',
  'subscription',
  'organization',
  'ad',
];
const ACTION_FILTERS: ActionFilter[] = ['all', 'deleted', 'revoked', 'suspended'];
const DAYS_FILTERS: { value: DaysFilter; label: string }[] = [
  { value: 7, label: 'آخر 7 أيام' },
  { value: 30, label: 'آخر 30 يوم' },
  { value: 90, label: 'آخر 90 يوم' },
  { value: 0, label: 'الكل' },
];

export default function AdminArchivePage() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [daysFilter, setDaysFilter] = useState<DaysFilter>(30);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<ArchiveEntry | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    void isCurrentUserAdmin(user.uid).then(setAllowed);
  }, [user?.uid]);

  const load = useCallback(async () => {
    if (allowed !== true) return;
    setLoading(true);
    try {
      const rows = await listArchive({
        type: typeFilter,
        action: actionFilter,
        daysBack: daysFilter,
        limitCount: 500,
      });
      setEntries(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [allowed, typeFilter, actionFilter, daysFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      const hay = [
        e.id,
        e.deletedByName,
        e.deletedByEmail,
        e.reason,
        e.sourceLabel,
        JSON.stringify(e.data).slice(0, 500),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [entries, search]);

  const kpis = useMemo(() => {
    const total = entries.length;
    const byType: Record<string, number> = {};
    entries.forEach((e) => {
      byType[e.type] = (byType[e.type] || 0) + 1;
    });
    const last30 = entries.filter((e) => {
      const v = e.deletedAt as { seconds?: number } | undefined;
      if (!v?.seconds) return false;
      return v.seconds * 1000 >= Date.now() - 30 * 86400000;
    }).length;
    return { total, last30, byType };
  }, [entries]);

  async function handleRestore(entry: ArchiveEntry) {
    if (!user) return;
    if (!window.confirm(`استعادة هذا العنصر؟`)) return;
    setBusy(true);
    try {
      const res = await restoreArchiveEntry(entry.id, user.uid);
      if (res.success) {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entry.id
              ? { ...e, restoredAt: new Date(), restoredBy: user.uid }
              : e,
          ),
        );
        setDetail(null);
      } else {
        alert('تعذر الاستعادة: ' + (res.error || 'خطأ غير معروف'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function handlePermanentDelete(entry: ArchiveEntry) {
    if (!window.confirm('حذف نهائي؟ لا يمكن التراجع.')) return;
    setBusy(true);
    try {
      await permanentlyDeleteArchive(entry.id);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      setDetail(null);
    } finally {
      setBusy(false);
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
              to="/admin-panel"
              className="inx-link"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6 }}
            >
              <ArrowLeft size={16} /> لوحة التحكم
            </Link>
            <span className="eyebrow">Admin · Archive</span>
            <h2 style={{ margin: '2px 0 0', fontSize: 20, color: 'var(--inx-text)' }}>
              الأرشيف
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

        {/* KPIs */}
        <section className="arc-section">
          <div className="admin-kpi-grid">
            <article className="admin-kpi">
              <span className="admin-kpi-icon tone-primary">
                <Archive size={20} />
              </span>
              <div className="admin-kpi-value">{kpis.total}</div>
              <div className="admin-kpi-label">إجمالي المؤرشفين</div>
            </article>
            <article className="admin-kpi">
              <div className="admin-kpi-value">{kpis.last30}</div>
              <div className="admin-kpi-label">آخر 30 يوم</div>
            </article>
            <article className="admin-kpi">
              <div className="admin-kpi-value">{kpis.byType.code || 0}</div>
              <div className="admin-kpi-label">أكواد</div>
            </article>
            <article className="admin-kpi">
              <div className="admin-kpi-value">
                {(kpis.byType.user || 0) +
                  (kpis.byType.subscription || 0) +
                  (kpis.byType.organization || 0)}
              </div>
              <div className="admin-kpi-label">مستخدمون واشتراكات</div>
            </article>
          </div>
        </section>

        {/* FILTERS */}
        <section className="arc-filters">
          <div className="arc-filters-row">
            <div className="arc-filter-group">
              <span className="arc-filter-label">النوع</span>
              <div className="inx-chips">
                {TYPE_FILTERS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`inx-chip ${typeFilter === t ? 'active' : ''}`}
                    onClick={() => setTypeFilter(t)}
                  >
                    {t === 'all' ? 'الكل' : ARCHIVE_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="arc-filters-row">
            <div className="arc-filter-group">
              <span className="arc-filter-label">العملية</span>
              <div className="inx-chips">
                {ACTION_FILTERS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`inx-chip ${actionFilter === a ? 'active' : ''}`}
                    onClick={() => setActionFilter(a)}
                  >
                    {a === 'all' ? 'الكل' : ARCHIVE_ACTION_LABELS[a]}
                  </button>
                ))}
              </div>
            </div>

            <div className="arc-filter-group">
              <span className="arc-filter-label">التاريخ</span>
              <div className="inx-chips">
                {DAYS_FILTERS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    className={`inx-chip ${daysFilter === d.value ? 'active' : ''}`}
                    onClick={() => setDaysFilter(d.value)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="arc-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="ابحث بالاسم، الكود، السبب..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} title="مسح">
                <X size={14} />
              </button>
            )}
          </div>
        </section>

        {/* LIST */}
        <section className="arc-section">
          <h3 className="arc-section-title">
            العناصر المؤرشفة ({filtered.length})
          </h3>
          {loading ? (
            <div className="inx-empty">جاري التحميل...</div>
          ) : filtered.length === 0 ? (
            <div className="inx-empty">
              <Archive size={28} />
              <b>لا توجد عناصر مؤرشفة</b>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>النوع</th>
                    <th>العملية</th>
                    <th>الملخص</th>
                    <th>الأدمن</th>
                    <th>التاريخ</th>
                    <th>الحالة</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <span className="arc-badge arc-badge-type">
                          {ARCHIVE_TYPE_LABELS[e.type] || e.type}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`arc-badge arc-badge-action action-${e.action}`}
                        >
                          {ARCHIVE_ACTION_LABELS[e.action] || e.action}
                        </span>
                      </td>
                      <td className="arc-summary">{summarize(e)}</td>
                      <td>
                        {e.deletedByName || e.deletedByEmail || e.deletedBy.slice(0, 8)}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--inx-muted)' }}>
                        {formatDate(e.deletedAt)}
                      </td>
                      <td>
                        {e.restoredAt ? (
                          <span className="arc-badge arc-badge-restored">مُستعاد</span>
                        ) : (
                          <span className="arc-badge arc-badge-pending">مؤرشف</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="inx-icon-btn"
                          onClick={() => setDetail(e)}
                          title="عرض التفاصيل"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* DETAIL MODAL */}
      {detail && (
        <div className="arc-modal-backdrop" onClick={() => setDetail(null)}>
          <div className="arc-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <div>
                <span className="eyebrow">تفاصيل العنصر المؤرشف</span>
                <h3>
                  {ARCHIVE_TYPE_LABELS[detail.type]} ·{' '}
                  {ARCHIVE_ACTION_LABELS[detail.action]}
                </h3>
              </div>
              <button type="button" onClick={() => setDetail(null)} title="إغلاق">
                <X size={18} />
              </button>
            </header>

            <div className="arc-modal-body">
              <div className="arc-meta-grid">
                <div>
                  <span>الأدمن</span>
                  <b>{detail.deletedByName || '—'}</b>
                </div>
                <div>
                  <span>البريد</span>
                  <b>{detail.deletedByEmail || '—'}</b>
                </div>
                <div>
                  <span>التاريخ</span>
                  <b>{formatDate(detail.deletedAt)}</b>
                </div>
                <div>
                  <span>المصدر</span>
                  <b>{detail.sourceLabel}</b>
                </div>
                <div>
                  <span>السبب</span>
                  <b>{detail.reason || '—'}</b>
                </div>
                <div>
                  <span>الحالة</span>
                  <b>{detail.restoredAt ? 'مُستعاد' : 'مؤرشف'}</b>
                </div>
              </div>

              <h4>البيانات الكاملة</h4>
              <pre className="arc-json">{JSON.stringify(detail.data, null, 2)}</pre>
            </div>

            <footer>
              {!detail.restoredAt && (
                <button
                  type="button"
                  className="inx-btn inx-btn-primary"
                  onClick={() => void handleRestore(detail)}
                  disabled={busy}
                >
                  <RotateCcw size={16} /> استعادة
                </button>
              )}
              <button
                type="button"
                className="inx-btn inx-btn-secondary"
                onClick={() => void handlePermanentDelete(detail)}
                disabled={busy}
                style={{ color: 'var(--inx-danger)' }}
              >
                <Trash2 size={16} /> حذف نهائي
              </button>
              <button
                type="button"
                className="inx-btn inx-btn-secondary"
                onClick={() => setDetail(null)}
              >
                إغلاق
              </button>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
}

// ============================================================
// HELPERS
// ============================================================

function formatDate(v: unknown): string {
  const t = v as { seconds?: number; toDate?: () => Date };
  let d: Date | undefined;
  if (t?.toDate) d = t.toDate();
  else if (typeof t?.seconds === 'number') d = new Date(t.seconds * 1000);
  if (!d) return '—';
  return new Intl.DateTimeFormat('ar-EG', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

function summarize(e: ArchiveEntry): string {
  const d = e.data;
  if (e.type === 'code') return String(d.code || '—');
  if (e.type === 'user') return String(d.displayName || d.email || d.uid || '—');
  if (e.type === 'subscription') return String(d.organizationId || '—');
  if (e.type === 'organization') return String(d.name || d.id || '—');
  if (e.type === 'ad') return String(d.title || d.id || '—');
  return e.id.slice(0, 12);
}