import { Settings } from 'lucide-react';

export default function AdminSettingsPage() {
  return (
    <>
      <div className="admin-page-head">
        <span className="eyebrow">Admin · Settings</span>
        <h1>إعدادات المنصة</h1>
        <p>التحكم الكامل في إعدادات InsurNex العامة.</p>
      </div>

      <div
        className="inx-card inx-card-lg"
        style={{ textAlign: 'center', padding: 60 }}
      >
        <span
          className="inx-icon-circle inx-icon-circle-lg"
          style={{ margin: '0 auto 16px' }}
        >
          <Settings size={26} />
        </span>
        <b style={{ display: 'block', fontSize: 16, marginBottom: 6 }}>
          قيد الإنشاء
        </b>
        <small style={{ color: 'var(--inx-muted)' }}>
          سيتم تفعيل هذه الصفحة قريبًا للتحكم في إعدادات المنصة.
        </small>
      </div>
    </>
  );
}