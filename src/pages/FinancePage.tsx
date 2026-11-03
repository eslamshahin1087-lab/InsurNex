import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock3,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import RevenuePanel from '../features/finance/RevenuePanel';
import ExpensesPanel from '../features/finance/ExpensesPanel';
import CommissionsPanel from '../features/finance/CommissionsPanel';
import { loadFinanceSummary } from '../features/finance/finance.service';
import { formatFinanceMetric } from '../features/finance/financial-metrics';
import type { FinanceSummary } from '../features/finance/finance.types';
import { setCurrentContext } from '../features/copilot/copilot-context.store';
import '../theme/finance.css';

type Tab = 'overview' | 'revenue' | 'expenses' | 'commissions';

export default function FinancePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [summaryLoadedAt, setSummaryLoadedAt] = useState<Date | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(true);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setLoadingSummary(true);
    setSummaryError('');
    setSummaryLoadedAt(null);
    (async () => {
      try {
        const result = await loadFinanceSummary(profile.organizationId);
        if (!cancelled) {
          setSummary(result);
          setSummaryLoadedAt(new Date());
        }
      } catch (err) {
        console.error('Failed to load finance summary', err);
        if (!cancelled) {
          setSummary(null);
          setSummaryError('تعذر تحميل الملخص المالي بالكامل. تحقق من الاتصال والصلاحيات ثم أعد المحاولة.');
        }
      } finally {
        if (!cancelled) setLoadingSummary(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.organizationId]);

  // ✅ Set context for FAB — always sends, with neutral notes
  useEffect(() => {
    const financeData = summary?.currencies.length === 1
      ? {
          totalRevenue: summary.currencies[0].totalRevenue,
          totalExpenses: summary.currencies[0].totalExpenses,
          netIncome: summary.currencies[0].netIncome,
          pendingCommissions: summary.currencies[0].pendingCommissions,
          receivedCommissions: summary.currencies[0].receivedCommissions,
          currency: summary.currencies[0].currency,
        }
      : { currency: summary?.currencies.length ? 'MULTI_CURRENCY' : 'UNSPECIFIED' };

    setCurrentContext({
      page: 'finance',
      finance: financeData,
      notes: `The broker is currently viewing the finance dashboard. Active tab: ${tab}. Brokerage revenue excludes recorded premium volume and outstanding receivables. All metrics are paginated across the full organization dataset and grouped by currency; no foreign-exchange conversion is applied.`,
    });
  }, [summary, tab]);

  const cards = useMemo(() => {
    if (!summary) return [];
    return [
      {
        key: 'premiums',
        label: 'الأقساط المسجلة',
        value: formatFinanceMetric(summary.currencies, 'grossPremiums'),
        icon: Wallet,
        tone: 'neutral',
      },
      {
        key: 'revenue',
        label: 'إيرادات الوساطة والرسوم',
        value: formatFinanceMetric(summary.currencies, 'totalRevenue'),
        icon: TrendingUp,
        tone: 'good',
      },
      {
        key: 'expenses',
        label: 'إجمالي المصروفات',
        value: formatFinanceMetric(summary.currencies, 'totalExpenses'),
        icon: TrendingDown,
        tone: 'bad',
      },
      {
        key: 'net',
        label: 'صافي دخل الوساطة',
        value: formatFinanceMetric(summary.currencies, 'netIncome'),
        icon: Wallet,
        tone: 'neutral',
      },
      {
        key: 'pending',
        label: 'عمولات شركات التأمين المعلقة',
        value: formatFinanceMetric(summary.currencies, 'pendingCommissions'),
        icon: Clock3,
        tone: 'warn',
      },
      {
        key: 'received',
        label: 'عمولات شركات التأمين المحصلة',
        value: formatFinanceMetric(summary.currencies, 'receivedCommissions'),
        icon: TrendingUp,
        tone: 'good',
      },
    ];
  }, [summary]);

  const askCopilot = () => {
    const onlyCurrency = summary?.currencies.length === 1 ? summary.currencies[0] : undefined;
    const financeData = onlyCurrency
      ? {
          totalRevenue: onlyCurrency.totalRevenue,
          totalExpenses: onlyCurrency.totalExpenses,
          netIncome: onlyCurrency.netIncome,
          pendingCommissions: onlyCurrency.pendingCommissions,
          receivedCommissions: onlyCurrency.receivedCommissions,
          currency: onlyCurrency.currency,
        }
      : { currency: summary?.currencies.length ? 'MULTI_CURRENCY' : 'UNSPECIFIED' };

    navigate('/copilot', {
      state: {
        context: {
          page: 'finance',
          finance: financeData,
          notes: `The finance dashboard contains ${summary?.currencies.length || 0} currency bucket(s). No foreign-exchange conversion is applied; mixed-currency totals are intentionally not combined.`,
        },
      },
    });
  };

  return (
    <main className="mobile-page finance-page" dir="rtl">
      <div className="inx-container">
        <header className="inx-section-head" style={{ marginTop: 0 }}>
          <div>
            <span className="eyebrow">Financial Management</span>
            <h2>الإدارة المالية</h2>
            <small style={{ color: 'var(--inx-muted)' }}>
              الإيرادات، المصروفات، ومتابعة العمولات.
            </small>
          </div>
          <button
            type="button"
            className="inx-icon-btn filled"
            onClick={askCopilot}
            aria-label="اسأل المساعد"
          >
            <Bot size={18} />
          </button>
        </header>

        <nav className="fin-tabs" role="tablist">
          {(
            [
              ['overview', 'نظرة عامة'],
              ['revenue', 'الإيرادات'],
              ['expenses', 'المصروفات'],
              ['commissions', 'العمولات'],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? 'active' : ''}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === 'overview' && (
          <>
            {loadingSummary ? (
              <div className="fin-empty">جاري الحساب...</div>
            ) : !summary ? (
              <div className="fin-empty">
                {summaryError || 'لا توجد بيانات مالية مسجلة بعد.'}
              </div>
            ) : (
              <section className="fin-kpis">
                {cards.map(({ key, label, value, icon: Icon, tone }) => (
                  <article key={key} className={`fin-kpi tone-${tone}`}>
                    <Icon size={20} />
                    <small>{label}</small>
                    <strong dir="auto">{value}</strong>
                  </article>
                ))}
              </section>
            )}

            <section className="fin-info">
              <h3>نطاق البيانات وجودتها</h3>
              <p>
                يشمل الملخص جميع القيود المسجلة في المؤسسة عبر صفحات قراءة متتابعة؛
                ولا يتم جمع العملات المختلفة أو إجراء تحويل عملات. عدد القيود:
                الإيرادات {summary.recordCounts.revenue}، المصروفات {summary.recordCounts.expenses}،
                والعمولات {summary.recordCounts.commissions}.
                {summaryLoadedAt ? ` آخر تحديث: ${summaryLoadedAt.toLocaleString('ar-EG')}.` : ''}
              </p>
              {(summary.dataQuality.invalidAmountRows > 0
                || summary.dataQuality.missingOrInvalidCurrencyRows > 0
                || summary.dataQuality.unclassifiedRevenueRows > 0) && (
                <p className="fin-error">
                  تنبيه جودة البيانات: {summary.dataQuality.invalidAmountRows} قيود بقيم غير صالحة،
                  {summary.dataQuality.missingOrInvalidCurrencyRows} قيود بعملة غير محددة،
                  و{summary.dataQuality.unclassifiedRevenueRows} قيود إيراد غير مصنفة؛
                  لم تُحتسب القيم غير الصالحة أو الإيرادات غير المصنفة ضمن الإيراد.
                </p>
              )}
              <h3>تعريف المؤشرات</h3>
              <p>
                الأقساط المسجلة تمثل حجم الأقساط المدخلة وليست دخل الوسيط.
                إيراد الوساطة يشمل قيود العمولات والرسوم المؤكدة فقط؛ والمتأخرات والعمولات
                المستحقة من شركات التأمين معروضة بصورة مستقلة، ولا تمثل تحصيلًا نقديًا حتى
                تأكيد استلامها.
              </p>
            </section>
          </>
        )}

        {tab === 'revenue' && <RevenuePanel />}
        {tab === 'expenses' && <ExpensesPanel />}
        {tab === 'commissions' && <CommissionsPanel />}
      </div>
    </main>
  );
}