import { useEffect, useMemo, useState } from 'react';
import { Building2, Plus, Search } from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { createInsurer, listInsurers } from '../features/insurers/insurer.service';
import { SYSTEM_INSURERS } from '../features/insurers/system-insurers';
import type { Insurer } from '../types/insurance';

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

  return (
    <main className="mobile-page" dir="rtl">
      <div className="inx-container">
        <header className="inx-section-head" style={{ marginTop: 0 }}>
          <div>
            <span className="eyebrow">Insurance Network</span>
            <h2>شركات التأمين</h2>
            <small style={{ color: 'var(--inx-muted)' }}>
              الدليل الشامل لشركات التأمين المتاحة في السوق.
            </small>
          </div>
        </header>

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
                <div className="inx-kpi-value" style={{ fontSize: 15 }}>{i.name}</div>
                <small className="inx-kpi-label">{LABELS[i.category] || i.category}</small>
              </article>
            ))}
          </div>
        )}

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