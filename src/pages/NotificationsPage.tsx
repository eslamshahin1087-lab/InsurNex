import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, CheckCircle2, Search } from 'lucide-react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../features/auth/auth-context';

type Notice = {
  id: string;
  title?: string;
  message?: string;
  body?: string;
  type?: string;
  read?: boolean;
  isRead?: boolean;
  createdAt?: { toDate?: () => Date } | null;
};

type Filter = 'all' | 'unread' | 'read';

const FILTERS: Filter[] = ['all', 'unread', 'read'];
const FILTER_LABELS: Record<Filter, string> = {
  all: 'الكل',
  unread: 'غير مقروءة',
  read: 'مقروءة',
};

function text(n: Notice) {
  return n.message || n.body || '';
}
function isRead(n: Notice) {
  return Boolean(n.read || n.isRead);
}
function when(n: Notice) {
  const d = n.createdAt?.toDate?.();
  return d
    ? new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
    : '';
}

export default function NotificationsPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const q = query(
        collection(db, 'notifications'),
        where('organizationId', '==', profile.organizationId),
        limit(200),
      );
      const s = await getDocs(q);
      setItems(s.docs.map((d) => ({ id: d.id, ...d.data() } as Notice)));
    } catch {
      setError('تعذر تحميل الإشعارات.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = items.filter((n) => !isRead(n)).length;

  const visible = useMemo(() => {
    const t = search.trim().toLowerCase();
    return items.filter((n) => {
      const ok =
        filter === 'all' ||
        (filter === 'unread' && !isRead(n)) ||
        (filter === 'read' && isRead(n));
      if (!ok) return false;
      if (!t) return true;
      return `${n.title || ''} ${text(n)}`.toLowerCase().includes(t);
    });
  }, [items, search, filter]);

  return (
    <main className="mobile-page" dir="rtl">
      <div className="inx-container">
        <header className="inx-section-head" style={{ marginTop: 0 }}>
          <div>
            <span className="eyebrow">Notification Center</span>
            <h2>الإشعارات</h2>
            <small style={{ color: 'var(--inx-muted)' }}>
              آخر التحديثات والتنبيهات المهمة.
            </small>
          </div>
        </header>

        <div className="inx-kpi-grid" style={{ marginBottom: 16 }}>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-icon-circle"><Bell size={18} /></span>
            </div>
            <div className="inx-kpi-value">{items.length}</div>
            <small className="inx-kpi-label">إجمالي الإشعارات</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-icon-circle tone-danger"><BellRing size={18} /></span>
            </div>
            <div className="inx-kpi-value">{unread}</div>
            <small className="inx-kpi-label">غير مقروءة</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-icon-circle tone-success"><CheckCircle2 size={18} /></span>
            </div>
            <div className="inx-kpi-value">{items.length - unread}</div>
            <small className="inx-kpi-label">مقروءة</small>
          </article>
        </div>

        <div className="inx-card" style={{ marginBottom: 16, padding: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid var(--inx-border)',
              borderRadius: 'var(--inx-radius)',
              padding: '8px 12px',
              background: 'var(--inx-bg)',
              marginBottom: 12,
            }}
          >
            <Search size={18} style={{ color: 'var(--inx-muted)' }} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في الإشعارات"
              style={{
                flex: 1,
                border: 0,
                outline: 0,
                background: 'transparent',
                color: 'var(--inx-text)',
                fontSize: 13.5,
              }}
            />
          </div>
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

        {error && (
          <div className="inx-empty">
            <Bell size={28} />
            <b>{error}</b>
          </div>
        )}

        {!error && loading && <div className="inx-empty">جاري تحميل الإشعارات...</div>}

        {!error && !loading && visible.length === 0 && (
          <div className="inx-empty">
            <Bell size={28} />
            <b>لا توجد إشعارات مطابقة</b>
          </div>
        )}

        {!error && !loading && visible.length > 0 && (
          <ul className="inx-list">
            {visible.map((n) => (
              <li key={n.id}>
                <div className="inx-list-item">
                  <span className={`inx-icon-circle ${isRead(n) ? '' : 'tone-danger'}`}>
                    {isRead(n) ? <Bell size={18} /> : <BellRing size={18} />}
                  </span>
                  <div className="inx-list-copy">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <b style={{ marginBottom: 0 }}>{n.title || 'إشعار'}</b>
                      {!isRead(n) && <span className="inx-badge inx-badge-danger">جديد</span>}
                    </div>
                    <small>{text(n)}</small>
                    {when(n) && (
                      <div style={{ fontSize: 11.5, color: 'var(--inx-muted)', marginTop: 4 }}>
                        {when(n)}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}