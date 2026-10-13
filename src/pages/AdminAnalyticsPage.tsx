import { useEffect, useState } from 'react';
import {
  Activity,
  Building2,
  Calendar,
  CreditCard,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react';
import {
  collection,
  getDocs,
  limit,
  query,
} from 'firebase/firestore';
import { db } from '../firebase/config';

interface UserDoc {
  uid: string;
  email?: string;
  displayName?: string;
  role?: string;
  organizationId?: string;
  status?: string;
  createdAt?: { toDate?: () => Date } | null;
}

interface SubDoc {
  organizationId: string;
  status: string;
  endDate: string;
}

export default function AdminAnalyticsPage() {
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [subs, setSubs] = useState<SubDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [userSnap, subSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), limit(1000))),
          getDocs(query(collection(db, 'organizationSubscriptions'), limit(1000))),
        ]);
        setUsers(
          userSnap.docs.map((d) => ({ uid: d.id, ...d.data() })) as UserDoc[],
        );
        setSubs(subSnap.docs.map((d) => d.data() as SubDoc));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const now = Date.now();
  const dayMs = 86400000;
  const today = new Date().toISOString().slice(0, 10);

  const newLast7 = users.filter((u) => {
    const d = u.createdAt?.toDate?.();
    return d && now - d.getTime() < 7 * dayMs;
  }).length;

  const newLast30 = users.filter((u) => {
    const d = u.createdAt?.toDate?.();
    return d && now - d.getTime() < 30 * dayMs;
  }).length;

  const activeUsers = users.filter((u) => u.status === 'active').length;
  const inactiveUsers = users.length - activeUsers;

  const activeSubs = subs.filter(
    (s) => s.status === 'active' && s.endDate >= today,
  ).length;
  const trialSubs = subs.filter((s) => s.status === 'trial').length;
  const expiredSubs = subs.filter(
    (s) => s.status === 'suspended' || s.endDate < today,
  ).length;

  // Top organizations by user count
  const orgCounts: Record<string, number> = {};
  users.forEach((u) => {
    if (u.organizationId) {
      orgCounts[u.organizationId] = (orgCounts[u.organizationId] || 0) + 1;
    }
  });
  const topOrgs = Object.entries(orgCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // Recent users (last 5)
  const recentUsers = [...users]
    .filter((u) => u.createdAt?.toDate)
    .sort(
      (a, b) =>
        (b.createdAt?.toDate?.()?.getTime() || 0) -
        (a.createdAt?.toDate?.()?.getTime() || 0),
    )
    .slice(0, 5);

  function fmt(d: UserDoc['createdAt']): string {
    const date = d?.toDate?.();
    if (!date) return '—';
    return new Intl.DateTimeFormat('ar-EG', {
      month: 'short',
      day: 'numeric',
    }).format(date);
  }

  if (loading) {
    return (
      <>
        <div className="admin-page-head">
          <span className="eyebrow">Admin · Analytics</span>
          <h1>تحليلات المستخدمين</h1>
        </div>
        <div className="inx-empty">جاري التحميل...</div>
      </>
    );
  }

  return (
    <>
      <div className="admin-page-head">
        <span className="eyebrow">Admin · Users Analytics</span>
        <h1>تحليلات المستخدمين</h1>
        <p>نظرة شاملة على نمو قاعدة المستخدمين والاشتراكات.</p>
      </div>

      {/* USER KPIs */}
      <div className="admin-kpi-grid">
        <article className="admin-kpi">
          <span className="admin-kpi-icon">
            <Users size={20} />
          </span>
          <div className="admin-kpi-value">{users.length}</div>
          <div className="admin-kpi-label">إجمالي المستخدمين</div>
        </article>
        <article className="admin-kpi">
          <span className="admin-kpi-icon tone-success">
            <UserCheck size={20} />
          </span>
          <div className="admin-kpi-value">{activeUsers}</div>
          <div className="admin-kpi-label">حسابات نشطة</div>
        </article>
        <article className="admin-kpi">
          <span className="admin-kpi-icon tone-danger">
            <UserX size={20} />
          </span>
          <div className="admin-kpi-value">{inactiveUsers}</div>
          <div className="admin-kpi-label">حسابات غير نشطة</div>
        </article>
        <article className="admin-kpi">
          <span className="admin-kpi-icon tone-purple">
            <Building2 size={20} />
          </span>
          <div className="admin-kpi-value">{Object.keys(orgCounts).length}</div>
          <div className="admin-kpi-label">إجمالي المؤسسات</div>
        </article>
      </div>

      {/* GROWTH KPIs */}
      <div className="admin-kpi-grid">
        <article className="admin-kpi">
          <span className="admin-kpi-icon tone-warning">
            <TrendingUp size={20} />
          </span>
          <div className="admin-kpi-value">{newLast7}</div>
          <div className="admin-kpi-label">مسجلون آخر 7 أيام</div>
        </article>
        <article className="admin-kpi">
          <span className="admin-kpi-icon tone-warning">
            <TrendingUp size={20} />
          </span>
          <div className="admin-kpi-value">{newLast30}</div>
          <div className="admin-kpi-label">مسجلون آخر 30 يوم</div>
        </article>
        <article className="admin-kpi">
          <span className="admin-kpi-icon tone-success">
            <CreditCard size={20} />
          </span>
          <div className="admin-kpi-value">{activeSubs}</div>
          <div className="admin-kpi-label">اشتراكات نشطة</div>
        </article>
        <article className="admin-kpi">
          <span className="admin-kpi-icon">
            <Activity size={20} />
          </span>
          <div className="admin-kpi-value">{trialSubs}</div>
          <div className="admin-kpi-label">تجارب مجانية</div>
        </article>
      </div>

      {/* TOP ORGS + RECENT USERS */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        <div className="admin-table-wrap">
          <header
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--inx-border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Building2 size={16} style={{ color: 'var(--inx-blue)' }} />
            <b>أكثر المؤسسات نشاطًا</b>
          </header>
          {topOrgs.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--inx-muted)', fontSize: 13 }}>
              لا توجد بيانات
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>المؤسسة</th>
                  <th>المستخدمون</th>
                </tr>
              </thead>
              <tbody>
                {topOrgs.map(([orgId, count]) => (
                  <tr key={orgId}>
                    <td className="mono">{orgId.slice(0, 20)}…</td>
                    <td>
                      <span className="inx-badge inx-badge-primary">{count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="admin-table-wrap">
          <header
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--inx-border)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Calendar size={16} style={{ color: 'var(--inx-blue)' }} />
            <b>أحدث المسجّلين</b>
          </header>
          {recentUsers.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--inx-muted)', fontSize: 13 }}>
              لا توجد بيانات
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>المستخدم</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((u) => (
                  <tr key={u.uid}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ShieldCheck size={14} style={{ color: 'var(--inx-success)' }} />
                        <span>{u.displayName || u.email || '—'}</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--inx-text-soft)', fontSize: 12.5 }}>
                      {fmt(u.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* SUBSCRIPTION BREAKDOWN */}
      <div className="admin-table-wrap" style={{ marginTop: 16 }}>
        <header
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--inx-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CreditCard size={16} style={{ color: 'var(--inx-blue)' }} />
          <b>حالة الاشتراكات</b>
        </header>
        <div className="admin-kpi-grid" style={{ padding: 20, marginBottom: 0 }}>
          <article className="admin-kpi">
            <div className="admin-kpi-value" style={{ color: 'var(--inx-success)' }}>
              {activeSubs}
            </div>
            <div className="admin-kpi-label">نشط</div>
          </article>
          <article className="admin-kpi">
            <div className="admin-kpi-value" style={{ color: 'var(--inx-warning)' }}>
              {trialSubs}
            </div>
            <div className="admin-kpi-label">تجربة</div>
          </article>
          <article className="admin-kpi">
            <div className="admin-kpi-value" style={{ color: 'var(--inx-danger)' }}>
              {expiredSubs}
            </div>
            <div className="admin-kpi-label">منتهي / موقوف</div>
          </article>
        </div>
      </div>
    </>
  );
}
