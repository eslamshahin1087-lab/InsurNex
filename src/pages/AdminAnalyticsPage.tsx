import { useEffect, useState } from 'react';
import { BarChart3, Building2, TrendingUp, Users } from 'lucide-react';
import {
  collection,
  getCountFromServer,
} from 'firebase/firestore';
import { db } from '../firebase/config';

interface Counts {
  users: number;
  orgs: number;
  clients: number;
  policies: number;
  claims: number;
  leads: number;
}

export default function AdminAnalyticsPage() {
  const [counts, setCounts] = useState<Counts>({
    users: 0,
    orgs: 0,
    clients: 0,
    policies: 0,
    claims: 0,
    leads: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [u, o, c, p, cl, l] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(collection(db, 'organizations')),
          getCountFromServer(collection(db, 'clients')),
          getCountFromServer(collection(db, 'policies')),
          getCountFromServer(collection(db, 'claims')),
          getCountFromServer(collection(db, 'leads')),
        ]);
        setCounts({
          users: u.data().count,
          orgs: o.data().count,
          clients: c.data().count,
          policies: p.data().count,
          claims: cl.data().count,
          leads: l.data().count,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <div className="admin-page-head">
        <span className="eyebrow">Admin · Analytics</span>
        <h1>تحليلات المنصة</h1>
        <p>إحصائيات شاملة عن استخدام المنصة.</p>
      </div>

      {loading ? (
        <div className="inx-empty">جاري التحميل...</div>
      ) : (
        <>
          <div className="admin-kpi-grid">
            <article className="admin-kpi">
              <span className="admin-kpi-icon">
                <Users size={20} />
              </span>
              <div className="admin-kpi-value">{counts.users}</div>
              <div className="admin-kpi-label">مستخدمون</div>
            </article>
            <article className="admin-kpi">
              <span className="admin-kpi-icon tone-purple">
                <Building2 size={20} />
              </span>
              <div className="admin-kpi-value">{counts.orgs}</div>
              <div className="admin-kpi-label">مؤسسات</div>
            </article>
            <article className="admin-kpi">
              <span className="admin-kpi-icon tone-success">
                <TrendingUp size={20} />
              </span>
              <div className="admin-kpi-value">{counts.clients}</div>
              <div className="admin-kpi-label">عملاء</div>
            </article>
          </div>

          <div className="admin-kpi-grid">
            <article className="admin-kpi">
              <span className="admin-kpi-icon tone-warning">
                <BarChart3 size={20} />
              </span>
              <div className="admin-kpi-value">{counts.policies}</div>
              <div className="admin-kpi-label">وثائق</div>
            </article>
            <article className="admin-kpi">
              <span className="admin-kpi-icon tone-danger">
                <BarChart3 size={20} />
              </span>
              <div className="admin-kpi-value">{counts.claims}</div>
              <div className="admin-kpi-label">مطالبات</div>
            </article>
            <article className="admin-kpi">
              <span className="admin-kpi-icon">
                <BarChart3 size={20} />
              </span>
              <div className="admin-kpi-value">{counts.leads}</div>
              <div className="admin-kpi-label">عملاء محتملون</div>
            </article>
          </div>
        </>
      )}
    </>
  );
}