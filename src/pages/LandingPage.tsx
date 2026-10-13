import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Bot,
  CheckCircle2,
  FileSearch,
  Menu,
  Moon,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { useTheme } from '../theme/ThemeProvider';
import FloatingRobot from '../features/landing/FloatingRobot';
import '../theme/landing.css';

const FEATURES = [
  {
    emoji: '👥',
    title: 'CRM ذكي',
    desc: 'إدارة كاملة للعملاء — أفراد وشركات — مع ملف شخصي وتأميني لكل عميل.',
  },
  {
    emoji: '🛡️',
    title: 'الوثائق التأمينية',
    desc: 'متابعة دقيقة لكل وثيقة: الأقساط، التغطية، تاريخ الانتهاء، والعمولات.',
  },
  {
    emoji: '📋',
    title: 'المطالبات',
    desc: 'دورة عمل كاملة من التسجيل حتى التسوية، مع تنبيهات المستندات الناقصة.',
  },
  {
    emoji: '🔄',
    title: 'التجديدات',
    desc: 'تنبيهات تلقائية قبل الانتهاء بـ 30 / 60 / 90 يومًا، لتجنب فقدان أي عميل.',
  },
  {
    emoji: '🤖',
    title: 'مساعد AI',
    desc: 'InsurNex Copilot يفهم بياناتك ويجيب على أي سؤال بأرقام حقيقية.',
  },
  {
    emoji: '📊',
    title: 'تحليلات وتقارير',
    desc: 'لوحات قيادة شاملة لأداء المحفظة، الإيرادات، والعمولات.',
  },
];

