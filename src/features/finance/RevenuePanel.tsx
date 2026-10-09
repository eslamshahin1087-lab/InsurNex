import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, TrendingUp } from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import {
  createRevenue,
  deleteRevenue,
  listRevenue,
} from './finance.service';
import {
  ENTRY_STATUS_LABELS,
  REVENUE_TYPE_LABELS,
  type RevenueEntry,
  type RevenueType,
} from './finance.types';

const today = () => new Date().toISOString().slice(0, 10);

export default function RevenuePanel() {
  const { profile } = useAuth();
  const [items, setItems] = useState<RevenueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [type, setType] = useState<RevenueType>('premium');
  const [amount, setAmount] = useState('');
  const [clientName, setClientName] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    setError('');
    try {
      const rows = await listRevenue(profile.organizationId);
      setItems(rows);
    } catch {
      setError('تعذر تحميل الإيرادات. تحقق من الاتصال.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.organizationId]);

  const totalConfirmed = useMemo(
    () =>
      items
        .filter((r) => r.status === 'confirmed')
        .reduce((s, r) => s + (r.amount || 0), 0),
    [items],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !amount || Number(amount) <= 0) return;
    setSaving(true);
    try {
      await createRevenue(
        {
          organizationId: profile.organizationId,
          type,
          amount: Number(amount),
          currency: 'EGP',
          clientName: clientName.trim() || undefined,
          policyNumber: policyNumber.trim() || undefined,
          date,
          status: 'confirmed',
          notes: notes.trim() || undefined,
        },
        profile.uid,
      );
      setAmount('');
      setClientName('');
      setPolicyNumber('');
      setNotes('');
      setShowForm(false);
      await load();
    } catch {
      setError('فشل حفظ الإيراد.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('حذف هذا الإيراد؟')) return;
    try {
      await deleteRevenue(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      setError('فشل الحذف.');
    }
  };

  return (
    <section className="fin-panel">
      <header className="fin-panel-head">
        <div>
          <span className="eyebrow">Revenue</span>
          <h2>الإيرادات</h2>
          <small>الإجمالي المؤكد: {totalConfirmed.toLocaleString('ar-EG')} ج.م</small>
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
            <span>النوع</span>
            <select value={type} onChange={(e) => setType(e.target.value as RevenueType)}>
              {(Object.keys(REVENUE_TYPE_LABELS) as RevenueType[]).map((k) => (
                <option key={k} value={k}>
                  {REVENUE_TYPE_LABELS[k]}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>المبلغ (ج.م)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>

          <label>
            <span>اسم العميل</span>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </label>

          <label>
            <span>رقم الوثيقة</span>
            <input value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} />
          </label>

          <label>
            <span>التاريخ</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <label className="fin-full">
            <span>ملاحظات</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </label>

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
          <TrendingUp size={28} />
          <p>لا توجد إيرادات مسجلة بعد.</p>
        </div>
      ) : (
        <ul className="fin-list">
          {items.map((r) => (
            <li key={r.id} className="fin-row">
              <div className="fin-row-main">
                <strong>{r.amount.toLocaleString('ar-EG')} ج.م</strong>
                <em className={`fin-tag fin-tag-${r.type}`}>
                  {REVENUE_TYPE_LABELS[r.type]}
                </em>
              </div>
              <div className="fin-row-meta">
                <span>{r.clientName || 'بدون عميل'}</span>
                <span>•</span>
                <span>{r.date}</span>
                <span>•</span>
                <span>{ENTRY_STATUS_LABELS[r.status]}</span>
              </div>
              <button
                type="button"
                className="fin-del"
                onClick={() => void handleDelete(r.id)}
                aria-label="حذف"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
