import { useEffect, useState, type CSSProperties } from 'react';
import { CheckCircle2, Megaphone, Palette, Save, Settings, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import {
  DEFAULT_PLATFORM_SETTINGS,
  loadPlatformSettings,
  PLATFORM_FEATURES,
  savePlatformSettings,
  type PlatformFeatureKey,
  type PlatformSettings,
} from '../features/admin/platform-settings.service';

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [form, setForm] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let cancelled = false;
    void loadPlatformSettings()
      .then((settings) => { if (!cancelled) setForm(settings); })
      .catch((reason: unknown) => {
        console.error(reason);
        if (!cancelled) setError('تعذر تحميل الإعدادات. تحقق من صلاحيات Firestore ثم أعد المحاولة.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function updateFeature(key: PlatformFeatureKey, checked: boolean) {
    setForm((current) => ({ ...current, features: { ...current.features, [key]: checked } }));
    setSuccess('');
  }

  function updateAdvertising(key: keyof PlatformSettings['advertising'], checked: boolean) {
    setForm((current) => ({ ...current, advertising: { ...current.advertising, [key]: checked } }));
    setSuccess('');
  }

  async function handleSave() {
    if (!user?.uid) { setError('يجب تسجيل الدخول بحساب إداري لحفظ الإعدادات.'); return; }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await savePlatformSettings(form, user.uid);
      setSuccess('تم حفظ إعدادات المنصة. ستتحدّث الواجهة تلقائيًا للمستخدمين المتصلين.');
    } catch (reason) {
      console.error(reason);
      setError('تعذر حفظ الإعدادات: ' + (reason instanceof Error ? reason.message : 'خطأ غير معروف'));
    } finally {
      setSaving(false);
    }
  }

  const sectionStyle: CSSProperties = { marginBottom: 16, padding: 18 };
  const toggleRowStyle: CSSProperties = {
    display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 0',
    borderBottom: '1px solid var(--inx-border)',
  };

  if (loading) {
    return <>
      <div className="admin-page-head"><span className="eyebrow">Admin · Settings</span><h1>إعدادات المنصة</h1><p>تحميل الإعدادات الحالية...</p></div>
      <div className="inx-empty">جاري تحميل الإعدادات...</div>
    </>;
  }

  return <>
    <div className="admin-page-head">
      <span className="eyebrow">Admin · Control Center</span>
      <h1>إعدادات المنصة</h1>
      <p>التحكم في هوية التطبيق والوحدات المتاحة للمستخدمين وأماكن ظهور الإعلانات.</p>
      <small style={{ display: 'block', marginTop: 8, color: 'var(--inx-muted)', lineHeight: 1.8 }}>
        ملاحظة أمنية: إخفاء وحدة هنا يتحكم في الواجهة ومساراتها فقط، ولا يغيّر أدوار المستخدمين أو صلاحيات الوصول إلى بيانات Firestore.
      </small>
    </div>

    {error && <div className="inx-card" role="alert" style={{ ...sectionStyle, borderColor: 'var(--inx-danger)', color: 'var(--inx-danger)' }}>{error}</div>}
    {success && <div className="inx-card" role="status" style={{ ...sectionStyle, borderColor: '#9bd9bd', color: '#12794b', display: 'flex', gap: 8, alignItems: 'center' }}><CheckCircle2 size={18} />{success}</div>}

    <section className="inx-card inx-card-lg" style={sectionStyle}>
      <div className="inx-card-head">
        <h3><Palette size={18} style={{ verticalAlign: 'middle', marginInlineEnd: 7 }} /> الهوية البصرية</h3>
        <span className="inx-badge inx-badge-primary">عام</span>
      </div>
      <p style={{ marginTop: 0, color: 'var(--inx-muted)', fontSize: 12, lineHeight: 1.8 }}>
        تغيّر هذه الخيارات ألوان متغيرات التصميم المشتركة. يتم قبول ألوان HEX صحيحة فقط.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        <label style={{ display: 'grid', gap: 8, fontSize: 13, fontWeight: 700 }}>
          اللون الأساسي
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="color" value={form.branding.primaryColor} aria-label="اللون الأساسي"
              onChange={(e) => { setForm((current) => ({ ...current, branding: { ...current.branding, primaryColor: e.target.value.toUpperCase() } })); setSuccess(''); }}
              style={{ width: 48, height: 42, padding: 3, border: '1px solid var(--inx-border)', borderRadius: 10, background: 'var(--inx-surface)' }} />
            <code>{form.branding.primaryColor}</code>
          </div>
        </label>
        <label style={{ display: 'grid', gap: 8, fontSize: 13, fontWeight: 700 }}>
          اللون المساعد
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="color" value={form.branding.accentColor} aria-label="اللون المساعد"
              onChange={(e) => { setForm((current) => ({ ...current, branding: { ...current.branding, accentColor: e.target.value.toUpperCase() } })); setSuccess(''); }}
              style={{ width: 48, height: 42, padding: 3, border: '1px solid var(--inx-border)', borderRadius: 10, background: 'var(--inx-surface)' }} />
            <code>{form.branding.accentColor}</code>
          </div>
        </label>
      </div>
    </section>

    <section className="inx-card inx-card-lg" style={sectionStyle}>
      <div className="inx-card-head">
        <h3><SlidersHorizontal size={18} style={{ verticalAlign: 'middle', marginInlineEnd: 7 }} /> وحدات التطبيق</h3>
        <span className="inx-badge inx-badge-neutral">{PLATFORM_FEATURES.filter((f) => form.features[f.key]).length} / {PLATFORM_FEATURES.length} مفعّلة</span>
      </div>
      <p style={{ marginTop: 0, color: 'var(--inx-muted)', fontSize: 12, lineHeight: 1.8 }}>
        عند تعطيل وحدة تختفي من التنقل والاختصارات ويُمنع فتح مساراتها مباشرة. لا يؤدي التعطيل إلى حذف بياناتها.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', columnGap: 18 }}>
        {PLATFORM_FEATURES.map((feature) => <label key={feature.key} style={toggleRowStyle}>
          <input type="checkbox" checked={form.features[feature.key]} onChange={(e) => updateFeature(feature.key, e.target.checked)} style={{ marginTop: 3, accentColor: 'var(--inx-blue)' }} />
          <span><b style={{ display: 'block', fontSize: 13 }}>{feature.label}</b><small style={{ color: 'var(--inx-muted)', fontSize: 11 }}>{feature.description}</small></span>
        </label>)}
      </div>
    </section>

    <section className="inx-card inx-card-lg" style={sectionStyle}>
      <div className="inx-card-head">
        <h3><Megaphone size={18} style={{ verticalAlign: 'middle', marginInlineEnd: 7 }} /> الإعلانات</h3>
        <span className="inx-badge inx-badge-neutral">توزيع العرض</span>
      </div>
      <p style={{ marginTop: 0, color: 'var(--inx-muted)', fontSize: 12, lineHeight: 1.8 }}>
        إدارة محتوى الإعلانات تبقى في صفحة «الإعلانات». تتحكم هذه الإعدادات في تفعيل المساحة ومكان العرض.
      </p>
      <label style={toggleRowStyle}><input type="checkbox" checked={form.advertising.enabled} onChange={(e) => updateAdvertising('enabled', e.target.checked)} style={{ marginTop: 3, accentColor: 'var(--inx-blue)' }} /><span><b style={{ display: 'block', fontSize: 13 }}>تفعيل الإعلانات في التطبيق</b><small style={{ color: 'var(--inx-muted)', fontSize: 11 }}>إيقاف الخيار يخفي المساحات دون حذف إعلانات الإدارة.</small></span></label>
      <label style={toggleRowStyle}><input type="checkbox" checked={form.advertising.dashboard} disabled={!form.advertising.enabled} onChange={(e) => updateAdvertising('dashboard', e.target.checked)} style={{ marginTop: 3, accentColor: 'var(--inx-blue)' }} /><span><b style={{ display: 'block', fontSize: 13 }}>الصفحة الرئيسية</b><small style={{ color: 'var(--inx-muted)', fontSize: 11 }}>عرض الشرائح الإعلانية في أعلى الصفحة الرئيسية.</small></span></label>
      <label style={{ ...toggleRowStyle, borderBottom: 0 }}><input type="checkbox" checked={form.advertising.operations} disabled={!form.advertising.enabled} onChange={(e) => updateAdvertising('operations', e.target.checked)} style={{ marginTop: 3, accentColor: 'var(--inx-blue)' }} /><span><b style={{ display: 'block', fontSize: 13 }}>مركز العمليات</b><small style={{ color: 'var(--inx-muted)', fontSize: 11 }}>عرض الشرائح الإعلانية أسفل عنوان مركز العمليات.</small></span></label>
    </section>

    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-start', margin: '18px 0 28px' }}>
      <button type="button" className="inx-btn inx-btn-primary" disabled={saving} onClick={() => void handleSave()}><Save size={16} />{saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</button>
      <button type="button" className="inx-btn inx-btn-secondary" disabled={saving} onClick={() => { setForm(DEFAULT_PLATFORM_SETTINGS); setSuccess(''); setError(''); }}><Settings size={16} /> إعادة النموذج إلى الافتراضي</button>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11, color: 'var(--inx-muted)' }}><ShieldCheck size={14} /> تُحفظ الإعدادات في Firestore مع تسجيل معرّف المسؤول.</span>
    </div>
  </>;
}