const STEPS = [
  {
    n: '1',
    title: 'أنشئ حسابك',
    desc: 'دقيقة واحدة، بدون بطاقة بنكية',
  },
  {
    n: '2',
    title: 'أضف عملاءك ووثائقك',
    desc: 'كل شيء جاهز ومحفوظ بأمان',
  },
  {
    n: '3',
    title: 'ابدأ الإدارة الذكية',
    desc: 'مساعد AI + تقارير لحظية',
  },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
    const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // If already logged in → go to app
  if (!loading && user) return <Navigate to="/" replace />;

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setMobileMenu(false);
  };

  return (
    <div dir="rtl" className="landing-page">
      {/* NAVBAR */}
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <img src="/branding/logo-light.png" alt="InsurNex" />
            <span>InsurNex</span>
          </div>

          <nav className="landing-nav-links">
            <button type="button" onClick={() => scrollTo('features')}>
              الميزات
            </button>
            <button type="button" onClick={() => scrollTo('how')}>
              كيف يعمل
            </button>
            <button type="button" onClick={() => scrollTo('pricing')}>
              الأسعار
            </button>
          </nav>

          <div className="landing-nav-actions">
            <button
              type="button"
              className="inx-icon-btn"
              onClick={toggleTheme}
              title="تبديل السمة"
            >
              {resolvedTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <Link to="/login" className="inx-btn inx-btn-secondary inx-btn-sm">
              تسجيل الدخول
            </Link>
            <Link to="/register" className="inx-btn inx-btn-primary inx-btn-sm">
              ابدأ مجانًا
            </Link>
            <button
              type="button"
              className="inx-icon-btn landing-mobile-toggle"
              onClick={() => setMobileMenu((v) => !v)}
            >
              {mobileMenu ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {mobileMenu && (
          <div className="landing-mobile-menu">
            <button type="button" onClick={() => scrollTo('features')}>
              الميزات
            </button>
            <button type="button" onClick={() => scrollTo('how')}>
              كيف يعمل
            </button>
            <button type="button" onClick={() => scrollTo('pricing')}>
              الأسعار
            </button>
            <Link to="/login">تسجيل الدخول</Link>
            <Link to="/register" className="inx-btn inx-btn-primary">
              ابدأ مجانًا
            </Link>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-content">
            <span className="landing-hero-badge">
              <Sparkles size={14} />
              <span>مدعوم بالذكاء الاصطناعي</span>
            </span>
            <h1>
              منصة إدارة الوساطة التأمينية
              <br />
              <span className="landing-hero-accent">بذكاء حقيقي</span>
            </h1>
            <p>
              InsurNex يجمع CRM، الوثائق، المطالبات، التجديدات، والمساعد الذكي
              في مكان واحد. صمّم خصيصًا لمكاتب وشركات الوساطة في مصر والمنطقة.
            </p>

            <div className="landing-hero-ctas">
              <Link to="/register" className="inx-btn inx-btn-primary">
                ابدأ تجربتك المجانية — 30 يوم
                <ArrowLeft size={16} />
              </Link>
              <button
                type="button"
                className="inx-btn inx-btn-secondary"
                onClick={() => scrollTo('how')}
              >
                كيف يعمل؟
              </button>
            </div>

            <div className="landing-hero-facts">
              <div>
                <CheckCircle2 size={16} />
                <span>بدون بطاقة بنكية</span>
              </div>
              <div>
                <CheckCircle2 size={16} />
                <span>30 يوم مجانية كاملة</span>
              </div>
              <div>
                <CheckCircle2 size={16} />
                <span>دعم بالعربية</span>
              </div>
            </div>
          </div>

          <div className="landing-hero-visual">
            <div className="landing-hero-card">
              <div className="landing-hero-card-head">
                <div className="landing-hero-dot" />
                <span>محفظتك اليوم</span>
                <Bell size={14} />
              </div>
              <div className="landing-hero-metrics">
                <div>
                  <b>248</b>
                  <small>عميل نشط</small>
                </div>
                <div>
                  <b>1.2M</b>
                  <small>إجمالي الأقساط</small>
                </div>
              </div>
              <div className="landing-hero-mini">
                <span className="landing-hero-mini-icon tone-cyan">
                  <ShieldCheck size={14} />
                </span>
                <div>
                  <b>32 وثيقة نشطة</b>
                  <small>12 تحتاج تجديد قريب</small>
                </div>
              </div>
              <div className="landing-hero-mini">
                <span className="landing-hero-mini-icon tone-purple">
                  <Bot size={14} />
                </span>
                <div>
                  <b>المساعد الذكي</b>
                  <small>اسأل عن أي عميل أو وثيقة</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="landing-section">
        <div className="landing-section-head">
          <span className="eyebrow">الميزات</span>
          <h2>كل ما يحتاجه مكتبك في منصة واحدة</h2>
          <p>
            بدلًا من 5 أنظمة مختلفة، InsurNex هو مركز التشغيل الرقمي الكامل.
          </p>
        </div>

        <div className="landing-features-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="landing-feature">
              <span className="landing-feature-emoji">{f.emoji}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="landing-section landing-section-alt">
        <div className="landing-section-head">
          <span className="eyebrow">كيف يعمل</span>
          <h2>3 خطوات للبدء</h2>
          <p>من التسجيل إلى الإدارة الذكية خلال دقائق.</p>
        </div>

        <div className="landing-steps">
          {STEPS.map((s) => (
            <div key={s.n} className="landing-step">
              <span className="landing-step-number">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="landing-section">
        <div className="landing-section-head">
          <span className="eyebrow">الأسعار</span>
          <h2>سعر واحد، كل الميزات</h2>
          <p>لا خطط معقدة. اختر InsurNex واحصل على كل شيء.</p>
        </div>

        <div className="landing-pricing">
          <div className="landing-price-card">
            <div className="landing-price-badge">
              <Zap size={14} /> الأكثر شعبية
            </div>
            <h3>InsurNex الكاملة</h3>
            <div className="landing-price-value">
              <b>300</b>
              <span>ج.م / شهر</span>
            </div>
            <small className="landing-price-sub">
              ابدأ بـ 30 يوم مجانية — بدون بطاقة بنكية
            </small>

            <ul className="landing-price-list">
              {[
                'عملاء غير محدودين',
                'وثائق ومطالبات غير محدودة',
                'المساعد الذكي (AI Copilot)',
                'تحليلات وتقارير لحظية',
                'تنبيهات التجديد التلقائية',
                'دعم عبر واتساب',
                'تحديثات مستمرة مجانًا',
              ].map((line) => (
                <li key={line}>
                  <CheckCircle2 size={16} />
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <Link
              to="/register"
              className="inx-btn inx-btn-primary inx-btn-block"
            >
              ابدأ 30 يوم مجانًا
              <ArrowLeft size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className="landing-section landing-section-alt">
        <div className="landing-section-head">
          <span className="eyebrow">لماذا InsurNex</span>
          <h2>الفرق الذي تشعر به من اليوم الأول</h2>
        </div>

        <div className="landing-benefits">
          <div className="landing-benefit">
            <span className="landing-benefit-icon tone-success">
              <RefreshCcw size={20} />
            </span>
            <h3>وفّر ساعات يوميًا</h3>
            <p>تنبيهات تلقائية، دورة عمل منظمة، ومتابعة مستمرة.</p>
          </div>
          <div className="landing-benefit">
            <span className="landing-benefit-icon tone-primary">
              <Bot size={20} />
            </span>
            <h3>AI يفهم بياناتك</h3>
            <p>اسأله عن أي عميل أو وثيقة أو مطالبة — يجيب بأرقام حقيقية.</p>
          </div>
          <div className="landing-benefit">
            <span className="landing-benefit-icon tone-cyan">
              <BarChart3 size={20} />
            </span>
            <h3>قرارات مبنية على أرقام</h3>
            <p>لوحات قيادة شاملة لأداء محفظتك وإيراداتك.</p>
          </div>
          <div className="landing-benefit">
            <span className="landing-benefit-icon tone-warning">
              <FileSearch size={20} />
            </span>
            <h3>تحليل ملفات ذكي</h3>
            <p>ارفع ملف Excel أو PDF واحصل على تحليل كامل تلقائي.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="cta" className="landing-cta">
        <div className="landing-cta-inner">
          <h2>جاهز تبدأ؟</h2>
          <p>
            انضم لمكاتب الوساطة التي تدير أعمالها بالكامل من InsurNex.
            <br />
            30 يوم مجانية، بدون بطاقة بنكية.
          </p>
          <div className="landing-cta-buttons">
            <Link to="/register" className="inx-btn inx-btn-primary">
              أنشئ حسابك الآن
              <ArrowLeft size={16} />
            </Link>
            <Link to="/login" className="inx-btn inx-btn-secondary">
              لدي حساب بالفعل
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <img src="/branding/logo-light.png" alt="InsurNex" />
            <div>
              <b>InsurNex</b>
              <small>منصة إدارة الوساطة التأمينية</small>
            </div>
          </div>

          <div className="landing-footer-links">
            <button type="button" onClick={() => scrollTo('features')}>
              الميزات
            </button>
            <button type="button" onClick={() => scrollTo('pricing')}>
              الأسعار
            </button>
            <Link to="/login">تسجيل الدخول</Link>
            <Link to="/register">إنشاء حساب</Link>
          </div>

          <div className="landing-footer-copy">
            <small>
              © 2026 InsurNex. جميع الحقوق محفوظة.
              <br />
              للتواصل: islamib2810@instapay · +201123152500
            </small>
          </div>
        </div>
      </footer>

      {/* FLOATING ROBOT */}
      <FloatingRobot />
    </div>
  );
}