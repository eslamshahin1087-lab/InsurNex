import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CircleDollarSign,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import PolicyForm from '../features/policies/PolicyForm';
import {
  listPoliciesForOrganization,
  type RelatedPolicy,
} from '../features/relationships/relationship.service';

type Filter = 'all' | 'active' | 'pending' | 'expired' | 'cancelled';

const FILTERS: Filter[] = ['all', 'active', 'pending', 'expired', 'cancelled'];

const FILTER_LABELS: Record<Filter, string> = {
  all: 'الكل',
  active: 'نشطة',
  pending: 'قيد الإصدار',
  expired: 'منتهية',
  cancelled: 'ملغاة',
};

const LINE_LABELS: Record<string, string> = {
  medical: 'طبي',
  motor: 'سيارات',
  property: 'ممتلكات',
  marine: 'بحري',
  life: 'حياة',
  liability: 'مسؤوليات',
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

function lineLabel(line: string) {
  return LINE_LABELS[line] || line || 'فرع غير محدد';
}

function formatDate(value: string) {
  if (!value) return 'غير محدد';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export default function PoliciesPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<RelatedPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const loadPolicies = useCallback(async () => {
    if (!profile) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await listPoliciesForOrganization(profile.organizationId);
      setItems(data);
    } catch (errorValue) {
      console.error('Failed to load policies', errorValue);
      setError('تعذر تحميل الوثائق. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void loadPolicies();
  }, [loadPolicies]);

  const stats = useMemo(() => {
    const active = items.filter((item) => item.status === 'active').length;
    const pending = items.filter((item) => item.status === 'pending').length;
    const expired = items.filter((item) => item.status === 'expired').length;
    const totalPremium = items.reduce((sum, item) => sum + Number(item.premium || 0), 0);

    return {
      total: items.length,
      active,
      pending,
      expired,
      totalPremium,
    };
  }, [items]);

  const visible = useMemo(() => {
    const queryText = search.trim().toLowerCase();

    return items.filter((item) => {
      const statusMatches =
        filter === 'all' ||
        item.status === filter ||
        (filter === 'cancelled' && item.status === 'canceled');

      if (!statusMatches) return false;
      if (!queryText) return true;

      const searchableText = [
        item.policyNumber,
        item.clientName,
        item.insurerName,
        lineLabel(item.line),
        item.line,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(queryText);
    });
  }, [items, search, filter]);

  const portfolioCurrency = items[0]?.currency || 'EGP';

  return (
    <main className="mobile-page p20-page" dir="rtl">
      <header className="p20-heading">
        <div>
          <span className="eyebrow">Policy Management</span>
          <h1>الوثائق</h1>
          <p>إدارة المحفظة التأمينية وربط العميل بشركة التأمين والتغطية.</p>
        </div>

        <button
          className="floating-add"
          type="button"
          onClick={() => setShowCreate(true)}
          aria-label="إضافة وثيقة"
          title="إضافة وثيقة"
        >
          <Plus size={22} aria-hidden="true" />
        </button>
      </header>

      <section className="p20-stats" aria-label="ملخص الوثائق">
        <article>
          <span><WalletCards /></span>
          <small>الإجمالي</small>
          <b>{stats.total}</b>
        </article>

        <article>
          <span><ShieldCheck /></span>
          <small>نشطة</small>
          <b>{stats.active}</b>
        </article>

        <article>
          <span><CalendarDays /></span>
          <small>قيد الإصدار</small>
          <b>{stats.pending}</b>
        </article>

        <article>
          <span><CalendarDays /></span>
          <small>منتهية</small>
          <b>{stats.expired}</b>
        </article>
      </section>

      <section className="p20-tools">
        <div className="p20-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث برقم الوثيقة أو العميل أو شركة التأمين"
            aria-label="البحث في الوثائق"
          />
        </div>

        <div className="p20-filters" aria-label="تصفية الوثائق حسب الحالة">
          {FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? 'active' : ''}
              onClick={() => setFilter(item)}
            >
              {FILTER_LABELS[item]}
            </button>
          ))}
        </div>
      </section>

      <section className="p20-list-section">
        <header>
          <div>
            <h2>المحفظة</h2>
            <small>{visible.length} وثيقة</small>
          </div>
          <div className="p20-portfolio-total">
            <CircleDollarSign size={18} aria-hidden="true" />
            <span>إجمالي الأقساط</span>
            <strong>{formatMoney(stats.totalPremium, portfolioCurrency)}</strong>
          </div>
        </header>

        {error && (
          <div className="p20-empty" role="alert">
            <strong>{error}</strong>
            <button type="button" className="secondary-button" onClick={() => void loadPolicies()}>
              إعادة المحاولة
            </button>
          </div>
        )}

        {!error && loading && (
          <div className="p20-empty">جارٍ تحميل الوثائق...</div>
        )}

        {!error && !loading && visible.length === 0 && (
          <div className="p20-empty">
            <ShieldCheck size={28} aria-hidden="true" />
            <strong>{items.length === 0 ? 'لا توجد وثائق حتى الآن' : 'لا توجد وثائق مطابقة'}</strong>
            <p>
              {items.length === 0
                ? 'ابدأ بإضافة أول وثيقة إلى المحفظة التأمينية.'
                : 'جرّب تغيير البحث أو اختيار حالة أخرى.'}
            </p>
            {items.length === 0 && (
              <button type="button" className="primary-button" onClick={() => setShowCreate(true)}>
                <Plus size={18} aria-hidden="true" />
                إضافة وثيقة
              </button>
            )}
          </div>
        )}

        {!error && !loading && visible.length > 0 && (
          <div className="p20-list">
            {visible.map((policy) => (
              <article className="p20-card" key={policy.id}>
                <div className="p20-icon">
                  <ShieldCheck aria-hidden="true" />
                </div>

                <div className="p20-copy">
                  <div>
                    <b>{policy.policyNumber || 'وثيقة بدون رقم'}</b>
                    <span className={'p20-status st-' + policy.status}>
                      {statusLabel(policy.status)}
                    </span>
                  </div>

                  <strong>{policy.clientName || 'عميل غير محدد'}</strong>
                  <small>
                    {policy.insurerName || 'شركة غير محددة'} · {lineLabel(policy.line)}
                  </small>

                  <footer>
                    <span>
                      <UserRound aria-hidden="true" />
                      {policy.clientName || 'غير محدد'}
                    </span>
                    <span>
                      <CalendarDays aria-hidden="true" />
                      {formatDate(policy.expiryDate)}
                    </span>
                    <span>{formatMoney(policy.premium, policy.currency)}</span>
                  </footer>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {showCreate && (
        <PolicyForm
          onCancel={() => setShowCreate(false)}
          onDone={() => {
            setShowCreate(false);
            void loadPolicies();
          }}
        />
      )}
    </main>
  );
}
