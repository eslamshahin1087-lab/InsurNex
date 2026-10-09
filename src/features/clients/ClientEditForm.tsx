import { useEffect, useState, type FormEvent } from 'react';
import { Save, X } from 'lucide-react';
import {
  updateClientProfile,
  type ClientEditInput,
} from './client-edit.service';
import type { InsuranceClient } from '../../types/client';

type Props = {
  client: InsuranceClient;
  organizationId: string;
  onCancel: () => void;
  onUpdated: () => void;
};

export default function ClientEditForm({
  client,
  organizationId,
  onCancel,
  onUpdated,
}: Props) {
  const [form, setForm] = useState<ClientEditInput>({
    name: client.name,
    type: client.type,
    status: client.status,
    phone: client.phone || '',
    email: client.email || '',
    city: client.city || '',
    address: client.address || '',
    notes: client.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm({
      name: client.name,
      type: client.type,
      status: client.status,
      phone: client.phone || '',
      email: client.email || '',
      city: client.city || '',
      address: client.address || '',
      notes: client.notes || '',
    });
  }, [client]);

  function setField<K extends keyof ClientEditInput>(
    key: K,
    value: ClientEditInput[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    setError('');
    const trimmedName = form.name.trim();

    if (!trimmedName) {
      setError('اسم العميل مطلوب.');
      return;
    }

    setSaving(true);

    try {
      await updateClientProfile(client.id, organizationId, {
        ...form,
        name: trimmedName,
      });
      onUpdated();
    } catch (errorValue) {
      console.error('Failed to update client profile', errorValue);

      if (
        errorValue instanceof Error &&
        errorValue.message === 'CLIENT_NAME_REQUIRED'
      ) {
        setError('اسم العميل مطلوب.');
      } else {
        setError('تعذر حفظ التعديلات. حاول مرة أخرى.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="client-edit-backdrop" role="presentation">
      <section
        className="client-edit-sheet"
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-edit-title"
      >
        <header>
          <div>
            <span className="eyebrow">Client Profile</span>
            <h2 id="client-edit-title">تعديل بيانات العميل</h2>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="إغلاق"
            title="إغلاق"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={submit}>
          <div className="client-edit-grid">
            <label>
              <span>اسم العميل *</span>
              <input
                required
                type="text"
                autoComplete="name"
                value={form.name}
                disabled={saving}
                onChange={(event) => setField('name', event.target.value)}
              />
            </label>

            <label>
              <span>نوع العميل</span>
              <select
                value={form.type}
                disabled={saving}
                onChange={(event) =>
                  setField('type', event.target.value as ClientEditInput['type'])
                }
              >
                <option value="individual">فرد</option>
                <option value="company">شركة</option>
              </select>
            </label>

            <label>
              <span>الحالة</span>
              <select
                value={form.status}
                disabled={saving}
                onChange={(event) =>
                  setField('status', event.target.value as ClientEditInput['status'])
                }
              >
                <option value="active">نشط</option>
                <option value="prospect">محتمل</option>
                <option value="inactive">غير نشط</option>
              </select>
            </label>

            <label>
              <span>الهاتف</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={form.phone || ''}
                disabled={saving}
                onChange={(event) => setField('phone', event.target.value)}
              />
            </label>

            <label>
              <span>البريد الإلكتروني</span>
              <input
                type="email"
                autoComplete="email"
                value={form.email || ''}
                disabled={saving}
                onChange={(event) => setField('email', event.target.value)}
              />
            </label>

            <label>
              <span>المدينة</span>
              <input
                type="text"
                autoComplete="address-level2"
                value={form.city || ''}
                disabled={saving}
                onChange={(event) => setField('city', event.target.value)}
              />
            </label>

            <label className="wide">
              <span>العنوان</span>
              <input
                type="text"
                autoComplete="street-address"
                value={form.address || ''}
                disabled={saving}
                onChange={(event) => setField('address', event.target.value)}
              />
            </label>

            <label className="wide">
              <span>الملاحظات</span>
              <textarea
                rows={4}
                value={form.notes || ''}
                disabled={saving}
                onChange={(event) => setField('notes', event.target.value)}
              />
            </label>
          </div>

          {error && (
            <p className="client-edit-error" role="alert">
              {error}
            </p>
          )}

          <footer>
            <button
              type="button"
              className="secondary-button"
              onClick={onCancel}
              disabled={saving}
            >
              إلغاء
            </button>

            <button type="submit" className="primary-button" disabled={saving}>
              <Save size={18} aria-hidden="true" />
              {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
