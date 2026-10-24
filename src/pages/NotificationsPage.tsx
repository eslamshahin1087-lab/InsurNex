import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  Moon,
  Search,
  Sun,
} from 'lucide-react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { useAuth } from '../features/auth/auth-context';
import { setCurrentContext } from '../features/copilot/copilot-context.store';
import { useTheme } from '../theme/ThemeProvider';
import MiniDonutChart from '../components/charts/MiniDonutChart';
import MiniBarChart from '../components/charts/MiniBarChart';

type Notice = {
  id: string;
  organizationId: string;
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
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
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

  useEffect(() => {
    setCurrentContext({
      page: 'notifications',
      stats: { totalLeads: items.length },
      notes: `The broker is viewing notifications (${items.length} total, ${unread} unread)`,
    });
  }, [items, unread]);

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

  const askCopilot = () => {
    navigate('/copilot', {
      state: {
        context: {
          page: 'notifications',
          stats: { totalLeads: items.length },
          notes: `The broker is viewing notifications (${items.length} total, ${unread} unread)`,
        },
      },
    });
  };

  const readSegments = [
    { label: 'غير مقروءة', value: unread, color: '#dc2626' },
    { label: 'مقروءة', value: items.length - unread, color: '#10b981' },
  ].filter((s) => s.value > 0);

  const typeCounts: Record<string, number> = {};
  items.forEach((n) => {
    const t = n.type || 'general';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });
  const typeBarData = Object.values(typeCounts).slice(0, 6);
  const typeBarLabels = Object.keys(typeCounts).slice(0, 6);

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
            <span className="eyebrow">Notification Center</span>
            <h2 style={{ margin: '2px 0 4px', fontSize: 20, color: 'var(--inx-text)' }}>
              الإشعارات
            </h2>
            <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
              آخر التحديثات والتنبيهات المهمة.
            </small>
          </div>
          <div className="inx-header-circular">
            <button
              type="button"
              className="inx-circle-btn"
              onClick={toggleTheme}
              title={resolvedTheme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
            >
              {resolvedTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              type="button"
              className="inx-circle-btn filled"
              onClick={askCopilot}
              title="مساعد InsurNex"
            >
              <Bell size={17} />
            </button>
          </div>
        </header>

        <div className="inx-kpi-grid" style={{ marginBottom: 16 }}>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-cyan">🔔</span>
            </div>
            <div className="inx-kpi-value">{items.length}</div>
            <small className="inx-kpi-label">إجمالي الإشعارات</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-danger">📬</span>
            </div>
            <div className="inx-kpi-value">{unread}</div>
            <small className="inx-kpi-label">غير مقروءة</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-success">✅</span>
            </div>
            <div className="inx-kpi-value">{items.length - unread}</div>
            <small className="inx-kpi-label">مقروءة</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-warning">📊</span>
            </div>
            <div className="inx-kpi-value">
              {items.length > 0 ? Math.round((unread / items.length) * 100) : 0}%
            </div>
            <small className="inx-kpi-label">نسبة غير المقروءة</small>
          </article>
        </div>

        {items.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <article className="inx-chart-card">
              <div className="chart-head">
                <span className="label">حالة القراءة</span>
                <span className="value">{items.length}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 14,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                }}
              >
                <MiniDonutChart
                  segments={
                    readSegments.length
                      ? readSegments
                      : [{ label: 'لا يوجد', value: 1, color: '#e3ebf5' }]
                  }
                  size={110}
                  thickness={14}
                  centerValue={String(unread)}
                  centerLabel="غير مقروءة"
                />
                <div className="inx-donut-legend" style={{ flex: 1, minWidth: 120 }}>
                  {readSegments.map((s) => (
                    <div className="legend-row" key={s.label}>
                      <span className="dot" style={{ background: s.color }} />
                      <span className="legend-label">{s.label}</span>
                      <span className="legend-value">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            {typeBarData.length > 0 && (
              <article className="inx-chart-card">
                <div className="chart-head">
                  <span className="label">أنواع الإشعارات</span>
                  <span className="delta up">↑ مباشر</span>
                </div>
                <div style={{ color: 'var(--inx-blue)' }}>
                  <MiniBarChart
                    data={typeBarData}
                    labels={typeBarLabels}
                    height={80}
                    color="var(--inx-blue)"
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 10,
                    color: 'var(--inx-muted)',
                  }}
                >
                  {typeBarLabels.slice(0, 4).map((l) => (
                    <span key={l}>{l}</span>
                  ))}
                </div>
              </article>
            )}
          </div>
        )}

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

        <div className="inx-section-head">
          <h2>قائمة الإشعارات</h2>
          <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
            {visible.length} إشعار
          </small>
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
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 3,
                      }}
                    >
                      <b style={{ marginBottom: 0 }}>{n.title || 'إشعار'}</b>
                      {!isRead(n) && (
                        <span className="inx-badge inx-badge-danger">جديد</span>
                      )}
                    </div>
                    <small>{text(n)}</small>
                    {when(n) && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: 'var(--inx-muted)',
                          marginTop: 4,
                        }}
                      >
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

