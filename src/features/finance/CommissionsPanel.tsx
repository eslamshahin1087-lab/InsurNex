import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import {
  createCommission,
  deleteCommission,
  listCommissions,
  markCommissionReceived,
} from './finance.service';
import {
  COMMISSION_STATUS_LABELS,
  type CommissionEntry,
} from './finance.types';

const today = () => new Date().toISOString().slice(0, 10);

export default function CommissionsPanel() {
  const { profile } = useAuth();
  const [items, setItems] = useState<CommissionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [policyNumber, setPolicyNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [insurerName, setInsurerName] = useState('');
  const [premium, setPremium] = useState('');
  const [rate, setRate] = useState('');
  const [expectedDate, setExpectedDate] = useState(today());
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    setError('');
    try {
      const rows = await listCommissions(profile.organizationId);
      setItems(rows);
    } catch {
      setError('تعذر تحميل العمولات.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.organizationId]);

  const totals = useMemo(() => {
    const pending = items
      .filter((c) => c.status === 'pending')
      .reduce((s, c) => s + (c.commissionAmount || 0), 0);
    const received = items
      .filter((c) => c.status === 'received')
      .reduce((s, c) => s + (c.commissionAmount || 0), 0);
    return { pending, received };
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !premium || !rate) return;
    const p = Number(premium);
    const r = Number(rate);
    if (p <= 0 || r <= 0) return;

    setSaving(true);
    try {
      await createCommission(
        {
          organizationId: profile.organizationId,
          policyNumber: policyNumber.trim() || undefined,
          clientName: clientName.trim() || undefined,
          insurerName: insurerName.trim() || undefined,
          premium: p,
          commissionRate: r,
          commissionAmount: Math.round(p * (r / 100) * 100) / 100,
          currency: 'EGP',
          status: 'pending',
          expectedDate,
        },
        profile.uid,
      );
      setPolicyNumber('');
      setClientName('');
      setInsurerName('');
      setPremium('');
      setRate('');
      setShowForm(false);
      await load();
    } catch {
      setError('فشل حفظ العمولة.');
    } finally {
      setSaving(false);
    }
  };

  const handleReceived = async (id: string) => {
    try {
      await markCommissionReceived(id, today());
      setItems((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, status: 'received', receivedDate: today() } : c,
        ),
      );
    } catch {
      setError('فشل تحديث الحالة.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('حذف هذه العمولة؟')) return;
    try {
      await deleteCommission(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      setError('فشل الحذف.');
    }
  };

  return (
    <section className="fin-panel">
      <header className="fin-panel-head">
        <div>
          <span className="eyebrow">Commissions</span>
          <h2>العمولات</h2>
          <small>
            معلقة: {totals.pending.toLocaleString('ar-EG')} ج.م · مستلمة:{' '}
            {totals.received.toLocaleString('ar-EG')} ج.م
          </small>
        </div>
        <button
          type="button"
          className="fin-add"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus size={16} />
          {showForm ? 'إلغاء' : 'إضافة'}
        </button>
      </header>

      {showForm && (
        <form className="fin-form" onSubmit={handleSubmit}>
          <label>
            <span>رقم الوثيقة</span>
            <input value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} />
          </label>

          <label>
            <span>اسم العميل</span>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </label>

          <label>
            <span>شركة التأمين</span>
            <input value={insurerName} onChange={(e) => setInsurerName(e.target.value)} />
          </label>

          <label>
            <span>القسط (ج.م)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={premium}
              onChange={(e) => setPremium(e.target.value)}
              required
            />
          </label>

          <label>
            <span>نسبة العمولة %</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              required
            />
          </label>

          <label>
            <span>تاريخ الاستحقاق المتوقع</span>
            <input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </label>

          {premium && rate && (
            <div className="fin-preview fin-full">
              العمولة المتوقعة:{' '}
              <strong>
                {(Number(premium) * (Number(rate) / 100)).toLocaleString('ar-EG')} ج.م
              </strong>
            </div>
          )}

          <div className="fin-form-actions">
            <button type="submit" disabled={saving} className="fin-primary">
              {saving ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </form>
      )}

      {error && <div className="fin-error">{error}</div>}

      {loading ? (
        <div className="fin-empty">جاري التحميل...</div>
      ) : items.length === 0 ? (
        <div className="fin-empty">
          <Clock3 size={28} />
          <p>لا توجد عمولات مسجلة بعد.</p>
        </div>
      ) : (
        <ul className="fin-list">
          {items.map((c) => (
            <li key={c.id} className={`fin-row status-${c.status}`}>
              <div className="fin-row-main">
                <strong>{c.commissionAmount.toLocaleString('ar-EG')} ج.م</strong>
                <em className={`fin-tag fin-tag-${c.status}`}>
                  {COMMISSION_STATUS_LABELS[c.status]}
                </em>
              </div>
              <div className="fin-row-meta">
                <span>{c.clientName || 'بدون عميل'}</span>
                <span>•</span>
                <span>{c.insurerName || 'بدون شركة'}</span>
                <span>•</span>
                <span>
                  {c.commissionRate}% من {c.premium.toLocaleString('ar-EG')}
                </span>
              </div>
              <div className="fin-row-actions">
                {c.status === 'pending' && (
                  <button
                    type="button"
                    className="fin-received"
                    onClick={() => void handleReceived(c.id)}
                    title="تحديد كمستلمة"
                  >
                    <CheckCircle2 size={15} />
                  </button>
                )}
                <button
                  type="button"
                  className="fin-del"
                  onClick={() => void handleDelete(c.id)}
                  aria-label="حذف"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
