import { Megaphone } from 'lucide-react';

export default function AdminAdsPage() {
  return (
    <>
      <div className="admin-page-head">
        <span className="eyebrow">Admin · Ads</span>
        <h1>الإعلانات</h1>
        <p>إدارة الإعلانات والتنبيهات التي تظهر للوسطاء داخل التطبيق.</p>
      </div>

      <div
        className="inx-card inx-card-lg"
        style={{ textAlign: 'center', padding: 60 }}
      >
        <span
          className="inx-icon-circle inx-icon-circle-lg tone-warning"
          style={{ margin: '0 auto 16px' }}
        >
          <Megaphone size={26} />
        </span>
        <b style={{ display: 'block', fontSize: 16, marginBottom: 6 }}>
          قيد الإنشاء
        </b>
        <small style={{ color: 'var(--inx-muted)' }}>
          سيتم تفعيل هذه الصفحة قريبًا لإدارة إعلانات المنصة.
        </small>
      </div>
    </>
  );
}