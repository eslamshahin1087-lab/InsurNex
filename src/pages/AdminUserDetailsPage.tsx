import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Mail,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
  XCircle,
} from 'lucide-react';
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  activateSubscription,
  deleteUserData,
  extendSubscription,
  suspendSubscription,
} from '../features/subscription/subscription.service';

interface UserDetail {
  uid: string;
  email?: string;
  displayName?: string;
  role?: string;
  organizationId?: string;
  status?: string;
  createdAt?: { toDate?: () => Date } | null;
}

interface OrgDetail {
  id: string;
  name?: string;
  type?: string;
  ownerId?: string;
  createdAt?: { toDate?: () => Date } | null;
}

interface SubDetail {
  organizationId: string;
  status: string;
  endDate: string;
  startDate: string;
  plan: string;
}

interface Counts {
  clients: number;
  policies: number;
  claims: number;
  leads: number;
}

export default function AdminUserDetailsPage() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [sub, setSub] = useState<SubDetail | null>(null);
  const [counts, setCounts] = useState<Counts>({
    clients: 0,
    policies: 0,
    claims: 0,
    leads: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const userSnap = await getDoc(doc(db, 'users', uid));
      if (!userSnap.exists()) {
        setUser(null);
        return;
      }
      const userData = { uid: userSnap.id, ...userSnap.data() } as UserDetail;
      setUser(userData);

      if (userData.organizationId) {
        const [orgSnap, subSnap] = await Promise.all([
          getDoc(doc(db, 'organizations', userData.organizationId)),
          getDoc(doc(db, 'organizationSubscriptions', userData.organizationId)),
        ]);
        if (orgSnap.exists()) {
          setOrg({ id: orgSnap.id, ...orgSnap.data() } as OrgDetail);
        }
        if (subSnap.exists()) {
          setSub(subSnap.data() as SubDetail);
        }

        // Counts for this organization
        const [c, p, cl, l] = await Promise.all([
          getCountFromServer(
            query(
              collection(db, 'clients'),
              where('organizationId', '==', userData.organizationId),
            ),
          ),
          getCountFromServer(
            query(
              collection(db, 'policies'),
              where('organizationId', '==', userData.organizationId),
            ),
          ),
          getCountFromServer(
            query(
              collection(db, 'claims'),
              where('organizationId', '==', userData.organizationId),
            ),
          ),
          getCountFromServer(
            query(
              collection(db, 'leads'),
              where('organizationId', '==', userData.organizationId),
            ),
          ),
        ]);
        setCounts({
          clients: c.data().count,
          policies: p.data().count,
          claims: cl.data().count,
          leads: l.data().count,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    void load();
  }, [load]);

  function fmt(v: unknown): string {
    if (!v) return '—';
    const date = (v as { toDate?: () => Date }).toDate?.();
    if (!date) return '—';
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  }

  async function handleExtend(days: number) {
    if (!user?.organizationId) return;
    if (!window.confirm(`تمديد ${days} يوم لهذه المؤسسة؟`)) return;
    setBusy(true);
    try {
      await extendSubscription({
        organizationId: user.organizationId,
        days,
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleSuspend() {
    if (!user?.organizationId) return;
    if (!window.confirm('إيقاف هذا الاشتراك؟')) return;
    setBusy(true);
    try {
      await suspendSubscription(user.organizationId);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleActivate() {
    if (!user?.organizationId) return;
    setBusy(true);
    try {
      await activateSubscription(user.organizationId);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteUser() {
    if (!uid) return;
    if (
      !window.confirm(
        'هل أنت متأكد من حذف هذا المستخدم؟\n\nسيتم حذف:\n- ملفه الشخصي\n- مؤسسته\n- اشتراكه\n\nلا يمكن التراجع عن هذه العملية.',
      )
    )
      return;
    setBusy(true);
    try {
      await deleteUserData(uid);
      navigate('/admin-panel/users');
    } catch (e) {
      console.error(e);
      alert('تعذر حذف المستخدم.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <>
        <div className="admin-page-head">
          <span className="eyebrow">Admin · User</span>
          <h1>جاري التحميل...</h1>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <div className="admin-page-head">
          <span className="eyebrow">Admin · User</span>
          <h1>المستخدم غير موجود</h1>
        </div>
        <Link to="/admin-panel/users" className="inx-btn inx-btn-secondary">
          <ArrowLeft size={16} /> عودة للمستخدمين
        </Link>
      </>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const isActive = sub?.status === 'active' && sub.endDate >= today;
  const isTrial = sub?.status === 'trial';
  const isExpired = !sub || sub.endDate < today || sub.status === 'suspended';

  return (
    <>
      <div className="admin-page-head">
        <Link
          to="/admin-panel/users"
          className="inx-link"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
          }}
        >
          <ArrowLeft size={16} /> المستخدمون
        </Link>
        <span className="eyebrow">Admin · User Details</span>
        <h1>{user.displayName || 'مستخدم'}</h1>
        <p>{user.email || '—'}</p>
      </div>

      {/* HEADER CARD */}
      <div
        className="inx-card inx-card-lg"
        style={{
          display: 'flex',
          gap: 20,
          alignItems: 'center',
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <div
          className="inx-avatar"
          style={{ width: 72, height: 72, fontSize: 24, borderRadius: 18 }}
        >
          {(user.displayName || 'U').slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div
            style={{
              display: 'flex',
              gap: 8,
              marginBottom: 6,
              flexWrap: 'wrap',
            }}
          >
            {user.role && (
              <span className="inx-badge inx-badge-primary">{user.role}</span>
            )}
            {user.status === 'active' ? (
              <span className="inx-badge inx-badge-success">نشط</span>
            ) : (
              <span className="inx-badge inx-badge-neutral">
                {user.status || 'غير نشط'}
              </span>
            )}
            {isActive && (
              <span className="inx-badge inx-badge-success">
                اشتراك نشط
              </span>
            )}
            {isTrial && (
              <span className="inx-badge inx-badge-warning">تجربة مجانية</span>
            )}
            {isExpired && (
              <span className="inx-badge inx-badge-danger">اشتراك منتهي</span>
            )}
          </div>
          <small style={{ color: 'var(--inx-muted)', fontSize: 12.5 }}>
            UID: <span style={{ fontFamily: 'monospace' }}>{user.uid}</span>
          </small>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="inx-icon-btn"
            onClick={() => void load()}
            title="تحديث"
            disabled={busy}
          >
            <RefreshCw size={16} />
          </button>
          <button
            type="button"
            className="inx-btn inx-btn-danger"
            onClick={() => void handleDeleteUser()}
            disabled={busy}
          >
            <Trash2 size={16} /> حذف المستخدم
          </button>
        </div>
      </div>

      {/* USER INFO */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div className="inx-card">
          <div className="inx-card-head">
            <h3>
              <UserRound size={16} style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />
              البيانات الشخصية
            </h3>
          </div>
          <ul className="inx-list">
            <li className="inx-list-item">
              <span className="inx-icon-circle inx-icon-circle-sm">
                <UserRound size={14} />
              </span>
              <div className="inx-list-copy">
                <small>الاسم</small>
                <b>{user.displayName || '—'}</b>
              </div>
            </li>
            <li className="inx-list-item">
              <span className="inx-icon-circle inx-icon-circle-sm">
                <Mail size={14} />
              </span>
              <div className="inx-list-copy">
                <small>البريد</small>
                <b>{user.email || '—'}</b>
              </div>
            </li>
            <li className="inx-list-item">
              <span className="inx-icon-circle inx-icon-circle-sm tone-success">
                <ShieldCheck size={14} />
              </span>
              <div className="inx-list-copy">
                <small>الدور</small>
                <b>{user.role || '—'}</b>
              </div>
            </li>
            <li className="inx-list-item">
              <span className="inx-icon-circle inx-icon-circle-sm">
                <Calendar size={14} />
              </span>
              <div className="inx-list-copy">
                <small>تاريخ التسجيل</small>
                <b>{fmt(user.createdAt)}</b>
              </div>
            </li>
          </ul>
        </div>

        <div className="inx-card">
          <div className="inx-card-head">
            <h3>
              <Building2 size={16} style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />
              المؤسسة
            </h3>
          </div>
          {org ? (
            <ul className="inx-list">
              <li className="inx-list-item">
                <span className="inx-icon-circle inx-icon-circle-sm tone-cyan">
                  <Building2 size={14} />
                </span>
                <div className="inx-list-copy">
                  <small>الاسم</small>
                  <b>{org.name || '—'}</b>
                </div>
              </li>
              <li className="inx-list-item">
                <span className="inx-icon-circle inx-icon-circle-sm">
                  <ShieldCheck size={14} />
                </span>
                <div className="inx-list-copy">
                  <small>النوع</small>
                  <b>
                    {org.type === 'company'
                      ? 'شركة'
                      : org.type === 'office'
                      ? 'مكتب'
                      : 'فرد'}
                  </b>
                </div>
              </li>
              <li className="inx-list-item">
                <span className="inx-icon-circle inx-icon-circle-sm">
                  <Calendar size={14} />
                </span>
                <div className="inx-list-copy">
                  <small>تاريخ الإنشاء</small>
                  <b>{fmt(org.createdAt)}</b>
                </div>
              </li>
              <li className="inx-list-item">
                <div className="inx-list-copy">
                  <small>Organization ID</small>
                  <b style={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {org.id}
                  </b>
                </div>
              </li>
            </ul>
          ) : (
            <div style={{ padding: 16, color: 'var(--inx-muted)', fontSize: 13 }}>
              لا توجد مؤسسة مرتبطة.
            </div>
          )}
        </div>
      </div>

      {/* SUBSCRIPTION */}
      <div className="inx-card inx-card-lg" style={{ marginBottom: 20 }}>
        <div className="inx-card-head">
          <h3>
            <CreditCard size={16} style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />
            الاشتراك
          </h3>
        </div>
        {sub ? (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 12,
                marginBottom: 14,
              }}
            >
              <Stat label="الحالة" value={sub.status} />
              <Stat label="الخطة" value={sub.plan} />
              <Stat label="يبدأ" value={sub.startDate} />
              <Stat label="ينتهي" value={sub.endDate} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="inx-btn inx-btn-secondary inx-btn-sm"
                onClick={() => void handleExtend(30)}
                disabled={busy}
              >
                +30 يوم
              </button>
              <button
                type="button"
                className="inx-btn inx-btn-secondary inx-btn-sm"
                onClick={() => void handleExtend(90)}
                disabled={busy}
              >
                +90 يوم
              </button>
              {sub.status === 'suspended' ? (
                <button
                  type="button"
                  className="inx-btn inx-btn-primary inx-btn-sm"
                  onClick={() => void handleActivate()}
                  disabled={busy}
                >
                  <CheckCircle2 size={13} /> تفعيل
                </button>
              ) : (
                <button
                  type="button"
                  className="inx-btn inx-btn-danger inx-btn-sm"
                  onClick={() => void handleSuspend()}
                  disabled={busy}
                >
                  <XCircle size={13} /> إيقاف
                </button>
              )}
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--inx-muted)', fontSize: 13 }}>
            لا يوجد اشتراك مسجّل.
          </div>
        )}
      </div>

      {/* COUNTS */}
      <div className="inx-section-head">
        <h2>النشاط داخل المؤسسة</h2>
      </div>
      <div className="admin-kpi-grid">
        <article className="admin-kpi">
          <span className="admin-kpi-icon">
            <UserRound size={20} />
          </span>
          <div className="admin-kpi-value">{counts.clients}</div>
          <div className="admin-kpi-label">عملاء</div>
        </article>
        <article className="admin-kpi">
          <span className="admin-kpi-icon tone-success">
            <ShieldCheck size={20} />
          </span>
          <div className="admin-kpi-value">{counts.policies}</div>
          <div className="admin-kpi-label">وثائق</div>
        </article>
        <article className="admin-kpi">
          <span className="admin-kpi-icon tone-warning">
            <Clock size={20} />
          </span>
          <div className="admin-kpi-value">{counts.claims}</div>
          <div className="admin-kpi-label">مطالبات</div>
        </article>
        <article className="admin-kpi">
          <span className="admin-kpi-icon tone-purple">
            <CheckCircle2 size={20} />
          </span>
          <div className="admin-kpi-value">{counts.leads}</div>
          <div className="admin-kpi-label">عملاء محتملون</div>
        </article>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: 'var(--inx-bg)',
        padding: '10px 14px',
        borderRadius: 'var(--inx-radius-sm)',
      }}
    >
      <small
        style={{
          display: 'block',
          color: 'var(--inx-muted)',
          fontSize: 11.5,
          marginBottom: 4,
        }}
      >
        {label}
      </small>
      <b style={{ color: 'var(--inx-text)', fontSize: 13.5 }}>{value}</b>
    </div>
  );
}