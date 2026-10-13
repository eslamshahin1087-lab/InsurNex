import { useEffect, useMemo, useState } from 'react';
import { Bot, Building2, Moon, Plus, Search, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { createInsurer, listInsurers } from '../features/insurers/insurer.service';
import { SYSTEM_INSURERS } from '../features/insurers/system-insurers';
import type { Insurer } from '../types/insurance';
import { setCurrentContext } from '../features/copilot/copilot-context.store';
import { useTheme } from '../theme/ThemeProvider';
import MiniDonutChart from '../components/charts/MiniDonutChart';
import MiniBarChart from '../components/charts/MiniBarChart';

type Filter = 'all' | 'general' | 'life' | 'general_life' | 'takaful' | 'custom';

const FILTERS: Filter[] = ['all', 'general', 'life', 'general_life', 'takaful', 'custom'];

const LABELS: Record<string, string> = {
  general: 'عام',
  life: 'حياة',
  general_life: 'عام وحياة',
  takaful: 'تكافل',
  custom: 'إضافية',
};

export default function InsurersPage() {
  const { profile } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [custom, setCustom] = useState<Insurer[]>([]);
  const [name, setName] = useState('');
  const [term, setTerm] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  async function load() {
    if (profile) setCustom(await listInsurers(profile.organizationId));
  }

  useEffect(() => {
    void load();
  }, [profile]);

  const all = useMemo(
    () => [
      ...SYSTEM_INSURERS.map((i) => ({ ...i, custom: false })),
      ...custom.map((i) => ({
        id: i.id,
        name: i.name,
        shortName: i.name,
        category: 'custom' as const,
        custom: true,
      })),
    ],
    [custom],
  );

  const shown = all.filter(
    (i) =>
      (filter === 'all' || i.category === filter) &&
      `${i.name} ${i.shortName}`.toLowerCase().includes(term.toLowerCase()),
  );

  // Copilot context
  useEffect(() => {
    if (!all.length) return;
    setCurrentContext({
      page: 'insurers',
      insurers: all.slice(0, 20).map((i) => ({
        name: i.name,
        category: i.category,
      })),
      notes: `The broker is viewing the insurance companies directory (${all.length} companies)`,
    });
  }, [all]);

  async function add() {
    if (
      !profile ||
      !name.trim() ||
      all.some((i) => i.name.toLowerCase() === name.trim().toLowerCase())
    )
      return;
    await createInsurer(
      { name: name.trim(), contactName: '', phone: '', email: '', status: 'active' },
      profile.organizationId,
    );
    setName('');
    await load();
  }

  const askCopilot = () => {
    navigate('/copilot', {
      state: {
        context: {
          page: 'insurers',
          insurers: all.slice(0, 20).map((i) => ({
            name: i.name,
            category: i.category,
          })),
          notes: `The broker is viewing the insurance companies directory (${all.length} companies)`,
        },
      },
    });
  };

  // Charts
  const categorySegments = [
    { label: 'عام', value: all.filter((i) => i.category === 'general').length, color: '#1E4272' },
    { label: 'حياة', value: all.filter((i) => i.category === 'life').length, color: '#10b981' },
    { label: 'عام وحياة', value: all.filter((i) => i.category === 'general_life').length, color: '#22b8e8' },
    { label: 'تكافل', value: all.filter((i) => i.category === 'takaful').length, color: '#8b5cf6' },
    { label: 'إضافية', value: all.filter((i) => i.category === 'custom').length, color: '#f59e0b' },
  ].filter((s) => s.value > 0);

  const categoryBarData = [
    all.filter((i) => i.category === 'general').length,
    all.filter((i) => i.category === 'life').length,
    all.filter((i) => i.category === 'general_life').length,
    all.filter((i) => i.category === 'takaful').length,
    all.filter((i) => i.category === 'custom').length,
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
            <span className="eyebrow">Insurance Network</span>
            <h2 style={{ margin: '2px 0 4px', fontSize: 20, color: 'var(--inx-text)' }}>
              شركات التأمين
            </h2>
            <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
              الدليل الشامل لشركات التأمين المتاحة في السوق.
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
            <button
              type="button"
              className="inx-circle-btn"
              onClick={() => void add()}
              title="إضافة شركة"
              disabled={!name.trim()}
              style={{ opacity: name.trim() ? 1 : 0.5 }}
            >
              <Plus size={18} />
            </button>
          </div>
        </header>

        {/* KPIs */}
        <div className="inx-kpi-grid" style={{ marginBottom: 16 }}>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-cyan">🏢</span>
            </div>
            <div className="inx-kpi-value">{all.length}</div>
            <small className="inx-kpi-label">إجمالي الشركات</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-primary">⚖️</span>
            </div>
            <div className="inx-kpi-value">
              {all.filter((i) => i.category === 'general').length}
            </div>
            <small className="inx-kpi-label">تأمين عام</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-success">💚</span>
            </div>
            <div className="inx-kpi-value">
              {all.filter((i) => i.category === 'life' || i.category === 'general_life').length}
            </div>
            <small className="inx-kpi-label">تأمين حياة</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-warning">➕</span>
            </div>
            <div className="inx-kpi-value">{custom.length}</div>
            <small className="inx-kpi-label">شركات مخصصة</small>
          </article>
        </div>

        {/* CHARTS */}
        {all.length > 0 && (
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
                <span className="label">توزيع الفئات</span>
                <span className="value">{all.length}</span>
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
                    categorySegments.length
                      ? categorySegments
                      : [{ label: 'لا يوجد', value: 1, color: '#e3ebf5' }]
                  }
                  size={110}
                  thickness={14}
                  centerValue={String(all.length)}
                  centerLabel="شركة"
                />
                <div className="inx-donut-legend" style={{ flex: 1, minWidth: 120 }}>
                  {categorySegments.map((s) => (
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
                <span className="label">توزيع الفئات (مقارنة)</span>
                <span className="delta up">↑ مباشر</span>
              </div>
              <div style={{ color: 'var(--inx-blue)' }}>
                <MiniBarChart
                  data={categoryBarData}
                  labels={['عام', 'حياة', 'عام وحياة', 'تكافل', 'إضافية']}
                  height={80}
                  color="var(--inx-blue)"
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 10,
                  color: 'var(--inx-muted)',
                }}
              >
                <span>عام</span>
                <span>حياة</span>
                <span>عام+حياة</span>
                <span>تكافل</span>
                <span>إضافية</span>
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
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="ابحث باسم شركة التأمين"
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
                {f === 'all' ? 'الكل' : LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {/* LIST */}
        <div className="inx-section-head">
          <h2>الشركات المتاحة</h2>
          <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
            {shown.length} شركة
          </small>
        </div>

        {shown.length === 0 ? (
          <div className="inx-empty">
            <Building2 size={28} />
            <b>لا توجد شركات مطابقة</b>
            <small>جرّب تعديل الفلاتر أو أضف شركة جديدة.</small>
          </div>
        ) : (
          <div className="inx-kpi-grid">
            {shown.map((i) => (
              <article key={`${i.custom ? 'c' : 's'}-${i.id}`} className="inx-kpi">
                <div className="inx-kpi-head">
                  <span className="inx-icon-circle tone-cyan">
                    <Building2 size={18} />
                  </span>
                  {i.custom && <span className="inx-badge inx-badge-primary">مخصصة</span>}
                </div>
                <div className="inx-kpi-value" style={{ fontSize: 15 }}>
                  {i.name}
                </div>
                <small className="inx-kpi-label">{LABELS[i.category] || i.category}</small>
              </article>
            ))}
          </div>
        )}

        {/* ADD CUSTOM */}
        <div className="inx-section-head">
          <h2>إضافة شركة مخصصة</h2>
        </div>
        <div className="inx-card">
          <small
            style={{
              display: 'block',
              color: 'var(--inx-muted)',
              marginBottom: 10,
              fontSize: 12,
            }}
          >
            أضف شركة تأمين جديدة إلى قائمتك الخاصة.
          </small>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم شركة التأمين"
              style={{
                flex: 1,
                minWidth: 200,
                padding: '10px 12px',
                border: '1px solid var(--inx-border)',
                borderRadius: 'var(--inx-radius-sm)',
                background: 'var(--inx-surface)',
                color: 'var(--inx-text)',
                fontSize: 13.5,
              }}
            />
            <button
              type="button"
              className="inx-btn inx-btn-primary"
              onClick={() => void add()}
            >
              <Plus size={16} /> إضافة
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}