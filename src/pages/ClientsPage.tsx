import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Mail,
  Moon,
  Phone,
  Plus,
  Search,
  Sun,
  Users,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { listClients } from '../features/clients/client.service';
import type { InsuranceClient } from '../types/client';
import { setCurrentContext } from '../features/copilot/copilot-context.store';
import { useTheme } from '../theme/ThemeProvider';
import MiniDonutChart from '../components/charts/MiniDonutChart';
import MiniBarChart from '../components/charts/MiniBarChart';

type ClientFilter = 'all' | 'active' | 'prospect' | 'inactive';

const filterLabels: Record<ClientFilter, string> = {
  all: 'الكل',
  active: 'نشط',
  prospect: 'محتمل',
  inactive: 'غير نشط',
};

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'IN';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}

function getClientTypeLabel(type: string) {
  return type === 'company' ? 'شركة' : 'فرد';
}

function getClientStatusLabel(status: string) {
  switch (status) {
    case 'active': return 'نشط';
    case 'prospect': return 'محتمل';
    case 'inactive': return 'غير نشط';
    default: return status;
  }
}

function statusTone(status: string) {
  switch (status) {
    case 'active': return 'success';
    case 'prospect': return 'primary';
    case 'inactive': return 'neutral';
    default: return 'neutral';
  }
}

