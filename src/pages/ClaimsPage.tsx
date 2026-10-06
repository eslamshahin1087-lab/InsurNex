import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, Plus, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useAuth } from '../features/auth/auth-context';
import ClaimForm from '../features/claims/ClaimForm';
import { listClaims } from '../features/claims/claim.service';

import type { Claim } from '../types/claim';

const labels: Record<string, string> = {
  new: 'جديدة',
  documents: 'جمع المستندات',
  submitted: 'تم الإرسال',
  review: 'قيد المراجعة',
  additional_documents: 'مستندات إضافية',
  approved: 'مقبولة',
  rejected: 'مرفوضة',
  settlement: 'التسوية',
  closed: 'مغلقة',
};

export default function ClaimsPage() {
  const { profile } = useAuth();

  const [items, setItems] = useState<Claim[]>([]);
  const [show, setShow] = useState(false);
  const [term, setTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const claims = await listClaims(profile.organizationId);
      setItems(claims);
    } catch (error) {
      console.error('Failed to load claims:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const normalizedTerm = term.trim().toLowerCase();

  const shown = items.filter((claim) => {
    if (!normalizedTerm) {
      return true;
    }

    const searchableText = [
      claim.claimNumber,
      claim.clientName,
      claim.policyNumber,
      claim.insurerName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchableText.includes(normalizedTerm);
  });

  return (
    <main className="mobile-page">
      <header className="mobile-page-heading claims-heading">
        <div>
          <span className="eyebrow">Claims Management</span>

          <h1>المطالبات</h1>

          <p>
            تابع المطالبات من الإخطار حتى التسوية والإغلاق.
          </p>
        </div>

        <button
          type="button"
          className="floating-add"
          onClick={() => setShow(true)}
          aria-label="إضافة مطالبة"
        >
          <Plus size={22} />
        </button>
      </header>

      <section className="panel">
        <div className="toolbar">
          <div className="search">
            <Search size={18} />

            <input
              type="search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="بحث في المطالبات"
              aria-label="بحث في المطالبات"
            />
          </div>

          <span>{shown.length} مطالبة</span>
        </div>

        {loading ? (
          <div className="empty">
            جارٍ تحميل المطالبات...
          </div>
        ) : shown.length === 0 ? (
          <div className="empty">
            {term.trim()
              ? 'لا توجد مطالبات مطابقة لنتائج البحث.'
              : 'لا توجد مطالبات بعد.'}
          </div>
        ) : (
          <div className="claim-cards">
            {shown.map((claim) => (
              <Link
                to={`/claims/${claim.id}`}
                className="claim-card"
                key={claim.id}
              >
                <span className="claim-icon">
                  <ClipboardCheck size={21} />
                </span>

                <span className="claim-copy">
                  <b>{claim.claimNumber}</b>

                  <small>
                    {claim.clientName}
                  </small>

                  <small>
                    {claim.policyNumber}
                    {claim.insurerName
                      ? ` · ${claim.insurerName}`
                      : ''}
                  </small>
                </span>

                <span
                  className={`claim-status status-${claim.status}`}
                >
                  {labels[claim.status] ?? claim.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {show && (
        <ClaimForm
          onCancel={() => setShow(false)}
          onDone={() => {
            setShow(false);
            void load();
          }}
        />
      )}
    </main>
  );
}