import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Plus,
  Search,
  UserRound,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { listClients } from '../features/clients/client.service';
import ClientForm from '../features/clients/ClientForm';
import type { InsuranceClient } from '../types/client';

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
    case 'active':
      return 'نشط';
    case 'prospect':
      return 'محتمل';
    case 'inactive':
      return 'غير نشط';
    default:
      return status;
  }
}

function statusTone(status: string) {
  switch (status) {
    case 'active':
      return 'success';
    case 'prospect':
      return 'primary';
    case 'inactive':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export default function ClientsPage() {
  const { profile } = useAuth();
  const [clients, setClients] = useState<InsuranceClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
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

  const statistics = useMemo(
    () => ({
      total: clients.length,
      active: clients.filter((c) => c.status === 'active').length,
      prospect: clients.filter((c) => c.status === 'prospect').length,
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

  return (
    <main className="mobile-page" dir="rtl">
      <div className="inx-container">
        {/* ===== Header ===== */}
        <header className="inx-section-head" style={{ marginTop: 0 }}>
          <div>
            <span className="eyebrow">Insurance CRM</span>
            <h2>العملاء</h2>
            <small style={{ color: 'var(--inx-muted)' }}>
              إدارة عملاء المحفظة والعملاء المحتملين.
            </small>
          </div>
          <button
            type="button"
            className="inx-icon-btn filled"
            onClick={() => setShowCreate(true)}
            aria-label="إضافة عميل"
            title="إضافة عميل"
          >
            <Plus size={20} />
          </button>
        </header>

        {/* ===== KPIs ===== */}
        <div className="inx-kpi-grid" style={{ marginBottom: 16 }}>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-icon-circle">
                <Users size={18} />
              </span>
            </div>
            <div className="inx-kpi-value">{statistics.total}</div>
            <small className="inx-kpi-label">إجمالي العملاء</small>
          </article>

          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-icon-circle tone-success">
                <UserRound size={18} />
              </span>
            </div>
            <div className="inx-kpi-value">{statistics.active}</div>
            <small className="inx-kpi-label">عملاء نشطون</small>
          </article>

          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-icon-circle tone-warning">
                <Building2 size={18} />
              </span>
            </div>
            <div className="inx-kpi-value">{statistics.prospect}</div>
            <small className="inx-kpi-label">عملاء محتملون</small>
          </article>
        </div>

        {/* ===== Search + Filters ===== */}
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
              placeholder="ابحث بالاسم، الهاتف أو البريد"
              aria-label="بحث في العملاء"
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

        {/* ===== List ===== */}
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
            <b>لا توجد نتائج</b>
            <small>جرّب تغيير الفلاتر أو أضف عميلًا جديدًا.</small>
            <button
              type="button"
              className="inx-btn inx-btn-primary"
              onClick={() => setShowCreate(true)}
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
                <Link
                  to={`/clients/${client.id}`}
                  className="inx-list-item"
                >
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

      {showCreate && (
        <ClientForm
          onCancel={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            void loadClients();
          }}
        />
      )}
    </main>
  );
}