export default function ClientsPage() {
  const { profile } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [clients, setClients] = useState<InsuranceClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ClientFilter>('all');

  const loadClients = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await listClients(profile.organizationId);
      setClients(data);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  useEffect(() => {
    if (!clients.length) return;
    setCurrentContext({
      page: 'clients',
      notes: `The broker is viewing the clients list (${clients.length} clients). Breakdown: ${clients.filter((c) => c.status === 'active').length} active, ${clients.filter((c) => c.status === 'prospect').length} prospects, ${clients.filter((c) => c.status === 'inactive').length} inactive.`,
      stats: {
        totalClients: clients.length,
      },
    });
  }, [clients]);

  const statistics = useMemo(
    () => ({
      total: clients.length,
      active: clients.filter((c) => c.status === 'active').length,
      prospect: clients.filter((c) => c.status === 'prospect').length,
      inactive: clients.filter((c) => c.status === 'inactive').length,
      companies: clients.filter((c) => c.type === 'company').length,
      individuals: clients.filter((c) => c.type === 'individual').length,
    }),
    [clients],
  );

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clients.filter((client) => {
      const matchesStatus = filter === 'all' || client.status === filter;
      const searchableText = [client.name, client.phone, client.email]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const matchesSearch = query === '' || searchableText.includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [clients, filter, search]);

  const askCopilot = () => {
    navigate('/copilot', {
      state: {
        context: {
          page: 'clients',
          notes: `The broker is viewing the clients list (${clients.length} clients). Breakdown: ${statistics.active} active, ${statistics.prospect} prospects.`,
          stats: { totalClients: clients.length },
        },
      },
    });
  };

  const statusSegments = [
    { label: 'نشطون', value: statistics.active, color: '#10b981' },
    { label: 'محتملون', value: statistics.prospect, color: '#1E4272' },
    { label: 'غير نشطين', value: statistics.inactive, color: '#94a3b8' },
  ].filter((s) => s.value > 0);

  const typeBarData = [
    statistics.companies,
    statistics.individuals,
    statistics.active,
    statistics.prospect,
  ];

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
            <span className="eyebrow">Insurance CRM</span>
            <h2 style={{ margin: '2px 0 4px', fontSize: 20, color: 'var(--inx-text)' }}>
              العملاء
            </h2>
            <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
              إدارة العملاء الحاليين والمحتملين.
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
              title="اسأل InsurNex"
            >
              <Bot size={17} />
            </button>
            <button
              type="button"
              className="inx-circle-btn"
              onClick={() => navigate('/clients/new')}
              title="إضافة عميل جديد"
            >
              <Plus size={18} />
            </button>
          </div>
        </header>

        {/* KPI GRID */}
        <div className="inx-kpi-grid" style={{ marginBottom: 16 }}>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-cyan">👥</span>
            </div>
            <div className="inx-kpi-value">{statistics.total}</div>
            <small className="inx-kpi-label">إجمالي العملاء</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-success">✅</span>
            </div>
            <div className="inx-kpi-value">{statistics.active}</div>
            <small className="inx-kpi-label">عملاء نشطون</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-warning">🎯</span>
            </div>
            <div className="inx-kpi-value">{statistics.prospect}</div>
            <small className="inx-kpi-label">محتملون</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-purple">🏢</span>
            </div>
            <div className="inx-kpi-value">{statistics.companies}</div>
            <small className="inx-kpi-label">شركات</small>
          </article>
        </div>

        {/* CHARTS */}
        {clients.length > 0 && (
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
                <span className="label">توزيع العملاء</span>
                <span className="value">{statistics.total}</span>
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
                    statusSegments.length
                      ? statusSegments
                      : [{ label: 'لا يوجد', value: 1, color: '#e3ebf5' }]
                  }
                  size={110}
                  thickness={14}
                  centerValue={String(statistics.total)}
                  centerLabel="إجمالي"
                />
                <div className="inx-donut-legend" style={{ flex: 1, minWidth: 120 }}>
                  {statusSegments.map((s) => (
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
                <span className="label">مؤشرات التصنيف</span>
                <span className="delta up">↗ صاعد</span>
              </div>
              <div style={{ color: 'var(--inx-blue)' }}>
                <MiniBarChart
                  data={typeBarData}
                  labels={['شركات', 'أفراد', 'نشط', 'محتمل']}
                  height={80}
                  color="var(--inx-blue)"
                />
              </div>
            </article>
          </div>
        )}

        {/* SEARCH + FILTERS */}
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
              placeholder="ابحث بالاسم أو الجوال أو البريد"
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
            {(Object.keys(filterLabels) as ClientFilter[]).map((item) => (
              <button
                key={item}
                type="button"
                className={`inx-chip ${filter === item ? 'active' : ''}`}
                onClick={() => setFilter(item)}
              >
                {filterLabels[item]}
              </button>
            ))}
          </div>
        </div>

        {/* CLIENTS LIST */}
        <div className="inx-section-head">
          <h2>قائمة العملاء</h2>
          <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
            {filteredClients.length} عميل
          </small>
        </div>

        {loading && (
          <div className="inx-empty">
            <Users size={28} />
            <b>جاري تحميل العملاء...</b>
          </div>
        )}

        {!loading && filteredClients.length === 0 && (
          <div className="inx-empty">
            <Users size={28} />
            <b>لا يوجد عملاء</b>
            <small>اضغط زر + لإضافة عميل جديد بالنموذج الذكي.</small>
            <button
              type="button"
              className="inx-btn inx-btn-primary"
              onClick={() => navigate('/clients/new')}
              style={{ marginTop: 8 }}
            >
              <Plus size={16} /> إضافة عميل
            </button>
          </div>
        )}

        {!loading && filteredClients.length > 0 && (
          <ul className="inx-list">
            {filteredClients.map((client) => (
              <li key={client.id}>
                <Link to={`/clients/${client.id}`} className="inx-list-item">
                  <div className="inx-avatar">{getInitials(client.name)}</div>
                  <div className="inx-list-copy">
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 3,
                      }}
                    >
                      <b style={{ marginBottom: 0 }}>{client.name}</b>
                      <span
                        className={`inx-badge inx-badge-${statusTone(client.status)}`}
                      >
                        {getClientStatusLabel(client.status)}
                      </span>
                    </div>
                    <small style={{ marginBottom: 4 }}>
                      {getClientTypeLabel(client.type)}
                    </small>
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        fontSize: 11.5,
                        color: 'var(--inx-muted)',
                      }}
                    >
                      {client.phone && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Phone size={12} />
                          {client.phone}
                        </span>
                      )}
                      {client.email && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Mail size={12} />
                          {client.email}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowLeft size={16} className="inx-list-chevron" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}