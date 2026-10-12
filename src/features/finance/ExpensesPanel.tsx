import { useEffect, useMemo, useState } from 'react';
import { Plus, Receipt, Trash2 } from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import {
  createExpense,
  deleteExpense,
  listExpenses,
} from './finance.service';
import {
  EXPENSE_CATEGORY_LABELS,
  type ExpenseCategory,
  type ExpenseEntry,
} from './finance.types';

const today = () => new Date().toISOString().slice(0, 10);

export default function ExpensesPanel() {
  const { profile } = useAuth();
  const [items, setItems] = useState<ExpenseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const [category, setCategory] = useState<ExpenseCategory>('operational');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    setError('');
    try {
      const rows = await listExpenses(profile.organizationId);
      setItems(rows);
    } catch {
      setError('تعذر تحميل المصروفات.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.organizationId]);

  const total = useMemo(
    () => items.reduce((s, e) => s + (e.amount || 0), 0),
    [items],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !amount || Number(amount) <= 0 || !description.trim()) return;
    setSaving(true);
    try {
      await createExpense(
        {
          organizationId: profile.organizationId,
          category,
          amount: Number(amount),
          currency: 'EGP',
          date,
          description: description.trim(),
        },
        profile.uid,
      );
      setAmount('');
      setDescription('');
      setShowForm(false);
      await load();
    } catch {
      setError('فشل حفظ المصروف.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('حذف هذا المصروف؟')) return;
    try {
      await deleteExpense(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch {
      setError('فشل الحذف.');
    }
  };

  return (
    <section className="fin-panel">
      <header className="fin-panel-head">
        <div>
          <span className="eyebrow">Expenses</span>
          <h2>المصروفات</h2>
          <small>الإجمالي: {total.toLocaleString('ar-EG')} ج.م</small>
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
            <span>الفئة</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            >
              {(Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[]).map((k) => (
                <option key={k} value={k}>
                  {EXPENSE_CATEGORY_LABELS[k]}
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
            <span>التاريخ</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>

          <label className="fin-full">
            <span>الوصف</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
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
          <Receipt size={28} />
          <p>لا توجد مصروفات مسجلة بعد.</p>
        </div>
      ) : (
        <ul className="fin-list">
          {items.map((e) => (
            <li key={e.id} className="fin-row">
              <div className="fin-row-main">
                <strong>{e.amount.toLocaleString('ar-EG')} ج.م</strong>
                <em className={`fin-tag fin-tag-${e.category}`}>
                  {EXPENSE_CATEGORY_LABELS[e.category]}
                </em>
              </div>
              <div className="fin-row-meta">
                <span>{e.description}</span>
                <span>•</span>
                <span>{e.date}</span>
              </div>
              <button
                type="button"
                className="fin-del"
                onClick={() => void handleDelete(e.id)}
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
