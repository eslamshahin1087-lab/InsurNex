import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

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

type ClientFilter =
  | 'all'
  | 'active'
  | 'prospect'
  | 'inactive';

const filterLabels: Record<ClientFilter, string> = {
  all: 'الكل',
  active: 'نشط',
  prospect: 'محتمل',
  inactive: 'غير نشط',
};

function getInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return 'IN';
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return (
    words[0].charAt(0) +
    words[1].charAt(0)
  ).toUpperCase();
}

function getClientTypeLabel(type: string) {
  return type === 'company'
    ? 'شركة'
    : 'فرد';
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

export default function ClientsPage() {
  const { profile } = useAuth();

  const [clients, setClients] =
    useState<InsuranceClient[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [showCreate, setShowCreate] =
    useState(false);

  const [search, setSearch] =
    useState('');

  const [filter, setFilter] =
    useState<ClientFilter>('all');

  const loadClients = useCallback(
    async () => {
      if (!profile) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const data = await listClients(
          profile.organizationId,
        );

        setClients(data);
      } finally {
        setLoading(false);
      }
    },
    [profile],
  );

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const statistics = useMemo(
    () => ({
      total: clients.length,

      active: clients.filter(
        (client) =>
          client.status === 'active',
      ).length,

      prospect: clients.filter(
        (client) =>
          client.status === 'prospect',
      ).length,
    }),
    [clients],
  );

  const filteredClients = useMemo(
    () => {
      const query = search
        .trim()
        .toLowerCase();

      return clients.filter(
        (client) => {
          const matchesStatus =
            filter === 'all' ||
            client.status === filter;

          const searchableText = [
            client.name,
            client.phone,
            client.email,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          const matchesSearch =
            query === '' ||
            searchableText.includes(query);

          return (
            matchesStatus &&
            matchesSearch
          );
        },
      );
    },
    [
      clients,
      filter,
      search,
    ],
  );

  return (
    <main
      className="mobile-page s83-clients"
      dir="rtl"
    >
      <header className="s83-clients-header">
        <div>
          <span className="eyebrow">
            Insurance CRM
          </span>

          <h1>
            العملاء
          </h1>

          <p>
            إدارة علاقات العملاء
            والملفات التأمينية.
          </p>
        </div>

        <button
          type="button"
          className="floating-add"
          onClick={() =>
            setShowCreate(true)
          }
          aria-label="إضافة عميل"
          title="إضافة عميل"
        >
          <Plus size={22} />
        </button>
      </header>

      <section className="s83-client-overview">
        <article>
          <span className="s83-stat-icon blue">
            <Users size={19} />
          </span>

          <small>
            إجمالي العملاء
          </small>

          <strong>
            {statistics.total}
          </strong>
        </article>

        <article>
          <span className="s83-stat-icon cyan">
            <UserRound size={19} />
          </span>

          <small>
            نشطون
          </small>

          <strong>
            {statistics.active}
          </strong>
        </article>

        <article>
          <span className="s83-stat-icon amber">
            <Building2 size={19} />
          </span>

          <small>
            محتملون
          </small>

          <strong>
            {statistics.prospect}
          </strong>
        </article>
      </section>

      <section className="s83-client-tools">
        <div className="s83-client-search">
          <Search size={19} />

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="ابحث بالاسم أو الهاتف أو البريد"
            aria-label="البحث في العملاء"
          />
        </div>

        <div className="s83-client-filters">
          {(
            [
              'all',
              'active',
              'prospect',
              'inactive',
            ] as ClientFilter[]
          ).map((item) => (
            <button
              key={item}
              type="button"
              className={
                filter === item
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setFilter(item)
              }
            >
              {filterLabels[item]}
            </button>
          ))}
        </div>
      </section>

      <section className="s83-client-section">
        <div className="s83-section-heading">
          <div>
            <h2>
              قائمة العملاء
            </h2>

            <small>
              {filteredClients.length} عميل
            </small>
          </div>
        </div>

        {loading && (
          <div className="s83-empty-state">
            <span className="s83-empty-icon">
              <Users size={24} />
            </span>

            <strong>
              جارٍ تحميل العملاء...
            </strong>
          </div>
        )}

        {!loading &&
          filteredClients.length === 0 && (
            <div className="s83-empty-state">
              <span className="s83-empty-icon">
                <Users size={24} />
              </span>

              <strong>
                لا توجد نتائج
              </strong>

              <p>
                جرّب تغيير البحث أو الفلتر،
                أو أضف أول عميل.
              </p>

              <button
                type="button"
                className="primary-button"
                onClick={() =>
                  setShowCreate(true)
                }
              >
                <Plus size={18} />
                إضافة عميل
              </button>
            </div>
          )}

        {!loading &&
          filteredClients.length > 0 && (
            <div className="s83-client-list">
              {filteredClients.map(
                (client) => (
                  <Link
                    key={client.id}
                    to={`/clients/${client.id}`}
                    className="s83-client-card"
                  >
                    <div className="s83-client-avatar">
                      {getInitials(
                        client.name,
                      )}
                    </div>

                    <div className="s83-client-main">
                      <div className="s83-client-name-row">
                        <div>
                          <strong>
                            {client.name}
                          </strong>

                          <span>
                            {getClientTypeLabel(
                              client.type,
                            )}
                          </span>
                        </div>

                        <span
                          className={`s83-status s83-status-${client.status}`}
                        >
                          {getClientStatusLabel(
                            client.status,
                          )}
                        </span>
                      </div>

                      <div className="s83-client-contact">
                        {client.phone && (
                          <span>
                            <Phone size={13} />
                            {client.phone}
                          </span>
                        )}

                        {client.email && (
                          <span>
                            <Mail size={13} />
                            {client.email}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="s83-client-arrow">
                      <ArrowLeft size={18} />
                    </span>
                  </Link>
                ),
              )}
            </div>
          )}
      </section>

      {showCreate && (
        <ClientForm
          onCancel={() =>
            setShowCreate(false)
          }
          onCreated={() => {
            setShowCreate(false);
            void loadClients();
          }}
        />
      )}
    </main>
  );
}