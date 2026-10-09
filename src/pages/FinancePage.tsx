import { useEffect, useMemo, useState } from 'react';
import { Wallet, TrendingUp, TrendingDown, Clock3 } from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import RevenuePanel from '../features/finance/RevenuePanel';
import ExpensesPanel from '../features/finance/ExpensesPanel';
import CommissionsPanel from '../features/finance/CommissionsPanel';
import {
  computeSummary,
  listCommissions,
  listExpenses,
  listRevenue,
} from '../features/finance/finance.service';
import type { FinanceSummary } from '../features/finance/finance.types';
import '../theme/finance.css';

type Tab = 'overview' | 'revenue' | 'expenses' | 'commissions';

export default function FinancePage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setLoadingSummary(true);
    (async () => {
      try {
        const [rev, exp, com] = await Promise.all([
          listRevenue(profile.organizationId),
          listExpenses(profile.organizationId),
          listCommissions(profile.organizationId),
        ]);
        if (!cancelled) setSummary(computeSummary(rev, exp, com));
      } catch {
        if (!cancelled) setSummary(null);
      } finally {
        if (!cancelled) setLoadingSummary(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.organizationId]);

  const cards = useMemo(() => {
    if (!summary) return [];
    return [
      {
        key: 'revenue',
        label: 'إجمالي الإيرادات',
        value: summary.totalRevenue,
        icon: TrendingUp,
        tone: 'good',
      },
      {
        key: 'expenses',
        label: 'إجمالي المصروفات',
        value: summary.totalExpenses,
        icon: TrendingDown,
        tone: 'bad',
      },
      {
        key: 'net',
        label: 'صافي الدخل',
        value: summary.netIncome,
        icon: Wallet,
        tone: summary.netIncome >= 0 ? 'good' : 'bad',
      },
      {
        key: 'pending',
        label: 'عمولات معلقة',
        value: summary.pendingCommissions,
        icon: Clock3,
        tone: 'warn',
      },
    ];
  }, [summary]);

  return (
    <main className="mobile-page finance-page" dir="rtl">
      <header className="page-header">
        <div>
          <span className="eyebrow">Financial Management</span>
          <h1>الإدارة المالية</h1>
          <p>الإيرادات، المصروفات، ومتابعة العمولات.</p>
        </div>
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
            <div className="fin-empty">لا توجد بيانات كافية لعرض الملخص.</div>
          ) : (
            <section className="fin-kpis">
              {cards.map(({ key, label, value, icon: Icon, tone }) => (
                <article key={key} className={`fin-kpi tone-${tone}`}>
                  <Icon size={20} />
                  <small>{label}</small>
                  <strong>{value.toLocaleString('ar-EG')} ج.م</strong>
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
    </main>
  );
}