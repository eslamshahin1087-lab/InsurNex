import {
  Sparkles,
  MessageSquare,
  FileSearch,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react';

export default function CopilotPage() {
  return (
    <main className="mobile-page" dir="rtl">
      <div className="inx-container">
        <header className="inx-section-head">
          <div>
            <span className="eyebrow">Insurance Intelligence Layer</span>
            <h2>InsurNex AI</h2>
          </div>
        </header>

        <div className="inx-card inx-card-lg" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="inx-icon-circle inx-icon-circle-lg">
              <Sparkles size={22} />
            </span>
            <div>
              <b
                style={{
                  display: 'block',
                  fontSize: 16,
                  color: 'var(--inx-text)',

                }}
              >
                مساعدك الذكي
              </b>
              <small style={{ color: 'var(--inx-muted)' }}>
                سيكون متاحًا قريبًا مع محادثة كاملة وتحليل السياق.
              </small>
            </div>
          </div>
        </div>

        <div className="inx-section-head">
          <h2>قدرات قادمة</h2>
        </div>

        <div className="inx-kpi-grid">
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-icon-circle">
                <MessageSquare size={18} />
              </span>
              <span className="inx-badge inx-badge-primary">قريبًا</span>
            </div>
            <div className="inx-kpi-value" style={{ fontSize: 16 }}>
              محادثة ذكية
            </div>
            <small className="inx-kpi-label">اسأل عن أي عميل أو وثيقة</small>
          </article>

          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-icon-circle tone-cyan">
                <FileSearch size={18} />
              </span>
              <span className="inx-badge inx-badge-cyan">قريبًا</span>
            </div>
            <div className="inx-kpi-value" style={{ fontSize: 16 }}>
              تحليل الملفات
            </div>
            <small className="inx-kpi-label">استخراج ذكي من PDF و Excel</small>
          </article>

          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-icon-circle tone-success">
                <TrendingUp size={18} />
              </span>
              <span className="inx-badge inx-badge-success">قريبًا</span>
            </div>
            <div className="inx-kpi-value" style={{ fontSize: 16 }}>
              رؤى المبيعات
            </div>
            <small className="inx-kpi-label">تحليل تلقائي للفرص</small>
          </article>

          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-icon-circle tone-warning">
                <ShieldCheck size={18} />
              </span>
              <span className="inx-badge inx-badge-warning">قريبًا</span>
            </div>
            <div className="inx-kpi-value" style={{ fontSize: 16 }}>
              فحص التغطية
            </div>
            <small className="inx-kpi-label">اكتشاف الفجوات تلقائيًا</small>
          </article>
        </div>

        <div className="inx-section-head">
          <h2>اختبار المكونات</h2>
        </div>

        <div className="inx-card" style={{ marginBottom: 16 }}>
          <div className="inx-card-head">
            <h3>الشارات</h3>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span className="inx-badge inx-badge-primary">نشط</span>
            <span className="inx-badge inx-badge-success">مكتمل</span>
            <span className="inx-badge inx-badge-warning">معلق</span>
            <span className="inx-badge inx-badge-danger">متأخر</span>
            <span className="inx-badge inx-badge-cyan">جديد</span>
            <span className="inx-badge inx-badge-neutral">مسودة</span>
          </div>
        </div>

        <div className="inx-card" style={{ marginBottom: 16 }}>
          <div className="inx-card-head">
            <h3>الفلاتر</h3>
          </div>
          <div className="inx-chips">
            <button type="button" className="inx-chip active">
              الكل
            </button>
            <button type="button" className="inx-chip">
              أفراد
            </button>
            <button type="button" className="inx-chip">
              شركات
            </button>
            <button type="button" className="inx-chip">
              نشط
            </button>
          </div>
        </div>

        <div className="inx-card" style={{ marginBottom: 16 }}>
          <div className="inx-card-head">
            <h3>الأزرار</h3>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button type="button" className="inx-btn inx-btn-primary">
              <Sparkles size={16} /> إجراء أساسي
            </button>
            <button type="button" className="inx-btn inx-btn-secondary">
              إجراء ثانوي
            </button>
            <button type="button" className="inx-btn inx-btn-ghost">
              رابط
            </button>
            <button type="button" className="inx-icon-btn">
              <Sparkles size={18} />
            </button>
            <button type="button" className="inx-icon-btn filled">
              <Sparkles size={18} />
            </button>
          </div>
        </div>

        <div className="inx-empty">
          <Sparkles size={32} />
          <b>لا توجد عناصر لعرضها</b>
          <small>هذه حالة فارغة موحّدة</small>
        </div>
      </div>
    </main>
  );
}