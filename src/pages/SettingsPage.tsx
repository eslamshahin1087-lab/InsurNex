import { Palette, ShieldCheck, UserRound, Building2 } from 'lucide-react';
import ThemeSettings from '../theme/ThemeSettings';

const items = [
  {
    key: 'account',
    icon: UserRound,
    title: 'الحساب',
    desc: 'تعديل بيانات المستخدم والملف الشخصي.',
    tone: '',
  },
  {
    key: 'organization',
    icon: Building2,
    title: 'المؤسسة',
    desc: 'إعدادات المؤسسة والهيكل التشغيلي.',
    tone: 'tone-cyan',
  },
  {
    key: 'security',
    icon: ShieldCheck,
    title: 'الأمان',
    desc: 'إدارة الصلاحيات وخيارات الخصوصية.',
    tone: 'tone-success',
  },
] as const;

export default function SettingsPage() {
  return (
    <main className="mobile-page" dir="rtl">
      <div className="inx-container">
        <header className="inx-section-head" style={{ marginTop: 0 }}>
          <div>
            <span className="eyebrow">InsurNex</span>
            <h2>الإعدادات</h2>
            <small style={{ color: 'var(--inx-muted)' }}>
              التحكم الكامل في تجربتك داخل المنصة.
            </small>
          </div>
        </header>

        <div className="inx-card inx-card-lg" style={{ marginBottom: 16 }}>
          <div className="inx-card-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="inx-icon-circle tone-primary">
                <Palette size={18} />
              </span>
              <div>
                <h3>المظهر</h3>
                <small>اختر السمة المفضلة لواجهة المستخدم.</small>
              </div>
            </div>
          </div>
          <ThemeSettings />
        </div>

        <div className="inx-section-head">
          <h2>خيارات الحساب</h2>
        </div>

        <ul className="inx-list">
          {items.map(({ key, icon: Icon, title, desc, tone }) => (
            <li key={key}>
              <div className="inx-list-item">
                <span className={`inx-icon-circle ${tone}`}>
                  <Icon size={18} />
                </span>
                <div className="inx-list-copy">
                  <b>{title}</b>
                  <small>{desc}</small>
                </div>
                <span className="inx-badge inx-badge-neutral">قريبًا</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}