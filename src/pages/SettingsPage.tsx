import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  Check,
  Copy,
  LogOut,
  Mail,
  Palette,
  Save,
  ShieldCheck,
  UserPlus,
  UserRound,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import { signOut } from '../features/auth/auth.service';
import ThemeSettings from '../theme/ThemeSettings';
import {
  changeUserPassword,
  getUserProfile,
  updateUserProfile,
} from '../features/settings/user-profile.service';
import {
  getOrganization,
  updateOrganization,
  type OrganizationProfile,
} from '../features/settings/organization.service';
import {
  createOrganizationInvitation,
  listOrganizationInvitations,
  revokeOrganizationInvitation,
  type InvitableRole,
  type OrganizationInvitation,
} from '../features/settings/organization-members.service';

type Tab = 'profile' | 'organization' | 'members' | 'security' | 'appearance';

const TABS: { id: Tab; label: string; icon: typeof UserRound }[] = [
  { id: 'profile', label: 'الملف الشخصي', icon: UserRound },
  { id: 'organization', label: 'المؤسسة', icon: Building2 },
  { id: 'members', label: 'أعضاء المؤسسة', icon: UserPlus },
  { id: 'security', label: 'الأمان', icon: ShieldCheck },
  { id: 'appearance', label: 'المظهر', icon: Palette },
];

export default function SettingsPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('profile');

  if (!user || !profile) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-container">
          <div className="inx-empty">
            <b>جاري التحميل...</b>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mobile-page" dir="rtl">
      <div className="inx-container">
        <header className="inx-section-head" style={{ marginTop: 0 }}>
          <div>
            <span className="eyebrow">InsurNex</span>
            <h2>الإعدادات</h2>
            <small style={{ color: 'var(--inx-muted)' }}>
              إدارة حسابك وبيانات مؤسستك وتفضيلاتك.
            </small>
          </div>
        </header>

        {/* TABS */}
        <div
          className="inx-card"
          style={{
            padding: 6,
            marginBottom: 16,
            display: 'flex',
            gap: 4,
            overflowX: 'auto',
          }}
        >
          {TABS.filter(({ id }) => id !== 'members' || ['owner', 'admin'].includes(profile.role)).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                flex: 1,
                minWidth: 120,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '10px 12px',
                border: 'none',
                borderRadius: 10,
                background: tab === id ? 'var(--inx-navy-bg)' : 'transparent',
                color: tab === id ? 'var(--inx-blue)' : 'var(--inx-muted)',
                font: 'inherit',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {tab === 'profile' && <ProfileTab uid={user.uid} />}
        {tab === 'organization' && (
          <OrganizationTab
            orgId={profile.organizationId}
            isOwner={profile.role === 'owner' || profile.role === 'admin'}
          />
        )}
        {tab === 'members' && (
          <MembersTab organizationId={profile.organizationId} inviterUid={user.uid} inviterRole={profile.role} />
        )}
        {tab === 'security' && (
          <SecurityTab
            onSignOutAll={async () => {
              await signOut();
              navigate('/login', { replace: true });
            }}
          />
        )}
        {tab === 'appearance' && (
          <div className="inx-card inx-card-lg">
            <div className="inx-card-head">
              <h3>المظهر</h3>
            </div>
            <ThemeSettings />
          </div>
        )}
      </div>
    </main>
  );
}

// ============================================================
// Organization Members Tab
// ============================================================

const ROLE_OPTIONS: { value: InvitableRole; label: string }[] = [
  { value: 'admin', label: 'مدير المؤسسة' },
  { value: 'broker', label: 'وسيط تأمين' },
  { value: 'sales', label: 'المبيعات' },
  { value: 'claims', label: 'المطالبات' },
  { value: 'finance', label: 'المالية' },
  { value: 'staff', label: 'موظف' },
];

const ROLE_LABELS: Record<string, string> = {
  owner: 'مالك المؤسسة',
  admin: 'مدير المؤسسة',
  broker: 'وسيط تأمين',
  sales: 'المبيعات',
  claims: 'المطالبات',
  finance: 'المالية',
  staff: 'موظف',
};

const INVITATION_STATUS_LABELS: Record<string, string> = {
  pending: 'معلّقة',
  accepted: 'مقبولة',
  revoked: 'ملغاة',
};

