import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  Calendar,
  Download,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../features/auth/auth-context';
import { isCurrentUserAdmin } from '../features/subscription/subscription.service';
import {
  exportTransactionsToCSV,
  getExpiringSoon,
  getFinanceOverview,
  getMonthlyRevenue,
  getRecentTransactions,
  getTopPayingOrganizations,
} from '../features/admin/finance.service';
import type {
  ExpiringSubscription,
  FinanceOverview,
  MonthlyRevenue,
  TopPayingOrg,
  Transaction,
} from '../features/admin/finance.types';
import { formatEGP, formatNumber } from '../features/admin/pricing.config';
import '../theme/admin-finance.css';

const PLAN_COLORS: Record<string, string> = {
  monthly: '#1E4272',
  yearly: '#3A6B9F',
  yearly_discount: '#D4A017',
  trial: '#8DA0B8',
};

export default function AdminFinancePage() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRevenue[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [topOrgs, setTopOrgs] = useState<TopPayingOrg[]>([]);
  const [expiring, setExpiring] = useState<ExpiringSubscription[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    void isCurrentUserAdmin(user.uid).then(setAllowed);
  }, [user?.uid]);

  async function load() {
    if (allowed !== true) return;
    setLoading(true);
    try {
      const [ov, mv, tx, top, exp] = await Promise.all([
        getFinanceOverview(),
        getMonthlyRevenue(6),
        getRecentTransactions(20),
        getTopPayingOrganizations(10),
        getExpiringSoon(30),
      ]);
      setOverview(ov);
      setMonthly(mv);
      setTransactions(tx);
      setTopOrgs(top);
      setExpiring(exp);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  if (allowed === null) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-container">
          <div className="inx-empty">
            <b>جاري التحقق...</b>
          </div>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-container">
          <div className="inx-empty">
            <b>غير مصرح</b>
            <Link to="/" className="inx-btn inx-btn-secondary" style={{ marginTop: 8 }}>
              <ArrowLeft size={16} /> العودة
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const planDistribution = transactions.reduce(
    (acc, t) => {
      const key = t.planType || 'monthly';
      acc[key] = (acc[key] || 0) + t.total;
      return acc;
    },
    {} as Record<string, number>,
  );
  const pieData = Object.entries(planDistribution).map(([plan, value]) => ({
    name: plan,
    value: Math.round(value * 100) / 100,
  }));

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
            <Link
              to="/admin-panel"
              className="inx-link"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6 }}
            >
              <ArrowLeft size={16} /> لوحة التحكم
            </Link>
            <span className="eyebrow">Admin · Finance</span>
            <h2 style={{ margin: '2px 0 0', fontSize: 20, color: 'var(--inx-text)' }}>
              الماليات والتقارير
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="inx-btn inx-btn-secondary"
              onClick={() => exportTransactionsToCSV(transactions)}
              disabled={transactions.length === 0}
            >
              <Download size={16} /> تصدير CSV
            </button>
            <button
              type="button"
              className="inx-icon-btn"
              onClick={() => void load()}
              title="تحديث"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </header>

        {loading ? (
          <div className="inx-empty">جاري تحميل البيانات المالية...</div>
        ) : overview ? (
          <>
            {/* REVENUE KPIs */}
            <section className="fin-section">
              <h3 className="fin-section-title">الإيرادات</h3>
              <div className="admin-kpi-grid">
                <article className="admin-kpi">
                  <span className="admin-kpi-icon tone-success">
                    <Banknote size={20} />
                  </span>
                  <div className="admin-kpi-value">{formatEGP(overview.totalRevenue)}</div>
                  <div className="admin-kpi-label">إجمالي الإيرادات</div>
                  <div className="fin-kpi-sub">
                    قبل الضريبة: {formatEGP(overview.totalSubtotal)} · VAT:{' '}
                    {formatEGP(overview.totalVat)}
                  </div>
                </article>

                <article className="admin-kpi">
                  <span className="admin-kpi-icon tone-primary">
                    <Calendar size={20} />
                  </span>
                  <div className="admin-kpi-value">{formatEGP(overview.thisMonthRevenue)}</div>
                  <div className="admin-kpi-label">إيرادات هذا الشهر</div>
                  <div
                    className={`fin-kpi-trend ${
                      overview.monthlyChange >= 0 ? 'up' : 'down'
                    }`}
                  >
                    {overview.monthlyChange >= 0 ? (
                      <TrendingUp size={12} />
                    ) : (
                      <TrendingDown size={12} />
                    )}
                    {overview.monthlyChange >= 0 ? '+' : ''}
                    {overview.monthlyChange}% عن الشهر السابق
                  </div>
                </article>

                <article className="admin-kpi">
                  <span className="admin-kpi-icon tone-warning">
                    <TrendingUp size={20} />
                  </span>
                  <div className="admin-kpi-value">{formatEGP(overview.lastMonthRevenue)}</div>
                  <div className="admin-kpi-label">إيرادات الشهر السابق</div>
                </article>

                <article className="admin-kpi">
                  <span className="admin-kpi-icon tone-purple">
                    <Users size={20} />
                  </span>
                  <div className="admin-kpi-value">{formatEGP(overview.arpu)}</div>
                  <div className="admin-kpi-label">متوسط الإيراد / مؤسسة</div>
                </article>
              </div>
            </section>

            {/* SUBSCRIPTION KPIs */}
            <section className="fin-section">
              <h3 className="fin-section-title">الاشتراكات</h3>
              <div className="admin-kpi-grid">
                <article className="admin-kpi">
                  <div className="admin-kpi-value" style={{ color: 'var(--inx-success)' }}>
                    {overview.activeSubscriptions}
                  </div>
                  <div className="admin-kpi-label">اشتراكات نشطة</div>
                </article>
                <article className="admin-kpi">
                  <div className="admin-kpi-value" style={{ color: 'var(--inx-warning)' }}>
                    {overview.trialSubscriptions}
                  </div>
                  <div className="admin-kpi-label">تجارب مجانية</div>
                </article>
                <article className="admin-kpi">
                  <div className="admin-kpi-value" style={{ color: 'var(--inx-danger)' }}>
                    {overview.expiredSubscriptions}
                  </div>
                  <div className="admin-kpi-label">منتهية</div>
                </article>
                <article className="admin-kpi">
                  <div className="admin-kpi-value" style={{ color: 'var(--inx-info)' }}>
                    {overview.expiringSoon}
                  </div>
                  <div className="admin-kpi-label">تنتهي خلال 30 يوم</div>
                </article>
              </div>
            </section>

            {/* CODES KPIs */}
            <section className="fin-section">
              <h3 className="fin-section-title">الأكواد</h3>
              <div className="admin-kpi-grid">
                <article className="admin-kpi">
                  <div className="admin-kpi-value">{formatNumber(overview.usedCodes)}</div>
                  <div className="admin-kpi-label">أكواد مستخدمة</div>
                </article>
                <article className="admin-kpi">
                  <div className="admin-kpi-value">{formatNumber(overview.unusedCodes)}</div>
                  <div className="admin-kpi-label">أكواد متاحة</div>
                  <div className="fin-kpi-sub">
                    قيمة محتملة: {formatEGP(overview.unusedValuePotential)}
                  </div>
                </article>
                <article className="admin-kpi">
                  <div className="admin-kpi-value">{formatNumber(overview.revokedCodes)}</div>
                  <div className="admin-kpi-label">أكواد ملغاة</div>
                </article>
                <article className="admin-kpi">
                  <div className="admin-kpi-value">
                    {formatNumber(overview.suspendedSubscriptions)}
                  </div>
                  <div className="admin-kpi-label">اشتراكات موقوفة</div>
                </article>
              </div>
            </section>

            {/* CHARTS */}
            <section className="fin-section">
              <h3 className="fin-section-title">الرسوم البيانية — آخر 6 أشهر</h3>
              <div className="fin-charts-grid">
                <div className="fin-chart-card">
                  <h4>الإيرادات الشهرية</h4>
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart
                      data={monthly}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1E4272" stopOpacity={0.6} />
                          <stop offset="100%" stopColor="#1E4272" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--inx-border)" />
                      <XAxis dataKey="monthLabel" stroke="var(--inx-muted)" fontSize={12} />
                      <YAxis stroke="var(--inx-muted)" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--inx-surface)',
                          border: '1px solid var(--inx-border)',
                          borderRadius: 8,
                        }}
                        formatter={(v) => formatEGP(Number(v ?? 0))}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#1E4272"
                        strokeWidth={2}
                        fill="url(#revenueGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="fin-chart-card">
                  <h4>توزيع الخطط</h4>
                  {pieData.length === 0 ? (
                    <div className="fin-empty-chart">لا توجد بيانات كافية</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={4}
                        >
                          {pieData.map((entry) => (
                            <Cell
                              key={entry.name}
                              fill={PLAN_COLORS[entry.name] || '#8DA0B8'}
                            />
                          ))}
                        </Pie>
                        <Legend />
                        <Tooltip formatter={(v) => formatEGP(Number(v ?? 0))} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="fin-chart-card" style={{ gridColumn: '1 / -1' }}>
                  <h4>عدد المعاملات الشهرية</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--inx-border)" />
                      <XAxis dataKey="monthLabel" stroke="var(--inx-muted)" fontSize={12} />
                      <YAxis stroke="var(--inx-muted)" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--inx-surface)',
                          border: '1px solid var(--inx-border)',
                          borderRadius: 8,
                        }}
                      />
                      <Bar dataKey="transactions" fill="#3A6B9F" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            {/* RECENT TRANSACTIONS */}
            <section className="fin-section">
              <h3 className="fin-section-title">آخر المعاملات</h3>
              <div className="admin-table-wrap">
                {transactions.length === 0 ? (
                  <div className="fin-empty-table">لا توجد معاملات بعد</div>
                ) : (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>الكود</th>
                        <th>الخطة</th>
                        <th>قبل الضريبة</th>
                        <th>الضريبة</th>
                        <th>الإجمالي</th>
                        <th>المؤسسة</th>
                        <th>المستخدم</th>
                        <th>التاريخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t) => (
                        <tr key={t.code}>
                          <td
                            className="mono"
                            style={{ fontFamily: 'monospace', fontSize: 12 }}
                          >
                            {t.code}
                          </td>
                          <td>{t.planName || t.planType}</td>
                          <td>{formatEGP(t.subtotal)}</td>
                          <td>{formatEGP(t.vatAmount)}</td>
                          <td>
                            <b>{formatEGP(t.total)}</b>
                          </td>
                          <td>{t.organizationName || '—'}</td>
                          <td>{t.userName || '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--inx-muted)' }}>
                            {t.usedAt ? t.usedAt.toLocaleDateString('ar-EG') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            {/* TWO COLUMNS */}
            <div className="fin-two-cols">
              <section className="fin-section">
                <h3 className="fin-section-title">أعلى المؤسسات دفعًا</h3>
                <div className="admin-table-wrap">
                  {topOrgs.length === 0 ? (
                    <div className="fin-empty-table">لا توجد بيانات</div>
                  ) : (
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>المؤسسة</th>
                          <th>المعاملات</th>
                          <th>الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topOrgs.map((o) => (
                          <tr key={o.organizationId}>
                            <td>{o.organizationName}</td>
                            <td>{o.transactionsCount}</td>
                            <td>
                              <b>{formatEGP(o.totalPaid)}</b>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              <section className="fin-section">
                <h3 className="fin-section-title">اشتراكات تنتهي قريبًا (30 يوم)</h3>
                <div className="admin-table-wrap">
                  {expiring.length === 0 ? (
                    <div className="fin-empty-table">لا توجد اشتراكات قريبة الانتهاء</div>
                  ) : (
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>المؤسسة</th>
                          <th>الخطة</th>
                          <th>تنتهي</th>
                          <th>الأيام</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expiring.map((e) => (
                          <tr key={e.organizationId}>
                            <td>{e.organizationName}</td>
                            <td>{e.plan}</td>
                            <td style={{ fontSize: 12 }}>{e.endDate}</td>
                            <td>
                              <span
                                className={`fin-days-badge ${
                                  e.daysRemaining <= 7
                                    ? 'urgent'
                                    : e.daysRemaining <= 14
                                    ? 'warn'
                                    : ''
                                }`}
                              >
                                {e.daysRemaining} يوم
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>
            </div>
          </>
        ) : (
          <div className="inx-empty">تعذر تحميل البيانات</div>
        )}
      </div>
    </main>
  );
}