import { useLocation } from 'react-router-dom';
import { Clock, Sparkles } from 'lucide-react';

export default function ComingSoonPage() {
  const path = useLocation().pathname.slice(1);
  return (
    <main className="mobile-page" dir="rtl">
      <div className="inx-container">
        <div className="inx-empty" style={{ marginTop: 40, padding: 40 }}>
          <span className="inx-icon-circle inx-icon-circle-lg tone-primary">
            <Clock size={22} />
          </span>
          <span className="eyebrow">InsurNex Module</span>
          <b style={{ fontSize: 18, marginTop: 4 }}>{path || 'وحدة جديدة'}</b>
          <small style={{ maxWidth: 380, textAlign: 'center', marginTop: 8 }}>
            جارٍ العمل على تطوير هذه الوحدة. ستكون متاحة في تحديث قادم مع ميزات
            جديدة تعزز تجربة إدارة الوساطة.
          </small>
          <span className="inx-badge inx-badge-primary" style={{ marginTop: 10 }}>
            <Sparkles size={12} /> قريبًا
          </span>
        </div>
      </div>
    </main>
  );
}