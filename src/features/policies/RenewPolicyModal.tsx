// ============================================================
// src/features/policies/RenewPolicyModal.tsx
// نموذج تجديد البوليصة
// ============================================================

import { useState } from 'react';
import { RefreshCw, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import { renewPolicy } from './policy-lifecycle.service';
import type { Policy } from '../../types/insurance';

interface RenewPolicyModalProps {
  policy: Policy;
  onClose: () => void;
  onSuccess: () => void;
}

// دالة مساعدة لإضافة سنة لتاريخ
function addOneYear(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().split('T')[0];
}

// دالة مساعدة لإضافة يوم واحد
function addOneDay(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

export default function RenewPolicyModal({
  policy,
  onClose,
  onSuccess,
}: RenewPolicyModalProps) {
  const { user } = useAuth();

  // تجهيز التواريخ الافتراضية
  const defaultStartDate = addOneDay(policy.expiryDate);
  const defaultExpiryDate = addOneYear(defaultStartDate);

  const [form, setForm] = useState({
    newPolicyNumber: `${policy.policyNumber}-R`,
    newStartDate: defaultStartDate,
    newExpiryDate: defaultExpiryDate,
    newPremium: policy.premium,
    newCommissionRate: policy.commissionRate,
    newCoverage: policy.coverage || '',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'newPremium' || name === 'newCommissionRate' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!form.newStartDate || !form.newExpiryDate) {
      setError('يجب تحديد تواريخ البداية والانتهاء');
      return;
    }

    if (form.newStartDate >= form.newExpiryDate) {
      setError('تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await renewPolicy({
        originalPolicy: policy,
        uid: user.uid,
        newStartDate: form.newStartDate,
        newExpiryDate: form.newExpiryDate,
        newPremium: form.newPremium,
        newCommissionRate: form.newCommissionRate,
        newCoverage: form.newCoverage,
        newPolicyNumber: form.newPolicyNumber,
        notes: form.notes,
      });
      onSuccess();
    } catch (err) {
      console.error(err);
      setError('حدث خطأ أثناء التجديد. تأكد من البيانات وحاول مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 16,
        backdropFilter: 'blur(2px)',
      }}
      dir="rtl"
    >
      <div
        className="inx-card"
        style={{
          width: '100%',
          maxWidth: 500,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--inx-bg)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid var(--inx-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RefreshCw className="text-[var(--inx-blue)]" size={20} />
            <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--inx-text)' }}>
              تجديد البوليصة
            </h2>
          </div>
          <button onClick={onClose} className="inx-circle-btn" type="button">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          <div
            style={{
              background: 'var(--inx-bg-light)',
              border: '1px solid var(--inx-border)',
              borderRadius: 'var(--inx-radius)',
              padding: 12,
              marginBottom: 20,
              fontSize: '0.85rem',
              color: 'var(--inx-muted)',
            }}
          >
            يتم تجديد البوليصة الأصلية: <strong>{policy.policyNumber}</strong> للعميل:{' '}
            <strong>{policy.clientName}</strong>. سيتم أرشفة البوليصة القديمة تلقائياً.
          </div>

          <form id="renew-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.9rem', color: 'var(--inx-text)' }}>
                رقم البوليصة الجديد *
              </label>
              <input
                required
                name="newPolicyNumber"
                value={form.newPolicyNumber}
                onChange={handleChange}
                className="inx-input"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.9rem', color: 'var(--inx-text)' }}>
                  تاريخ البداية *
                </label>
                <input
                  required
                  type="date"
                  name="newStartDate"
                  value={form.newStartDate}
                  onChange={handleChange}
                  className="inx-input"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.9rem', color: 'var(--inx-text)' }}>
                  تاريخ الانتهاء *
                </label>
                <input
                  required
                  type="date"
                  name="newExpiryDate"
                  value={form.newExpiryDate}
                  onChange={handleChange}
                  className="inx-input"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.9rem', color: 'var(--inx-text)' }}>
                  القسط الجديد *
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  name="newPremium"
                  value={form.newPremium}
                  onChange={handleChange}
                  className="inx-input"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: '0.9rem', color: 'var(--inx-text)' }}>
                  نسبة العمولة % *
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  name="newCommissionRate"
                  value={form.newCommissionRate}
                  onChange={handleChange}
                  className="inx-input"
                  style={inputStyle}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.9rem', color: 'var(--inx-text)' }}>
                التغطية
              </label>
              <textarea
                name="newCoverage"
                value={form.newCoverage}
                onChange={handleChange}
                className="inx-input"
                style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
                placeholder="تفاصيل التغطية الجديدة إن وجدت..."
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontSize: '0.9rem', color: 'var(--inx-text)' }}>
                ملاحظات التجديد
              </label>
              <input
                name="notes"
                value={form.notes}
                onChange={handleChange}
                className="inx-input"
                style={inputStyle}
                placeholder="مثال: تم التجديد بعد تفاوض على الخصم..."
              />
            </div>

            {error && (
              <div style={{ color: 'var(--inx-danger)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}>
                <AlertTriangle size={16} />
                {error}
              </div>
            )}
          </form>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            padding: '16px 20px',
            borderTop: '1px solid var(--inx-border)',
            background: 'var(--inx-bg)',
            borderBottomLeftRadius: 'var(--inx-radius)',
            borderBottomRightRadius: 'var(--inx-radius)',
          }}
        >
          <button type="button" onClick={onClose} className="inx-btn inx-btn-secondary" disabled={isSubmitting}>
            إلغاء
          </button>
          <button type="submit" form="renew-form" className="inx-btn inx-btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'جاري التجديد...' : 'تأكيد التجديد'}
          </button>
        </div>
      </div>
    </div>
  );
}

// نمط موحد لحقول الإدخال
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--inx-radius)',
  border: '1px solid var(--inx-border)',
  background: 'var(--inx-bg)',
  color: 'var(--inx-text)',
  fontSize: '0.9rem',
  fontFamily: 'inherit',
  outline: 'none',
};