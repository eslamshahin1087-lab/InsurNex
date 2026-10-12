import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  Plus,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import {
  activateSubscription,
  extendSubscription,
  isCurrentUserAdmin,
  listAllSubscriptions,
  suspendSubscription,
} from '../features/subscription/subscription.service';
import type { OrganizationSubscription } from '../features/subscription/subscription.types';

export default function AdminSubscriptionsPage() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [subscriptions, setSubscriptions] = useState<OrganizationSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    void isCurrentUserAdmin(user.uid).then(setAllowed);
  }, [user?.uid]);

  const load = useCallback(async () => {
    if (allowed !== true) return;
    setLoading(true);
    try {
      const subs = await listAllSubscriptions(200);
      setSubscriptions(subs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [allowed]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleExtend(orgId: string, days: number) {
    if (!window.confirm(`تمديد ${days} يوم لهذه المؤسسة؟`)) return;
    setBusyId(orgId);
    try {
      await extendSubscription({ organizationId: orgId, days });
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
    }
  }

  async function handleSuspend(orgId: string) {
    if (!window.confirm('إيقاف هذا الاشتراك؟')) return;
    setBusyId(orgId);
    try {
      await suspendSubscription(orgId);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
    }
  }

  async function handleActivate(orgId: string) {
    setBusyId(orgId);
    try {
      await activateSubscription(orgId);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
    }
  }

  if (allowed === null) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-container">
          <div className="inx-empty">
            <b>جاري التحقق...</b>
          </div>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-container">
          <div className="inx-empty">
            <b>غير مصرح</b>
            <Link to="/" className="inx-btn inx-btn-secondary" style={{ marginTop: 8 }}>
              <ArrowLeft size={16} /> العودة
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const now = new Date().toISOString().slice(0, 10);

  function statusOf(sub: OrganizationSubscription) {
    if (sub.status === 'suspended') return { label: 'موقوف', tone: 'danger' };
    if (sub.endDate < now) return { label: 'منتهي', tone: 'danger' };
    if (sub.status === 'trial') return { label: 'تجربة', tone: 'warning' };
    return { label: 'نشط', tone: 'success' };
  }

  return (
    <main className="mobile-page" dir="rtl">
      <div className="inx-container">
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            padding: '4px 0 14px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <Link
              to="/admin"
              className="inx-link"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6 }}
            >
              <ArrowLeft size={16} /> لوحة التحكم
            </Link>
            <span className="eyebrow">Admin · Subscriptions</span>
            <h2 style={{ margin: '2px 0 0', fontSize: 20, color: 'var(--inx-text)' }}>
              إدارة الاشتراكات
            </h2>
          </div>
          <button
            type="button"
            className="inx-icon-btn"
            onClick={() => void load()}
            title="تحديث"
          >
            <RefreshCw size={16} />
          </button>
        </header>

        <div className="inx-section-head">
          <h2>قائمة المؤسسات</h2>
          <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
            {subscriptions.length} مؤسسة
          </small>
        </div>

        {loading ? (
          <div className="inx-empty">جاري التحميل...</div>
        ) : subscriptions.length === 0 ? (
          <div className="inx-empty">
            <Building2 size={28} />
            <b>لا توجد اشتراكات</b>
          </div>
        ) : (
          <ul className="inx-list">
            {subscriptions.map((sub) => {
              const st = statusOf(sub);
              const isBusy = busyId === sub.organizationId;
              return (
                <li key={sub.organizationId} className="inx-list-item" style={{ flexWrap: 'wrap' }}>
                  <span className={`inx-icon-circle tone-${st.tone}`}>
                    <Building2 size={16} />
                  </span>
                  <div className="inx-list-copy" style={{ minWidth: 200 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 3,
                        flexWrap: 'wrap',
                      }}
                    >
                      <b style={{ fontFamily: 'monospace', fontSize: 13 }}>
                        {sub.organizationId.slice(0, 12)}…
                      </b>
                      <span className={`inx-badge inx-badge-${st.tone}`}>{st.label}</span>
                    </div>
                    <small style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={12} /> ينتهي: {sub.endDate}
                      {sub.lastCodeUsed ? ` · آخر كود: ${sub.lastCodeUsed}` : ''}
                    </small>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="inx-btn inx-btn-sm inx-btn-secondary"
                      onClick={() => void handleExtend(sub.organizationId, 30)}
                      disabled={isBusy}
                      title="تمديد 30 يوم"
                    >
                      <Plus size={13} /> 30 يوم
                    </button>
                    <button
                      type="button"
                      className="inx-btn inx-btn-sm inx-btn-secondary"
                      onClick={() => void handleExtend(sub.organizationId, 90)}
                      disabled={isBusy}
                      title="تمديد 90 يوم"
                    >
                      <Clock3 size={13} /> 90 يوم
                    </button>
                    {sub.status === 'suspended' ? (
                      <button
                        type="button"
                        className="inx-btn inx-btn-sm inx-btn-primary"
                        onClick={() => void handleActivate(sub.organizationId)}
                        disabled={isBusy}
                      >
                        <CheckCircle2 size={13} /> تفعيل
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="inx-btn inx-btn-sm inx-btn-danger"
                        onClick={() => void handleSuspend(sub.organizationId)}
                        disabled={isBusy}
                      >
                        <XCircle size={13} /> إيقاف
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}