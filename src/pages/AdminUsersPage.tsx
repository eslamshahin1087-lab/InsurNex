import { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../features/auth/auth-context';
import { deleteUserData } from '../features/subscription/subscription.service';

interface BrokerUser {
  uid: string;
  email?: string;
  displayName?: string;
  role?: string;
  organizationId?: string;
  status?: string;
  createdAt?: { toDate?: () => Date } | null;
}

export default function AdminUsersPage() {
  const { user: currentUser, profile } = useAuth();
  const [users, setUsers] = useState<BrokerUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        limit(200),
      );
      const snap = await getDocs(q);
      setUsers(
        snap.docs.map((d) => ({ uid: d.id, ...d.data() })) as BrokerUser[],
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [u.displayName, u.email, u.organizationId, u.role]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  const orgs = new Set(users.map((u) => u.organizationId).filter(Boolean));
  const active = users.filter((u) => u.status === 'active').length;

  function formatDate(value: BrokerUser['createdAt']): string {
    const d = value?.toDate?.();
    if (!d) return '—';
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  }

  async function handleDelete(u: BrokerUser) {
    if (!currentUser) return;

    const label = u.displayName || u.email || u.uid.slice(0, 8);
    const ok = window.confirm(
      `حذف المستخدم "${label}"؟\n\n` +
        `سيتم:\n` +
        `• حذف ملف المستخدم\n` +
        `• حذف المؤسسة المرتبطة (إن وُجدت)\n` +
        `• حذف الاشتراك المرتبط (إن وُجد)\n\n` +
        `سيُحفظ كل شيء في الأرشيف ويمكن استعادته.`,
    );
    if (!ok) return;

    setDeleting(u.uid);
    try {
      await deleteUserData(
        u.uid,
        {
          uid: currentUser.uid,
          name: profile?.displayName || 'Admin',
          email: currentUser.email || undefined,
        },
        `حذف نهائي من صفحة المستخدمين — ${label}`,
      );
      // Remove from list immediately
      setUsers((prev) => prev.filter((x) => x.uid !== u.uid));
    } catch (e) {
      console.error(e);
      alert('فشل الحذف: ' + (e as Error).message);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <div className="admin-page-head">
        <span className="eyebrow">Admin · Users</span>
        <h1>المستخدمون</h1>
        <p>استعراض وإدارة جميع المستخدمين المسجلين في النظام.</p>
      </div>

      <div className="admin-kpi-grid">
        <article className="admin-kpi">
          <span className="admin-kpi-icon">
            <Users size={20} />
          </span>
          <div className="admin-kpi-value">{users.length}</div>
          <div className="admin-kpi-label">إجمالي المستخدمين</div>
        </article>
        <article className="admin-kpi">
          <span className="admin-kpi-icon tone-purple">
            <Building2 size={20} />
          </span>
          <div className="admin-kpi-value">{orgs.size}</div>
          <div className="admin-kpi-label">المؤسسات</div>
        </article>
        <article className="admin-kpi">
          <span className="admin-kpi-icon tone-success">
            <ShieldCheck size={20} />
          </span>
          <div className="admin-kpi-value">{active}</div>
          <div className="admin-kpi-label">حسابات نشطة</div>
        </article>
        <article className="admin-kpi">
          <span className="admin-kpi-icon tone-warning">
            <UserRound size={20} />
          </span>
          <div className="admin-kpi-value">
            {orgs.size > 0 ? Math.round((users.length / orgs.size) * 10) / 10 : 0}
          </div>
          <div className="admin-kpi-label">متوسط لكل مؤسسة</div>
        </article>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            border: '1px solid var(--inx-border)',
            borderRadius: 'var(--inx-radius)',
            padding: '10px 14px',
            background: 'var(--inx-surface)',
          }}
        >
          <Search size={18} style={{ color: 'var(--inx-muted)' }} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالاسم، البريد، المؤسسة، أو الدور..."
            style={{
              flex: 1,
              border: 0,
              outline: 0,
              background: 'transparent',
              color: 'var(--inx-text)',
              fontSize: 14,
            }}
          />
        </div>
        <button
          type="button"
          className="inx-icon-btn"
          onClick={() => void load()}
          title="تحديث"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div className="inx-empty">جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="inx-empty">
          <Users size={28} />
          <b>لا يوجد مستخدمون</b>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>المستخدم</th>
                <th>البريد الإلكتروني</th>
                <th>الدور</th>
                <th>الحالة</th>
                <th>المؤسسة</th>
                <th>تاريخ التسجيل</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.uid}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="admin-kpi-icon" style={{ width: 34, height: 34 }}>
                        <UserRound size={16} />
                      </span>
                      <b>{u.displayName || 'بدون اسم'}</b>
                    </div>
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        color: 'var(--inx-text-soft)',
                      }}
                    >
                      <Mail size={13} />
                      {u.email || '—'}
                    </span>
                  </td>
                  <td>
                    {u.role ? (
                      <span className="inx-badge inx-badge-primary">{u.role}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {u.status === 'active' ? (
                      <span className="inx-badge inx-badge-success">نشط</span>
                    ) : (
                      <span className="inx-badge inx-badge-neutral">
                        {u.status || '—'}
                      </span>
                    )}
                  </td>
                  <td className="mono">
                    {u.organizationId ? u.organizationId.slice(0, 14) + '…' : '—'}
                  </td>
                  <td style={{ color: 'var(--inx-text-soft)' }}>
                    {formatDate(u.createdAt)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="inx-icon-btn"
                      onClick={() => void handleDelete(u)}
                      disabled={deleting === u.uid}
                      title="حذف نهائي (يُحفظ في الأرشيف)"
                    >
                      <Trash2
                        size={15}
                        style={{
                          color: 'var(--inx-danger)',
                          opacity: deleting === u.uid ? 0.4 : 1,
                        }}
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}