import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  CircleAlert,
  Clock3,
  FileText,
  ListTodo,
  Search,
  ShieldCheck,
  UserRound,
  WalletCards,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import {
  listRenewals2,
  type Renewal2Item,
  type RenewalStage,
} from '../features/renewals/renewal2.service';

const STAGES: RenewalStage[] = ['overdue', 'urgent', 'due30', 'due60', 'due90', 'later'];

const STAGE_LABELS: Record<RenewalStage, string> = {
  overdue: 'متأخرة',
  urgent: 'خلال 7 أيام',
  due30: 'خلال 30 يومًا',
  due60: 'خلال 60 يومًا',
  due90: 'خلال 90 يومًا',
  later: 'لاحقًا',
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

function lineLabel(value: string) {
  return LINE_LABELS[value] || value || 'فرع غير محدد';
}

function formatDate(value: string) {
  if (!value) return 'غير محدد';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('ar-EG', {
      style: 'currency',
      currency: currency || 'EGP',
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  } catch {
    return `${new Intl.NumberFormat('ar-EG').format(Number(value || 0))} ${currency || 'EGP'}`;
  }
}

function daysLabel(days: number) {
  if (days === Number.MAX_SAFE_INTEGER) return 'تاريخ غير صالح';
  if (days < 0) return `متأخرة ${Math.abs(days)} يوم`;
  if (days === 0) return 'تنتهي اليوم';
  if (days === 1) return 'متبقي يوم واحد';
  return `متبقي ${days} يوم`;
}

function stageIcon(stage: RenewalStage) {
  if (stage === 'overdue') return <CircleAlert aria-hidden="true" />;
  if (stage === 'urgent') return <AlertTriangle aria-hidden="true" />;
  if (stage === 'due30') return <Clock3 aria-hidden="true" />;
  return <CalendarDays aria-hidden="true" />;
}

export default function RenewalsPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Renewal2Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<RenewalStage | 'all'>('all');

  const load = useCallback(async () => {
    if (!profile) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      setItems(await listRenewals2(profile.organizationId));
    } catch (errorValue) {
      console.error('Failed to load renewals', errorValue);
      setError('تعذر تحميل بيانات التجديدات. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const next = Object.fromEntries(STAGES.map((item) => [item, 0])) as Record<RenewalStage, number>;
    items.forEach((item) => {
      next[item.stage] += 1;
    });
    return next;
  }, [items]);

  const visible = useMemo(() => {
    const text = search.trim().toLowerCase();
    return items.filter((item) => {
      if (stage !== 'all' && item.stage !== stage) return false;
      if (!text) return true;
      return [
        item.policyNumber,
        item.clientName,
        item.insurerName,
        item.line,
        lineLabel(item.line),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(text);
    });
  }, [items, search, stage]);

  const summary = useMemo(() => {
    const due90 = items.filter((item) => item.daysLeft >= 0 && item.daysLeft <= 90);
    const urgent = items.filter((item) => item.daysLeft >= 0 && item.daysLeft <= 7);
    const overdue = items.filter((item) => item.daysLeft < 0);
    const premiumAtRisk = [...overdue, ...due90].reduce((sum, item) => sum + Number(item.premium || 0), 0);
    return { due90: due90.length, urgent: urgent.length, overdue: overdue.length, premiumAtRisk };
  }, [items]);

  const currency = items[0]?.currency || 'EGP';

  return (
    <main className="mobile-page renewals-v2" dir="rtl">
      <header className="page-header renewals-v2-header">
        <div>
          <span className="eyebrow">Renewal Operations</span>
          <h1>التجديدات</h1>
          <p>مركز متابعة استباقي للوثائق المنتهية والقادمة للتجديد حسب درجة الأولوية.</p>
        </div>
        <Link to="/policies" className="secondary-button">
          <ShieldCheck size={18} aria-hidden="true" />
          الوثائق
        </Link>
      </header>

      <section className="renewal-kpis" aria-label="ملخص التجديدات">
        <article>
          <span><CircleAlert aria-hidden="true" /></span>
          <small>متأخرة</small>
          <strong>{summary.overdue}</strong>
        </article>
        <article>
          <span><AlertTriangle aria-hidden="true" /></span>
          <small>عاجلة خلال 7 أيام</small>
          <strong>{summary.urgent}</strong>
        </article>
        <article>
          <span><CalendarClock aria-hidden="true" /></span>
          <small>خلال 90 يومًا</small>
          <strong>{summary.due90}</strong>
        </article>
        <article>
          <span><WalletCards aria-hidden="true" /></span>
          <small>أقساط تحتاج متابعة</small>
          <strong>{formatMoney(summary.premiumAtRisk, currency)}</strong>
        </article>
      </section>

      <section className="renewal-tools">
        <div className="renewal-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث بالوثيقة أو العميل أو شركة التأمين"
            aria-label="البحث في التجديدات"
          />
        </div>

        <div className="renewal-stage-filters" aria-label="تصفية التجديدات">
          <button type="button" className={stage === 'all' ? 'active' : ''} onClick={() => setStage('all')}>
            الكل <span>{items.length}</span>
          </button>
          {STAGES.map((item) => (
            <button
              key={item}
              type="button"
              className={stage === item ? `active stage-${item}` : `stage-${item}`}
              onClick={() => setStage(item)}
            >
              {STAGE_LABELS[item]} <span>{counts[item]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="renewal-board">
        <header className="section-heading">
          <div>
            <span className="eyebrow">Renewal Queue</span>
            <h2>قائمة المتابعة</h2>
            <p>{visible.length} وثيقة في العرض الحالي</p>
          </div>
        </header>

        {error && (
          <div className="empty" role="alert">
            <AlertTriangle size={28} aria-hidden="true" />
            <strong>{error}</strong>
            <button type="button" className="secondary-button" onClick={() => void load()}>
              إعادة المحاولة
            </button>
          </div>
        )}

        {!error && loading && (
          <div className="empty">
            <CalendarClock size={28} aria-hidden="true" />
            <strong>جارٍ تحميل التجديدات...</strong>
          </div>
        )}

        {!error && !loading && visible.length === 0 && (
          <div className="empty">
            <CalendarDays size={28} aria-hidden="true" />
            <strong>{items.length === 0 ? 'لا توجد وثائق للتجديد' : 'لا توجد نتائج مطابقة'}</strong>
            <p>{items.length === 0 ? 'ستظهر هنا الوثائق التي تحتوي على تاريخ انتهاء صالح.' : 'جرّب تغيير البحث أو فلتر الأولوية.'}</p>
          </div>
        )}

        {!error && !loading && visible.length > 0 && (
          <div className="renewal-list">
            {visible.map((item) => (
              <article key={item.id} className={`renewal-card renewal-${item.stage}`}>
                <div className="renewal-priority-icon">{stageIcon(item.stage)}</div>

                <div className="renewal-card-main">
                  <div className="renewal-card-title">
                    <div>
                      <strong>{item.policyNumber || 'وثيقة بدون رقم'}</strong>
                      <span className={`renewal-stage stage-${item.stage}`}>{STAGE_LABELS[item.stage]}</span>
                    </div>
                    <b>{daysLabel(item.daysLeft)}</b>
                  </div>

                  <div className="renewal-client">
                    <UserRound size={16} aria-hidden="true" />
                    <strong>{item.clientName || 'عميل غير محدد'}</strong>
                  </div>

                  <div className="renewal-meta">
                    <span>{item.insurerName || 'شركة التأمين غير محددة'}</span>
                    <span>{lineLabel(item.line)}</span>
                    <span>الانتهاء: {formatDate(item.expiryDate)}</span>
                    <span>{formatMoney(item.premium, item.currency)}</span>
                  </div>

                  <footer className="renewal-actions">
                    {item.clientId && (
                      <Link to={'/clients/' + item.clientId}>
                        <UserRound size={15} aria-hidden="true" />
                        Client 360
                        <ChevronLeft size={15} aria-hidden="true" />
                      </Link>
                    )}
                    <Link to="/policies">
                      <FileText size={15} aria-hidden="true" />
                      الوثائق
                    </Link>
                    <Link to="/tasks">
                      <ListTodo size={15} aria-hidden="true" />
                      المهام
                    </Link>
                  </footer>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
