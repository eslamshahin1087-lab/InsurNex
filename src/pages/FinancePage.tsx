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
  const [loadingSummary, setLoadingSummary] = useState(true);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setLoadingSummary(true);
    (async () => {
      try {
        const result = await loadFinanceSummary(profile.organizationId);
        if (!cancelled) setSummary(result);
      } catch (err) {
        console.error('Failed to load finance summary', err);
        if (!cancelled) setSummary(null);
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
      notes: `The broker is currently viewing the finance dashboard. Active tab: ${tab}. Financial totals are paginated across the full organization dataset and remain separated by currency; no foreign-exchange conversion is applied.`,
    });
  }, [summary, tab]);

  const cards = useMemo(() => {
    if (!summary) return [];
    return [
      {
        key: 'revenue',
        label: 'إجمالي الإيرادات',
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
        label: 'صافي الدخل',
        value: formatFinanceMetric(summary.currencies, 'netIncome'),
        icon: Wallet,
        tone: 'good',
      },
      {
        key: 'pending',
        label: 'عمولات معلقة',
        value: formatFinanceMetric(summary.currencies, 'pendingCommissions'),
        icon: Clock3,
        tone: 'warn',
      },
    ];
  }, [summary]);

  const askCopilot = () => {
    const financeData = summary
      ? {
          totalRevenue: summary.totalRevenue,
          totalExpenses: summary.totalExpenses,
          netIncome: summary.netIncome,
          pendingCommissions: summary.pendingCommissions,
          receivedCommissions: summary.receivedCommissions,
          currency: 'EGP',
        }
      : {
          totalRevenue: 0,
          totalExpenses: 0,
          netIncome: 0,
          pendingCommissions: 0,
          receivedCommissions: 0,
          currency: 'EGP',
        };

    navigate('/copilot', {
      state: {
        context: {
          page: 'finance',
          finance: financeData,
          notes: `The broker is currently viewing the finance dashboard. Active tab: ${tab}. The figures above are the exact current values from Firestore.`,
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
                لا توجد بيانات كافية لعرض الملخص. أضف إيرادات أو مصروفات أولًا.
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
              <h3>مصادر الإيراد</h3>
              <p>
                يتم تصنيف الإيرادات إلى: أقساط، عمولات، رسوم، ومتأخرات. يمكنك
                إدارة كل منها من تبويب <strong>الإيرادات</strong>.
              </p>
              <h3>متابعة العمولات</h3>
              <p>
                يسجل النظام العمولة المتوقعة لكل وثيقة، ويتيح تعليمها
                كمستلمة عند التحصيل الفعلي.
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