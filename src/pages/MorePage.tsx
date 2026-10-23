import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  ChevronLeft,
  ClipboardCheck,
  CreditCard,
  FileStack,
  ListTodo,
  Palette,
  Settings,
  Settings2,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { usePlatformSettings } from '../features/admin/PlatformSettingsProvider';

const sections = [
  {
    title: 'الحساب والاشتراك',
    items: [
      {
        to: '/subscription',
        label: 'الاشتراك',
        desc: 'حالة الاشتراك والتجديد',
        icon: CreditCard,
        tone: 'tone-success',
      },
      {
        to: '/settings',
        label: 'الإعدادات',
        desc: 'الحساب ومساحة العمل',
        icon: Settings,
        tone: '',
      },
      {
        to: '/notifications',
        label: 'الإشعارات',
        desc: 'مركز التنبيهات الموحد',
        icon: Palette,
        tone: 'tone-warning',
      },
    ],
  },
  {
    title: 'العمليات اليومية',
    items: [
      {
        to: '/operations',
        label: 'العمليات',
        desc: 'مركز العمليات وإدارة الدورة التشغيلية',
        icon: Settings2,
        tone: '',
      },
      {
        to: '/finance',
        label: 'الإدارة المالية',
        desc: 'الإيرادات والمصروفات والعمولات',
        icon: Wallet,
        tone: 'tone-success',
      },
      {
        to: '/tasks',
        label: 'المهام',
        desc: 'متابعة المهام والتذكيرات',
        icon: ListTodo,
        tone: 'tone-warning',
      },
    ],
  },
  {
    title: 'المحفظة والعملاء',
    items: [
      {
        to: '/claims',
        label: 'المطالبات',
        desc: 'إدارة دورة المطالبات',
        icon: ClipboardCheck,
        tone: 'tone-cyan',
      },
      {
        to: '/leads',
        label: 'المبيعات',
        desc: 'الفرص والعملاء المحتملون',
        icon: BriefcaseBusiness,
        tone: 'tone-purple',
      },
      {
        to: '/insurers',
        label: 'شركات التأمين',
        desc: 'دليل شركات التأمين',
        icon: Building2,
        tone: 'tone-cyan',
      },
      {
        to: '/documents',
        label: 'المستندات',
        desc: 'ملفات ووثائق العملاء',
        icon: FileStack,
        tone: '',
      },
      {
        to: '/clients',
        label: 'العملاء',
        desc: 'كل العملاء في مكان واحد',
        icon: Users,
        tone: 'tone-success',
      },
    ],
  },
  {
    title: 'التحليلات والذكاء',
    items: [
      {
        to: '/analytics',
        label: 'التحليلات',
        desc: 'مؤشرات أداء المحفظة',
        icon: BarChart3,
        tone: 'tone-rose',
      },
      {
        to: '/copilot',
        label: 'المساعد الذكي',
        desc: 'InsurNex AI Copilot',
        icon: Sparkles,
        tone: 'tone-purple',
      },
      {
        to: '/ai/file-analysis',
        label: 'تحليل الملفات',
        desc: 'تحليل ذكي للمستندات',
        icon: TrendingUp,
        tone: 'tone-cyan',
      },
    ],
  },
] as const;

export default function MorePage() {
  const { profile } = useAuth();
  const { settings } = usePlatformSettings();
  const featureByPath: Record<string, keyof typeof settings.features> = {
    '/notifications': 'notifications', '/operations': 'operations', '/finance': 'finance',
    '/tasks': 'tasks', '/claims': 'claims', '/leads': 'leads', '/insurers': 'insurers',
    '/documents': 'documents', '/clients': 'clients', '/analytics': 'analytics',
    '/copilot': 'copilot', '/ai/file-analysis': 'analytics',
  };
  const firstName = profile?.displayName?.split(' ')[0] || 'بك';

  return (
    <main className="mobile-page" dir="rtl">
      <div className="inx-container">
        <header className="inx-section-head" style={{ marginTop: 0 }}>
          <div>
            <span className="eyebrow">InsurNex</span>
            <h2>المزيد</h2>
            <small style={{ color: 'var(--inx-muted)' }}>
              كل أدوات إدارة الوساطة في مكان واحد، {firstName}.
            </small>
          </div>
        </header>

        {sections.map((section) => (
          <section key={section.title} style={{ marginBottom: 18 }}>
            <div className="inx-section-head">
              <h2>{section.title}</h2>
            </div>
            <ul className="inx-list">
              {section.items.filter(({ to }) => !featureByPath[to] || settings.features[featureByPath[to]]).map(({ to, label, desc, icon: Icon, tone }) => (
                <li key={to}>
                  <Link to={to} className="inx-list-item">
                    <span className={`inx-icon-circle ${tone}`}>
                      <Icon size={18} />
                    </span>
                    <div className="inx-list-copy">
                      <b>{label}</b>
                      <small>{desc}</small>
                    </div>
                    <ChevronLeft size={16} className="inx-list-chevron" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {settings.features.copilot && <div
          className="inx-card"
          style={{ textAlign: 'center', padding: 20, marginTop: 8 }}
        >
          <span
            className="inx-icon-circle inx-icon-circle-lg tone-primary"
            style={{ margin: '0 auto 10px' }}
          >
            <Sparkles size={20} />
          </span>
          <b style={{ display: 'block', fontSize: 14, marginBottom: 4 }}>
            InsurNex AI Copilot
          </b>
          <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
            مساعدك الذكي متاح في كل صفحة — اضغط الزر العائم أسفل اليسار.
          </small>
        </div>}
      </div>
    </main>
  );
}