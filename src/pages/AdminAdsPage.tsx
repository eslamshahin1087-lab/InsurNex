import { useCallback, useEffect, useState } from 'react';
import {
  Edit3,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Megaphone,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { isCurrentUserAdmin } from '../features/subscription/subscription.service';
import {
  createAd,
  deleteAd,
  listAllAds,
  toggleAdActive,
  updateAd,
  type AdInput,
} from '../features/admin/ads.service';
import type { Ad } from '../features/admin/ads.types';
import '../theme/admin-ads.css';

const EMPTY_FORM: AdInput = {
  title: '',
  description: '',
  imageUrl: '',
  linkUrl: '',
  ctaText: '',
  isActive: true,
  startDate: '',
  endDate: '',
  order: 0,
};

export default function AdminAdsPage() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Ad | null>(null);
  const [form, setForm] = useState<AdInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    void isCurrentUserAdmin(user.uid).then(setAllowed);
  }, [user?.uid]);

  const load = useCallback(async () => {
    if (allowed !== true) return;
    setLoading(true);
    try {
      const rows = await listAllAds();
      setAds(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, order: ads.length + 1 });
    setModalOpen(true);
  }

  function openEdit(ad: Ad) {
    setEditing(ad);
    setForm({
      title: ad.title,
      description: ad.description || '',
      imageUrl: ad.imageUrl,
      linkUrl: ad.linkUrl || '',
      ctaText: ad.ctaText || '',
      isActive: ad.isActive,
      startDate: ad.startDate || '',
      endDate: ad.endDate || '',
      order: ad.order ?? 0,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.title.trim()) return alert('العنوان مطلوب');
    if (!form.imageUrl.trim()) return alert('رابط الصورة مطلوب');
    if (!user) return;

    setSaving(true);
    try {
      if (editing) {
        await updateAd(editing.id, form);
      } else {
        await createAd({ ...form, createdBy: user.uid });
      }
      await load();
      setModalOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    } catch (e) {
      console.error(e);
      alert('تعذر الحفظ: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ad: Ad) {
    if (!window.confirm(`حذف الإعلان "${ad.title}"؟ لا يمكن التراجع.`)) return;
    try {
      await deleteAd(ad.id);
      setAds((prev) => prev.filter((a) => a.id !== ad.id));
    } catch (e) {
      console.error(e);
      alert('فشل الحذف: ' + (e as Error).message);
    }
  }

  async function handleToggleActive(ad: Ad) {
    try {
      const next = !ad.isActive;
      await toggleAdActive(ad.id, next);
      setAds((prev) =>
        prev.map((a) => (a.id === ad.id ? { ...a, isActive: next } : a)),
      );
    } catch (e) {
      console.error(e);
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
          <div className="inx-empty"><b>غير مصرح</b></div>
        </div>
      </main>
    );
  }

  const activeCount = ads.filter((a) => a.isActive).length;
  const today = new Date().toISOString().slice(0, 10);
  const currentlyShowing = ads.filter(
    (a) =>
      a.isActive &&
      (!a.startDate || a.startDate <= today) &&
      (!a.endDate || a.endDate >= today),
  ).length;

  return (
    <>
      <div className="admin-page-head">
        <span className="eyebrow">Admin · Ads</span>
        <h1>الإعلانات</h1>
        <p>إدارة الإعلانات التي تظهر للمستخدمين في لوحة التحكم الرئيسية.</p>
      </div>

      <div className="admin-kpi-grid">
        <article className="admin-kpi">
          <span className="admin-kpi-icon">
            <Megaphone size={20} />
          </span>
          <div className="admin-kpi-value">{ads.length}</div>
          <div className="admin-kpi-label">إجمالي الإعلانات</div>
        </article>
        <article className="admin-kpi">
          <span className="admin-kpi-icon tone-success">
            <Eye size={20} />
          </span>
          <div className="admin-kpi-value">{activeCount}</div>
          <div className="admin-kpi-label">مفعّلة</div>
        </article>
        <article className="admin-kpi">
          <span className="admin-kpi-icon tone-warning">
            <EyeOff size={20} />
          </span>
          <div className="admin-kpi-value">{ads.length - activeCount}</div>
          <div className="admin-kpi-label">معطّلة</div>
        </article>
        <article className="admin-kpi">
          <span className="admin-kpi-icon tone-primary">
            <ImageIcon size={20} />
          </span>
          <div className="admin-kpi-value">{currentlyShowing}</div>
          <div className="admin-kpi-label">تظهر الآن</div>
        </article>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          justifyContent: 'flex-end',
        }}
      >
        <button
          type="button"
          className="inx-icon-btn"
          onClick={() => void load()}
          title="تحديث"
        >
          <RefreshCw size={16} />
        </button>
        <button
          type="button"
          className="inx-btn inx-btn-primary"
          onClick={openCreate}
        >
          <Plus size={16} /> إعلان جديد
        </button>
      </div>

      {loading ? (
        <div className="inx-empty">جاري التحميل...</div>
      ) : ads.length === 0 ? (
        <div className="inx-empty">
          <Megaphone size={28} />
          <b>لا توجد إعلانات</b>
          <small style={{ color: 'var(--inx-muted)' }}>
            اضغط "إعلان جديد" لإنشاء أول إعلان.
          </small>
        </div>
      ) : (
        <div className="ads-grid">
          {ads.map((ad) => (
            <article
              key={ad.id}
              className={`ad-card ${ad.isActive ? '' : 'is-inactive'}`}
            >
              <img src={ad.imageUrl} alt={ad.title} className="ad-thumb" />
              <div className="ad-body">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                >
                  <h3 className="ad-title">{ad.title}</h3>
                  <span
                    className={`inx-badge ${
                      ad.isActive ? 'inx-badge-success' : 'inx-badge-neutral'
                    }`}
                  >
                    {ad.isActive ? 'مفعّل' : 'معطّل'}
                  </span>
                </div>

                {ad.description && <p className="ad-desc">{ad.description}</p>}

                <div className="ad-meta">
                  ترتيب #{ad.order}
                  {ad.startDate && ` · من ${ad.startDate}`}
                  {ad.endDate && ` إلى ${ad.endDate}`}
                </div>
              </div>

              <div className="ad-actions">
                <button
                  type="button"
                  className="inx-icon-btn"
                  onClick={() => void handleToggleActive(ad)}
                  title={ad.isActive ? 'تعطيل' : 'تفعيل'}
                >
                  {ad.isActive ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button
                  type="button"
                  className="inx-icon-btn"
                  onClick={() => openEdit(ad)}
                  title="تعديل"
                >
                  <Edit3 size={15} />
                </button>
                <button
                  type="button"
                  className="inx-icon-btn"
                  onClick={() => void handleDelete(ad)}
                  title="حذف"
                >
                  <Trash2 size={15} style={{ color: 'var(--inx-danger)' }} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="ad-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <h3>{editing ? 'تعديل إعلان' : 'إعلان جديد'}</h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X size={18} />
              </button>
            </header>

            <div className="ad-modal-body">
              <label className="ad-field">
                <span>العنوان *</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="مثال: خصم 20% على الاشتراك السنوي"
                />
              </label>

              <label className="ad-field">
                <span>الوصف</span>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="تفاصيل مختصرة"
                />
              </label>

              <label className="ad-field">
                <span>رابط الصورة *</span>
                <input
                  type="url"
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="https://example.com/banner.jpg"
                />
              </label>

              {form.imageUrl && (
                <div className="ad-preview">
                  <img src={form.imageUrl} alt="معاينة" />
                </div>
              )}

              <label className="ad-field">
                <span>رابط الوجهة (اختياري)</span>
                <input
                  type="url"
                  value={form.linkUrl}
                  onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
                  placeholder="https://insurnex.com/offer"
                />
              </label>

              <div className="ad-field-row">
                <label className="ad-field">
                  <span>نص الزر</span>
                  <input
                    type="text"
                    value={form.ctaText}
                    onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
                    placeholder="اعرف المزيد"
                  />
                </label>

                <label className="ad-field">
                  <span>الترتيب</span>
                  <input
                    type="number"
                    min="0"
                    value={form.order}
                    onChange={(e) =>
                      setForm({ ...form, order: Number(e.target.value) || 0 })
                    }
                  />
                </label>
              </div>

              <div className="ad-field-row">
                <label className="ad-field">
                  <span>من تاريخ</span>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) =>
                      setForm({ ...form, startDate: e.target.value })
                    }
                  />
                </label>

                <label className="ad-field">
                  <span>إلى تاريخ</span>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                </label>
              </div>

              <label className="ad-toggle">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <span>مفعّل (يظهر للمستخدمين)</span>
              </label>
            </div>

            <footer>
              <button
                type="button"
                className="inx-btn inx-btn-primary"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button
                type="button"
                className="inx-btn inx-btn-secondary"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                إلغاء
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}