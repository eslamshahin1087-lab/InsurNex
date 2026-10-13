import { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config';

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
  const [users, setUsers] = useState<BrokerUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

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

  return (
    <>
      <div className="admin-page-head">
        <span className="eyebrow">Admin · Users</span>
        <h1>المستخدمون</h1>
        <p>عرض كل حسابات الوسطاء المسجّلين على المنصة.</p>
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
          <div className="admin-kpi-label">مؤسسات</div>
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
          <div className="admin-kpi-label">متوسط/مؤسسة</div>
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
            placeholder="ابحث بالاسم، البريد، أو المؤسسة"
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
                <th>تاريخ الإنشاء</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}