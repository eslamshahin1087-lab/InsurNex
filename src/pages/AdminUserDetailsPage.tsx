import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
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
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../features/auth/auth-context';
import {
  activateSubscription,
  deleteUserData,
  extendSubscription,
  suspendSubscription,
} from '../features/subscription/subscription.service';
import type { SubscriptionCode } from '../features/subscription/subscription.types';
import { formatEGP } from '../features/admin/pricing.config';
import { downloadInvoicePDF } from '../features/admin/invoice.service';
import '../theme/admin-finance.css';

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
  lastCodeUsed?: string;
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
  const { user: currentAdmin, profile } = useAuth();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [sub, setSub] = useState<SubDetail | null>(null);
  const [codes, setCodes] = useState<SubscriptionCode[]>([]);
  const [counts, setCounts] = useState<Counts>({
    clients: 0,
    policies: 0,
    claims: 0,
    leads: 0,
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null);
  const [copiedUID, setCopiedUID] = useState(false);

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

      try {
        const codesQ = query(
          collection(db, 'subscriptionCodes'),
          where('usedBy.uid', '==', uid),
          limit(200),
        );
        const codesSnap = await getDocs(codesQ);
        const rows = codesSnap.docs.map(
          (d) => ({ code: d.id, ...d.data() } as SubscriptionCode),
        );
        rows.sort((a, b) => {
          const da = (a.usedAt as { seconds?: number })?.seconds ?? 0;
          const db_ = (b.usedAt as { seconds?: number })?.seconds ?? 0;
          return db_ - da;
        });
        setCodes(rows);
      } catch {
        setCodes([]);
      }

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

  function adminContext() {
    if (!currentAdmin) return undefined;
    return {
      uid: currentAdmin.uid,
      name: profile?.displayName || 'Admin',
      email: currentAdmin.email || undefined,
    };
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
    if (!window.confirm('إيقاف هذا الاشتراك؟ (سيُحفظ في الأرشيف)')) return;
    setBusy(true);
    try {
      await suspendSubscription(
        user.organizationId,
        adminContext(),
        'إيقاف اشتراك من صفحة تفاصيل المستخدم',
      );
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
    const label = user?.displayName || user?.email || uid.slice(0, 8);
    if (
      !window.confirm(
        `حذف المستخدم "${label}"؟\n\nسيتم حذف:\n• ملفه الشخصي\n• مؤسسته\n• اشتراكه\n\nسيُحفظ كل شيء في الأرشيف ويمكن استعادته.`,
      )
    )
      return;
    setBusy(true);
    try {
      await deleteUserData(
        uid,
        adminContext(),
        `حذف نهائي من صفحة التفاصيل — ${label}`,
      );
      navigate('/admin-panel/users');
    } catch (e) {
      console.error(e);
      alert('تعذر حذف المستخدم: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copyUID() {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(user.uid);
      setCopiedUID(true);
      setTimeout(() => setCopiedUID(false), 1500);
    } catch {
      /* ignore */
    }
  }

  async function handleInvoice(c: SubscriptionCode) {
    if (!user) return;
    setGeneratingPDF(c.code);
    try {
      await downloadInvoicePDF({
        transaction: {
          code: c.code,
          planType: c.planType,
          planName: c.planName,
          duration: c.duration,
          subtotal: c.subtotal,
          vatAmount: c.vatAmount,
          total: c.total,
          organizationId: c.usedBy?.organizationId,
          organizationName: org?.name,
          userName: c.usedBy?.userName || user.displayName,
          userEmail: c.usedBy?.userEmail || user.email,
          usedAt: (c.usedAt as { toDate?: () => Date })?.toDate?.(),
          usedAtRaw: c.usedAt,
        },
        organizationName: org?.name,
        organizationType: org?.type,
      });
    } catch (e) {
      console.error(e);
      alert('تعذر إنشاء الفاتورة: ' + (e as Error).message);
    } finally {
      setGeneratingPDF(null);
    }
  }

  if (loading) {
    return (
      <div className="admin-page-head">
        <span className="eyebrow">Admin · User</span>
        <h1>جاري التحميل...</h1>
      </div>
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
  const totalPaid = codes.reduce((s, c) => s + (c.total || 0), 0);
  const totalVAT = codes.reduce((s, c) => s + (c.vatAmount || 0), 0);

  return (
    <>
      <div className="admin-page-head">
        <Link
          to="/admin-panel/users"
          className="inx-link"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8 }}
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
          <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            {user.role && <span className="inx-badge inx-badge-primary">{user.role}</span>}
            {user.status === 'active' ? (
              <span className="inx-badge inx-badge-success">نشط</span>
            ) : (
              <span className="inx-badge inx-badge-neutral">{user.status || 'غير نشط'}</span>
            )}
            {isActive && <span className="inx-badge inx-badge-success">اشتراك نشط</span>}
            {isTrial && <span className="inx-badge inx-badge-warning">تجربة مجانية</span>}
            {isExpired && <span className="inx-badge inx-badge-danger">اشتراك منتهي</span>}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--inx-muted)',
              fontSize: 12.5,
            }}
          >
            <span>UID:</span>
            <span style={{ fontFamily: 'monospace' }}>{user.uid}</span>
            <button
              type="button"
              className="inx-icon-btn"
              onClick={() => void copyUID()}
              title="نسخ UID"
              style={{ width: 28, height: 28 }}
            >
              {copiedUID ? (
                <CheckCircle2 size={14} style={{ color: 'var(--inx-success)' }} />
              ) : (
                <Copy size={14} />
              )}
            </button>
          </div>
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

      {/* FINANCIAL KPIs */}
      <section className="fin-section">
        <h3 className="fin-section-title">الملخص المالي</h3>
        <div className="admin-kpi-grid">
          <article className="admin-kpi">
            <span className="admin-kpi-icon tone-success">
              <Banknote size={20} />
            </span>
            <div className="admin-kpi-value">{formatEGP(totalPaid)}</div>
            <div className="admin-kpi-label">إجمالي المدفوعات</div>
            <div className="fin-kpi-sub">ضريبة: {formatEGP(totalVAT)}</div>
          </article>
          <article className="admin-kpi">
            <span className="admin-kpi-icon tone-primary">
              <CreditCard size={20} />
            </span>
            <div className="admin-kpi-value">{codes.length}</div>
            <div className="admin-kpi-label">عدد الأكواد المستخدمة</div>
          </article>
          <article className="admin-kpi">
            <span className="admin-kpi-icon tone-warning">
              <Clock size={20} />
            </span>
            <div className="admin-kpi-value">
              {sub
                ? Math.max(
                    0,
                    Math.round(
                      (new Date(sub.endDate).getTime() - Date.now()) / 86400000,
                    ),
                  )
                : 0}
            </div>
            <div className="admin-kpi-label">أيام متبقية في الاشتراك</div>
          </article>
          <article className="admin-kpi">
            <span className="admin-kpi-icon tone-purple">
              <Building2 size={20} />
            </span>
            <div className="admin-kpi-value">{org ? '1' : '0'}</div>
            <div className="admin-kpi-label">مؤسسة مرتبطة</div>
          </article>
        </div>
      </section>

      {/* USER INFO + ORG */}
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
            {org && (
              <Link
                to={`/admin-panel/subscriptions`}
                className="inx-link"
                style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <ExternalLink size={12} /> عرض الاشتراك
              </Link>
            )}
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
                  <b style={{ fontFamily: 'monospace', fontSize: 12 }}>{org.id}</b>
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
              {sub.lastCodeUsed && <Stat label="آخر كود" value={sub.lastCodeUsed} />}
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

      {/* ACTIVITY COUNTS */}
      <section className="fin-section">
        <h3 className="fin-section-title">النشاط داخل المؤسسة</h3>
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
      </section>

      {/* TRANSACTIONS */}
      <section className="fin-section">
        <h3 className="fin-section-title">المعاملات المالية ({codes.length})</h3>
        <div className="admin-table-wrap">
          {codes.length === 0 ? (
            <div className="fin-empty-table">لا توجد معاملات بعد</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>الكود</th>
                  <th>الخطة</th>
                  <th>قبل الضريبة</th>
                  <th>الضريبة</th>
                  <th>الإجمالي</th>
                  <th>التاريخ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.code}>
                    <td
                      className="mono"
                      style={{ fontFamily: 'monospace', fontSize: 12 }}
                    >
                      {c.code}
                    </td>
                    <td>{c.planName || c.planType}</td>
                    <td>{formatEGP(c.subtotal)}</td>
                    <td>{formatEGP(c.vatAmount)}</td>
                    <td>
                      <b>{formatEGP(c.total)}</b>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--inx-muted)' }}>
                      {fmt(c.usedAt)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="inx-icon-btn"
                        onClick={() => void handleInvoice(c)}
                        disabled={generatingPDF === c.code}
                        title="تحميل الفاتورة PDF"
                      >
                        <FileText
                          size={15}
                          style={{
                            opacity: generatingPDF === c.code ? 0.4 : 1,
                          }}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
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