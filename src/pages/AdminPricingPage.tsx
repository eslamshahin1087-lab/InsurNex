import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calculator,
  DollarSign,
  RefreshCw,
  RotateCcw,
  Save,
  X,
} from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { isCurrentUserAdmin } from '../features/subscription/subscription.service';
import {
  listPlans,
  resetToDefaults,
  savePlan,
} from '../features/admin/plans.service';
import type { PricingPlanDoc } from '../features/admin/plans.types';
import {
  computePricing,
  formatEGP,
} from '../features/admin/pricing.config';
import { PLATFORM_FEATURES, normalizeFeatureEntitlements, type FeatureEntitlements } from '../features/admin/feature-catalog';
import '../theme/admin-pricing.css';

interface EditState {
  id: string;
  name: string;
  duration: number;
  subtotal: number;
  description: string;
  discountNote: string;
  isActive: boolean;
  features: FeatureEntitlements;
}

export default function AdminPricingPage() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [plans, setPlans] = useState<PricingPlanDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    void isCurrentUserAdmin(user.uid).then(setAllowed);
  }, [user?.uid]);

  const load = useCallback(async () => {
    if (allowed !== true) return;
    setLoading(true);
    try {
      const rows = await listPlans();
      setPlans(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(plan: PricingPlanDoc) {
    setEditing({
      id: plan.id,
      name: plan.name,
      duration: plan.duration,
      subtotal: plan.subtotal,
      description: plan.description || '',
      discountNote: plan.discountNote || '',
      isActive: plan.isActive,
      features: normalizeFeatureEntitlements(plan.features),
    });
  }

  async function handleSave() {
    if (!editing || !user) return;
    if (!editing.name.trim()) return alert('الاسم مطلوب');
    if (editing.subtotal <= 0) return alert('السعر يجب أن يكون أكبر من 0');
    if (editing.duration <= 0) return alert('المدة يجب أن تكون أكبر من 0');

    setSaving(true);
    try {
      await savePlan(
        {
          id: editing.id,
          name: editing.name.trim(),
          duration: editing.duration,
          subtotal: editing.subtotal,
          currency: 'EGP',
          description: editing.description.trim(),
          discountNote: editing.discountNote.trim(),
          isActive: editing.isActive,
          order: plans.find((p) => p.id === editing.id)?.order ?? 0,
          features: editing.features,
        },
        user.uid,
      );
      await load();
      setEditing(null);
    } catch (e) {
      console.error(e);
      alert('تعذر الحفظ: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!user) return;
    if (
      !window.confirm(
        'إعادة جميع الخطط إلى القيم الافتراضية؟\n\nسيُستبدل كل تعديل قمت به.',
      )
    )
      return;
    setResetting(true);
    try {
      await resetToDefaults(user.uid);
      await load();
      setEditing(null);
    } catch (e) {
      console.error(e);
      alert('تعذرت الإعادة: ' + (e as Error).message);
    } finally {
      setResetting(false);
    }
  }

  if (allowed === null) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-container">
          <div className="inx-empty"><b>جاري التحقق...</b></div>
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

  return (
    <main className="mobile-page" dir="rtl">
      <div className="inx-container">
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
            <span className="eyebrow">Admin · Pricing</span>
            <h2 style={{ margin: '2px 0 0', fontSize: 20, color: 'var(--inx-text)' }}>
              إدارة خطط الأسعار
            </h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="inx-btn inx-btn-secondary"
              onClick={() => void handleReset()}
              disabled={resetting || loading}
            >
              <RotateCcw size={16} /> إعادة للافتراضي
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

        <div
          className="inx-card"
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            background: 'var(--inx-navy-bg)',
            fontSize: 13,
            color: 'var(--inx-text-soft)',
            display: 'flex',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <Calculator size={18} style={{ color: 'var(--inx-blue)', flexShrink: 0 }} />
          <span>
            كل الأسعار <b>قبل ضريبة القيمة المضافة (14%)</b>. الضريبة تُحسب تلقائيًا عند
            إنشاء كود جديد.
          </span>
        </div>

        {loading ? (
          <div className="inx-empty">جاري التحميل...</div>
        ) : plans.length === 0 ? (
          <div className="inx-empty">
            <DollarSign size={28} />
            <b>لا توجد خطط</b>
          </div>
        ) : (
          <div className="pricing-grid">
            {plans.map((plan) => {
              const pricing = computePricing(plan.subtotal);
              const isEditing = editing?.id === plan.id;

              return (
                <article
                  key={plan.id}
                  className={`pricing-card ${plan.isActive ? '' : 'is-inactive'}`}
                >
                  <header className="pricing-card-head">
                    <div>
                      <h3>{plan.name}</h3>
                      <small>{plan.id}</small>
                    </div>
                    <span
                      className={`inx-badge ${
                        plan.isActive ? 'inx-badge-success' : 'inx-badge-neutral'
                      }`}
                    >
                      {plan.isActive ? 'مفعّلة' : 'معطّلة'}
                    </span>
                  </header>

                  {plan.description && !isEditing && (
                    <p className="pricing-card-desc">{plan.description}</p>
                  )}

                  {!isEditing ? (
                    <>
                      <div className="pricing-amount-block">
                        <div className="pricing-subtotal">
                          {formatEGP(plan.subtotal)}
                        </div>
                        <div className="pricing-vat">
                          + {formatEGP(pricing.vatAmount)} ضريبة
                        </div>
                        <div className="pricing-total">
                          {formatEGP(pricing.total)}
                        </div>
                        <div className="pricing-period">
                          لمدة {plan.duration} يوم
                        </div>
                        {plan.discountNote && (
                          <div className="pricing-discount">
                            {plan.discountNote}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        className="inx-btn inx-btn-secondary"
                        onClick={() => startEdit(plan)}
                        style={{ marginTop: 12, width: '100%' }}
                      >
                        تعديل
                      </button>
                    </>
                  ) : (
                    <div className="pricing-edit-form">
                      <label>
                        <span>الاسم</span>
                        <input
                          type="text"
                          value={editing.name}
                          onChange={(e) =>
                            setEditing({ ...editing, name: e.target.value })
                          }
                        />
                      </label>

                      <label>
                        <span>المدة (أيام)</span>
                        <input
                          type="number"
                          min="1"
                          value={editing.duration}
                          onChange={(e) =>
                            setEditing({
                              ...editing,
                              duration: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </label>

                      <label>
                        <span>السعر قبل الضريبة (ج.م)</span>
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={editing.subtotal}
                          onChange={(e) =>
                            setEditing({
                              ...editing,
                              subtotal: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </label>

                      <div className="pricing-preview">
                        <span>الإجمالي بعد الضريبة:</span>
                        <b>{formatEGP(computePricing(editing.subtotal).total)}</b>
                      </div>

                      <label>
                        <span>الوصف</span>
                        <input
                          type="text"
                          value={editing.description}
                          onChange={(e) =>
                            setEditing({ ...editing, description: e.target.value })
                          }
                        />
                      </label>

                      <label>
                        <span>ملاحظة الخصم</span>
                        <input
                          type="text"
                          value={editing.discountNote}
                          onChange={(e) =>
                            setEditing({ ...editing, discountNote: e.target.value })
                          }
                          placeholder="مثال: خصم 17%"
                        />
                      </label>

                      <label className="pricing-toggle">
                        <input
                          type="checkbox"
                          checked={editing.isActive}
                          onChange={(e) =>
                            setEditing({ ...editing, isActive: e.target.checked })
                          }
                        />
                        <span>مفعّلة (تظهر في صفحة إنشاء الأكواد)</span>
                      </label>

                      <section style={{ marginTop: 8, padding: 12, border: '1px solid var(--inx-border)', borderRadius: 12 }} aria-label="مزايا الخطة">
                        <strong style={{ display: 'block', fontSize: 13, marginBottom: 8 }}>الوحدات المتاحة للمشتركين في هذه الخطة</strong>
                        <small style={{ display: 'block', color: 'var(--inx-muted)', lineHeight: 1.7, marginBottom: 8 }}>
                          كل الوحدات مفعّلة افتراضيًا. إلغاء اختيار وحدة يقصر الوصول إليها على هذه الخطة، ما لم يعطلها مسؤول المنصة عالميًا.
                        </small>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
                          {PLATFORM_FEATURES.map((feature) => (
                            <label key={feature.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, padding: '6px 0' }}>
                              <input
                                type="checkbox"
                                checked={editing.features[feature.key]}
                                onChange={(e) => setEditing({
                                  ...editing,
                                  features: { ...editing.features, [feature.key]: e.target.checked },
                                })}
                                style={{ marginTop: 2, accentColor: 'var(--inx-blue)' }}
                              />
                              <span>{feature.label}</span>
                            </label>
                          ))}
                        </div>
                      </section>

                      <div className="pricing-actions">
                        <button
                          type="button"
                          className="inx-btn inx-btn-primary inx-btn-sm"
                          onClick={() => void handleSave()}
                          disabled={saving}
                        >
                          <Save size={14} /> {saving ? 'جاري الحفظ...' : 'حفظ'}
                        </button>
                        <button
                          type="button"
                          className="inx-btn inx-btn-secondary inx-btn-sm"
                          onClick={() => setEditing(null)}
                          disabled={saving}
                        >
                          <X size={14} /> إلغاء
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <div
          className="inx-card"
          style={{
            marginTop: 20,
            padding: 16,
            background: 'var(--inx-info-bg)',
            fontSize: 13,
            color: 'var(--inx-text-soft)',
          }}
        >
          <b style={{ color: 'var(--inx-info)', display: 'block', marginBottom: 6 }}>
            ℹ️ ملاحظة مهمة
          </b>
          الأكواد التي تم إنشاؤها سابقًا تحتفظ بسعرها الأصلي حتى بعد تغيير أسعار الخطط.
          هذا يضمن اتساق التقارير المالية.
        </div>
      </div>
    </main>
  );
}