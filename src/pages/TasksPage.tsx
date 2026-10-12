import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CalendarDays,
  ListTodo,
  Moon,
  Search,
  Sun,
  TriangleAlert,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../features/auth/auth-context';
import type { AppTask } from '../types/task';
import { setCurrentContext } from '../features/copilot/copilot-context.store';
import { useTheme } from '../theme/ThemeProvider';
import MiniDonutChart from '../components/charts/MiniDonutChart';
import MiniBarChart from '../components/charts/MiniBarChart';

type Filter = 'all' | 'open' | 'urgent' | 'completed';

const PRIORITY_LABELS: Record<string, string> = {
  low: 'منخفضة',
  medium: 'متوسطة',
  high: 'عالية',
  urgent: 'عاجلة',
};

function priorityTone(p: string) {
  if (p === 'urgent') return 'danger';
  if (p === 'high') return 'warning';
  if (p === 'medium') return 'primary';
  return 'neutral';
}

function dateLabel(v?: string) {
  if (!v) return 'بدون تاريخ';
  const d = new Date(v + 'T00:00:00');
  return Number.isNaN(d.getTime())
    ? v
    : new Intl.DateTimeFormat('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(d);
}

export default function TasksPage() {
  const { profile } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [items, setItems] = useState<AppTask[]>([]);
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
        collection(db, 'tasks'),
        where('organizationId', '==', profile.organizationId),
        limit(300),
      );
      const s = await getDocs(q);
      setItems(s.docs.map((d) => ({ id: d.id, ...d.data() } as AppTask)));
    } catch {
      setError('تعذر تحميل المهام.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!items.length) return;
    setCurrentContext({
      page: 'tasks',
      tasks: items.slice(0, 15).map((t) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate,
      })),
      stats: {
        totalLeads: items.length,
        wonLeads: items.filter((x) => x.status === 'completed').length,
      },
      notes: `The broker is viewing the tasks board (${items.length} tasks total)`,
    });
  }, [items]);

  const stats = useMemo(
    () => ({
      total: items.length,
      open: items.filter((x) => x.status !== 'completed').length,
      urgent: items.filter(
        (x) => x.status !== 'completed' && x.priority === 'urgent',
      ).length,
      completed: items.filter((x) => x.status === 'completed').length,
    }),
    [items],
  );

  const visible = useMemo(() => {
    const t = search.trim().toLowerCase();
    return items.filter((x) => {
      const ok =
        filter === 'all' ||
        (filter === 'open' && x.status !== 'completed') ||
        (filter === 'urgent' &&
          x.status !== 'completed' &&
          x.priority === 'urgent') ||
        (filter === 'completed' && x.status === 'completed');
      return ok && (!t || String(x.title || '').toLowerCase().includes(t));
    });
  }, [items, search, filter]);

  const FILTERS: Filter[] = ['all', 'open', 'urgent', 'completed'];
  const FILTER_LABELS: Record<Filter, string> = {
    all: 'الكل',
    open: 'قيد التنفيذ',
    urgent: 'عاجلة',
    completed: 'مكتملة',
  };

  const askCopilot = () => {
    navigate('/copilot', {
      state: {
        context: {
          page: 'tasks',
          tasks: items.slice(0, 15).map((t) => ({
            title: t.title,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate,
          })),
          notes: `The broker is viewing the tasks board (${items.length} tasks total)`,
        },
      },
    });
  };

  const prioritySegments = [
    {
      label: 'عاجلة',
      value: items.filter((x) => x.priority === 'urgent').length,
      color: '#dc2626',
    },
    {
      label: 'عالية',
      value: items.filter((x) => x.priority === 'high').length,
      color: '#f59e0b',
    },
    {
      label: 'متوسطة',
      value: items.filter((x) => x.priority === 'medium').length,
      color: '#2563eb',
    },
    {
      label: 'منخفضة',
      value: items.filter((x) => x.priority === 'low').length,
      color: '#94a3b8',
    },
  ].filter((s) => s.value > 0);

  const priorityBarData = [
    items.filter((x) => x.priority === 'urgent').length,
    items.filter((x) => x.priority === 'high').length,
    items.filter((x) => x.priority === 'medium').length,
    items.filter((x) => x.priority === 'low').length,
  ];

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
            <span className="eyebrow">Operations Center</span>
            <h2 style={{ margin: '2px 0 4px', fontSize: 20, color: 'var(--inx-text)' }}>
              المهام
            </h2>
            <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
              إدارة المهام وجدولة المتابعة اليومية.
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
              <Bot size={17} />
            </button>
          </div>
        </header>

        <div className="inx-kpi-grid" style={{ marginBottom: 16 }}>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-cyan">📝</span>
            </div>
            <div className="inx-kpi-value">{stats.total}</div>
            <small className="inx-kpi-label">إجمالي المهام</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-warning">⏳</span>
            </div>
            <div className="inx-kpi-value">{stats.open}</div>
            <small className="inx-kpi-label">قيد التنفيذ</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-danger">🚨</span>
            </div>
            <div className="inx-kpi-value">{stats.urgent}</div>
            <small className="inx-kpi-label">عاجلة</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-success">✅</span>
            </div>
            <div className="inx-kpi-value">{stats.completed}</div>
            <small className="inx-kpi-label">مكتملة</small>
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
                <span className="label">توزيع الأولويات</span>
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
                    prioritySegments.length
                      ? prioritySegments
                      : [{ label: 'لا يوجد', value: 1, color: '#e3ebf5' }]
                  }
                  size={110}
                  thickness={14}
                  centerValue={String(stats.total)}
                  centerLabel="مهمة"
                />
                <div className="inx-donut-legend" style={{ flex: 1, minWidth: 120 }}>
                  {prioritySegments.map((s) => (
                    <div className="legend-row" key={s.label}>
                      <span className="dot" style={{ background: s.color }} />
                      <span className="legend-label">{s.label}</span>
                      <span className="legend-value">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="inx-chart-card">
              <div className="chart-head">
                <span className="label">المهام حسب الأولوية</span>
                <span className="delta up">↑ مباشر</span>
              </div>
              <div style={{ color: 'var(--inx-blue)' }}>
                <MiniBarChart
                  data={priorityBarData}
                  labels={['عاجلة', 'عالية', 'متوسطة', 'منخفضة']}
                  height={80}
                  color="var(--inx-blue)"
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  color: 'var(--inx-muted)',
                }}
              >
                <span>عاجلة</span>
                <span>عالية</span>
                <span>متوسطة</span>
                <span>منخفضة</span>
              </div>
            </article>
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
              placeholder="ابحث في المهام"
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
          <h2>قائمة المهام</h2>
          <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
            {visible.length} مهمة
          </small>
        </div>

        {error && (
          <div className="inx-empty">
            <TriangleAlert size={28} />
            <b>{error}</b>
          </div>
        )}

        {!error && loading && <div className="inx-empty">جاري تحميل المهام...</div>}

        {!error && !loading && visible.length === 0 && (
          <div className="inx-empty">
            <ListTodo size={28} />
            <b>لا توجد مهام مطابقة</b>
          </div>
        )}

        {!error && !loading && visible.length > 0 && (
          <ul className="inx-list">
            {visible.map((t) => (
              <li key={t.id} className="inx-list-item">
                <span className={`inx-icon-circle tone-${priorityTone(t.priority)}`}>
                  <ListTodo size={18} />
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
                    <b style={{ marginBottom: 0 }}>{t.title}</b>
                    <span
                      className={`inx-badge inx-badge-${priorityTone(t.priority)}`}
                    >
                      {PRIORITY_LABELS[t.priority] || t.priority}
                    </span>
                  </div>
                  <small style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <CalendarDays size={12} />
                    {dateLabel(t.dueDate)}
                  </small>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: 'var(--inx-muted)',
                      marginTop: 2,
                    }}
                  >
                    {t.relatedType ? `مرتبطة بـ ${t.relatedType}` : 'مهمة عامة'}
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