function MembersTab({
  organizationId,
  inviterUid,
  inviterRole,
}: {
  organizationId: string;
  inviterUid: string;
  inviterRole: string;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitableRole>('broker');
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [inviteUrl, setInviteUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function reload() {
    setLoading(true);
    try {
      setInvitations(await listOrganizationInvitations(organizationId));
    } catch (err) {
      setError('تعذر تحميل الدعوات. تحقق من صلاحيات المؤسسة واتصالك.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [organizationId]);

  async function submitInvitation(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setInviteUrl('');
    setSaving(true);
    try {
      const result = await createOrganizationInvitation({
        organizationId,
        invitedEmail: email,
        role: inviterRole === 'admin' && role === 'admin' ? 'broker' : role,
        inviterUid,
      });
      setInviteUrl(result.url);
      setEmail('');
      setMessage('تم إنشاء الدعوة. انسخ الرابط وأرسله إلى البريد المدعو من خلال قناة موثوقة. لا يرسل التطبيق البريد تلقائيًا.');
      await reload();
    } catch (err) {
      console.error(err);
      setError('تعذر إنشاء الدعوة. تحقق من البريد والدور وأن حسابك مالك أو مدير المؤسسة.');
    } finally {
      setSaving(false);
    }
  }

  async function copyInvitation() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setMessage('تم نسخ رابط الدعوة.');
    } catch {
      setError('تعذر نسخ الرابط تلقائيًا. حدّد الرابط وانسخه يدويًا.');
    }
  }

  async function revoke(invitationId: string) {
    setBusyId(invitationId);
    setError('');
    setMessage('');
    try {
      await revokeOrganizationInvitation(organizationId, invitationId, inviterUid);
      setMessage('تم إلغاء الدعوة.');
      await reload();
    } catch (err) {
      console.error(err);
      setError('تعذر إلغاء الدعوة.');
    } finally {
      setBusyId('');
    }
  }

  const roleOptions = inviterRole === 'owner'
    ? ROLE_OPTIONS
    : ROLE_OPTIONS.filter((item) => item.value !== 'admin');

  return (
    <section style={{ display: 'grid', gap: 16 }}>
      <div className="inx-card inx-card-lg">
        <div className="inx-card-head">
          <h3>دعوة عضو جديد</h3>
          <UserPlus size={18} style={{ color: 'var(--inx-muted)' }} />
        </div>
        <p style={{ color: 'var(--inx-text-soft)', fontSize: 13, lineHeight: 1.8, marginTop: 0 }}>
          الدعوة صالحة لمدة 7 أيام، ولا تُفعّل العضوية إلا بعد تسجيل الدخول والتحقق من البريد المدعو.
          الإرسال يتم يدويًا لتجنب اعتماد خدمة بريد مدفوعة.
        </p>
        <form onSubmit={submitInvitation} style={{ display: 'grid', gap: 12 }}>
          <Field label="البريد الإلكتروني للعضو">
            <input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" style={inputStyle} />
          </Field>
          <Field label="الدور داخل المؤسسة">
            <select value={role} onChange={(e) => setRole(e.target.value as InvitableRole)} style={inputStyle}>
              {roleOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </Field>
          <button className="inx-btn inx-btn-primary" type="submit" disabled={saving}>
            <Mail size={15} /> {saving ? 'جارٍ إنشاء الدعوة...' : 'إنشاء رابط الدعوة'}
          </button>
        </form>
        {inviteUrl && (
          <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
            <label style={{ fontSize: 12, color: 'var(--inx-muted)' }}>رابط الدعوة — لا ترسله إلا إلى البريد المحدد</label>
            <input readOnly value={inviteUrl} onFocus={(e) => e.currentTarget.select()} style={inputStyle} />
            <button type="button" className="inx-btn inx-btn-secondary" onClick={copyInvitation}><Copy size={15} /> نسخ الرابط</button>
          </div>
        )}
        {error && <div role="alert" style={errorBoxStyle}>{error}</div>}
        {message && <div role="status" style={successBoxStyle}><Check size={14} /> {message}</div>}
      </div>

      <div className="inx-card inx-card-lg">
        <div className="inx-card-head">
          <h3>سجل الدعوات</h3>
          <button type="button" className="inx-icon-btn" onClick={() => void reload()} title="تحديث القائمة"><Copy size={15} /></button>
        </div>
        {loading ? <div className="inx-empty">جارٍ تحميل الدعوات...</div> : invitations.length === 0 ? (
          <div className="inx-empty">لا توجد دعوات مسجلة للمؤسسة.</div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {invitations.map((item) => (
              <article key={item.id} style={{ border: '1px solid var(--inx-border)', borderRadius: 14, padding: 12, display: 'grid', gap: 7 }}>
                <strong style={{ overflowWrap: 'anywhere' }}>{item.invitedEmail}</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, color: 'var(--inx-text-soft)', fontSize: 12 }}>
                  <span>{ROLE_LABELS[item.role] || item.role}</span>
                  <span>•</span>
                  <span>{INVITATION_STATUS_LABELS[item.status] || item.status}</span>
                  <span>•</span>
                  <span>تنتهي: {item.expiresAt?.toDate ? item.expiresAt.toDate().toLocaleDateString('ar-EG') : '—'}</span>
                </div>
                {item.status === 'pending' && (
                  <button type="button" className="inx-btn inx-btn-secondary" style={{ justifySelf: 'start' }} disabled={busyId === item.id} onClick={() => void revoke(item.id)}>
                    <XCircle size={15} /> {busyId === item.id ? 'جارٍ الإلغاء...' : 'إلغاء الدعوة'}
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================
// Profile Tab
// ============================================================

function ProfileTab({ uid }: { uid: string }) {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const p = await getUserProfile(uid);
        setDisplayName(p?.displayName || '');
        setPhone(p?.phone || '');
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage('');
    setError('');
    setSaving(true);
    try {
      await updateUserProfile(uid, { displayName, phone });
      setMessage('تم حفظ التغييرات بنجاح.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setError('تعذر حفظ التغييرات: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="inx-empty">جاري التحميل...</div>;

  return (
    <form onSubmit={handleSubmit} className="inx-card inx-card-lg">
      <div className="inx-card-head">
        <h3>المعلومات الشخصية</h3>
        <UserRound size={18} style={{ color: 'var(--inx-muted)' }} />
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        <Field label="البريد الإلكتروني">
          <input
            type="email"
            value={user?.email || ''}
            disabled
            style={inputStyleDisabled}
          />
          <small style={{ fontSize: 11, color: 'var(--inx-muted)' }}>
            البريد الإلكتروني غير قابل للتعديل حاليًا.
          </small>
        </Field>

        <Field label="الاسم الكامل">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="محمد أحمد"
            style={inputStyle}
          />
        </Field>

        <Field label="رقم الجوال">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01xxxxxxxxx"
            style={inputStyle}
          />
        </Field>

        {error && <div style={errorBoxStyle}>{error}</div>}
        {message && (
          <div style={successBoxStyle}>
            <Check size={14} /> {message}
          </div>
        )}

        <div>
          <button
            type="submit"
            className="inx-btn inx-btn-primary"
            disabled={saving}
          >
            <Save size={15} /> {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </button>
        </div>
      </div>
    </form>
  );
}

// ============================================================
// Organization Tab
// ============================================================

function OrganizationTab({
  orgId,
  isOwner,
}: {
  orgId: string;
  isOwner: boolean;
}) {
  const [org, setOrg] = useState<OrganizationProfile | null>(null);
  const [form, setForm] = useState({
    name: '',
    legalName: '',
    phone: '',
    email: '',
    city: '',
    country: '',
    address: '',
    licenseNumber: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const o = await getOrganization(orgId);
        setOrg(o);
        if (o) {
          setForm({
            name: o.name || '',
            legalName: o.legalName || '',
            phone: o.phone || '',
            email: o.email || '',
            city: o.city || '',
            country: o.country || '',
            address: o.address || '',
            licenseNumber: o.licenseNumber || '',
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isOwner) return;
    setMessage('');
    setError('');
    setSaving(true);
    try {
      await updateOrganization(orgId, form);
      setMessage('تم حفظ بيانات المؤسسة.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setError('تعذر حفظ البيانات: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="inx-empty">جاري التحميل...</div>;
  if (!org) return <div className="inx-empty">لم يتم العثور على بيانات المؤسسة.</div>;

  return (
    <form onSubmit={handleSubmit} className="inx-card inx-card-lg">
      <div className="inx-card-head">
        <h3>بيانات المؤسسة</h3>
        <Building2 size={18} style={{ color: 'var(--inx-muted)' }} />
      </div>

      {!isOwner && (
        <div style={warningBoxStyle}>
          <AlertTriangle size={14} />
          أنت لا تملك صلاحية تعديل بيانات المؤسسة. تواصل مع المالك.
        </div>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        <Field label="اسم المؤسسة *">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            disabled={!isOwner}
            style={isOwner ? inputStyle : inputStyleDisabled}
          />
        </Field>

        <Field label="الاسم القانوني">
          <input
            type="text"
            value={form.legalName}
            onChange={(e) => setForm({ ...form, legalName: e.target.value })}
            disabled={!isOwner}
            style={isOwner ? inputStyle : inputStyleDisabled}
          />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="رقم الهاتف">
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              disabled={!isOwner}
              style={isOwner ? inputStyle : inputStyleDisabled}
            />
          </Field>

          <Field label="البريد الإلكتروني">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              disabled={!isOwner}
              style={isOwner ? inputStyle : inputStyleDisabled}
            />
          </Field>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="المدينة">
            <input
              type="text"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              disabled={!isOwner}
              style={isOwner ? inputStyle : inputStyleDisabled}
            />
          </Field>

          <Field label="الدولة">
            <input
              type="text"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              disabled={!isOwner}
              style={isOwner ? inputStyle : inputStyleDisabled}
            />
          </Field>
        </div>

        <Field label="العنوان">
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            disabled={!isOwner}
            style={isOwner ? inputStyle : inputStyleDisabled}
          />
        </Field>

        <Field label="رقم الترخيص">
          <input
            type="text"
            value={form.licenseNumber}
            onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
            disabled={!isOwner}
            style={isOwner ? inputStyle : inputStyleDisabled}
          />
        </Field>

        {error && <div style={errorBoxStyle}>{error}</div>}
        {message && (
          <div style={successBoxStyle}>
            <Check size={14} /> {message}
          </div>
        )}

        {isOwner && (
          <div>
            <button
              type="submit"
              className="inx-btn inx-btn-primary"
              disabled={saving}
            >
              <Save size={15} /> {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}

// ============================================================
// Security Tab
// ============================================================

function SecurityTab({
  onSignOutAll,
}: {
  onSignOutAll: () => Promise<void>;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage('');
    setError('');

    if (next !== confirm) {
      setError('كلمتا المرور الجديدتان غير متطابقتين.');
      return;
    }
    if (next.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
      return;
    }

    setBusy(true);
    try {
      await changeUserPassword(current, next);
      setMessage('تم تغيير كلمة المرور بنجاح.');
      setCurrent('');
      setNext('');
      setConfirm('');
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === 'CURRENT_PASSWORD_WRONG') {
        setError('كلمة المرور الحالية غير صحيحة.');
      } else if (msg === 'PASSWORD_TOO_SHORT') {
        setError('كلمة المرور قصيرة جدًا.');
      } else {
        setError('تعذر تغيير كلمة المرور: ' + msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <form onSubmit={handleSubmit} className="inx-card inx-card-lg">
        <div className="inx-card-head">
          <h3>تغيير كلمة المرور</h3>
          <ShieldCheck size={18} style={{ color: 'var(--inx-muted)' }} />
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          <Field label="كلمة المرور الحالية *">
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              autoComplete="current-password"
              style={inputStyle}
            />
          </Field>

          <Field label="كلمة المرور الجديدة *">
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              style={inputStyle}
            />
          </Field>

          <Field label="تأكيد كلمة المرور الجديدة *">
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              style={inputStyle}
            />
          </Field>

          {error && <div style={errorBoxStyle}>{error}</div>}
          {message && (
            <div style={successBoxStyle}>
              <Check size={14} /> {message}
            </div>
          )}

          <div>
            <button
              type="submit"
              className="inx-btn inx-btn-primary"
              disabled={busy || !current || !next || !confirm}
            >
              <ShieldCheck size={15} />{' '}
              {busy ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
            </button>
          </div>
        </div>
      </form>

      <div className="inx-card inx-card-lg">
        <div className="inx-card-head">
          <h3>الجلسات</h3>
          <LogOut size={18} style={{ color: 'var(--inx-muted)' }} />
        </div>
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 13,
            color: 'var(--inx-text-soft)',
          }}
        >
          تسجيل الخروج من هذا الجهاز. لأسباب أمنية، سيُطلب منك تسجيل الدخول مجددًا.
        </p>
        <button
          type="button"
          className="inx-btn inx-btn-secondary"
          onClick={() => void onSignOutAll()}
        >
          <LogOut size={15} /> تسجيل الخروج
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span
        style={{ fontSize: 12, color: 'var(--inx-muted)', fontWeight: 700 }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle = {
  padding: '10px 12px',
  border: '1px solid var(--inx-border)',
  borderRadius: 'var(--inx-radius-sm)',
  background: 'var(--inx-surface)',
  color: 'var(--inx-text)',
  fontSize: 14,
  fontFamily: 'inherit',
} as const;

const inputStyleDisabled = {
  ...inputStyle,
  background: 'var(--inx-bg)',
  color: 'var(--inx-muted)',
  cursor: 'not-allowed',
} as const;

const errorBoxStyle = {
  padding: '10px 12px',
  background: 'var(--inx-danger-bg)',
  color: 'var(--inx-danger)',
  borderRadius: 'var(--inx-radius-sm)',
  fontSize: 12.5,
} as const;

const successBoxStyle = {
  padding: '10px 12px',
  background: 'var(--inx-success-bg)',
  color: 'var(--inx-success)',
  borderRadius: 'var(--inx-radius-sm)',
  fontSize: 12.5,
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
} as const;

const warningBoxStyle = {
  padding: '10px 12px',
  background: 'var(--inx-warning-bg)',
  color: 'var(--inx-warning)',
  borderRadius: 'var(--inx-radius-sm)',
  fontSize: 12.5,
  marginBottom: 14,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
} as const;