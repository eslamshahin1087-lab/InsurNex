// ============================================================
// src/features/notifications/components/NotificationSettings.tsx
// ============================================================

import { useState, useEffect } from 'react';
import { Save, BellRing, Mail, MessageSquare, Smartphone, Moon } from 'lucide-react';
import { useAuth } from '../../auth/auth-context';
import { getPreferences, savePreferences } from '../notification.service.new';
import {
  NOTIFICATION_TYPE_LABELS,
  type NotificationType,
  type NotificationPreferences,
} from '../types';

const ALL_TYPES: NotificationType[] = [
  'policy_expiring',
  'policy_expired',
  'renewal_reminder',
  'payment_due',
  'lead_created',
  'lead_assigned',
  'client_created',
  'document_expiring',
  'document_verified',
  'task_reminder',
  'appointment_reminder',
  'system',
];

export function NotificationSettings() {
  const { user, profile } = useAuth();
  const organizationId = (profile as { organizationId?: string } | null)?.organizationId ?? '';

  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      if (!user?.uid) return;
      setIsLoading(true);
      const prefs = await getPreferences(user.uid);
      if (prefs) {
        setPreferences(prefs);
      } else {
        setPreferences({
          userId: user.uid,
          organizationId,
          channels: { inApp: true, email: true, push: false, sms: false },
          types: ALL_TYPES.reduce(
            (acc, t) => ({ ...acc, [t]: true }),
            {} as Record<NotificationType, boolean>,
          ),
          quietHours: {
            enabled: false,
            start: '22:00',
            end: '08:00',
            timezone: 'Africa/Cairo',
          },
          emailDigest: 'daily',
          updatedAt: new Date(),
        });
      }
      setIsLoading(false);
    }
    load();
  }, [user?.uid, organizationId]);

  const handleSave = async () => {
    if (!preferences) return;
    setIsSaving(true);
    try {
      await savePreferences({
        userId: preferences.userId,
        organizationId: preferences.organizationId,
        channels: preferences.channels,
        types: preferences.types,
        quietHours: preferences.quietHours,
        emailDigest: preferences.emailDigest,
      });
      setMessage('✅ تم حفظ الإعدادات بنجاح');
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage('❌ حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !preferences) {
    return <div className="p-8 text-center text-gray-500">جاري التحميل...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <BellRing className="w-6 h-6" />
        إعدادات الإشعارات
      </h1>

      {/* القنوات */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">قنوات الإشعارات</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: 'inApp', label: 'داخل التطبيق', icon: <BellRing className="w-5 h-5" /> },
            { key: 'email', label: 'البريد الإلكتروني', icon: <Mail className="w-5 h-5" /> },
            { key: 'push', label: 'إشعارات المتصفح', icon: <Smartphone className="w-5 h-5" /> },
            { key: 'sms', label: 'الرسائل النصية', icon: <MessageSquare className="w-5 h-5" /> },
          ].map((c) => (
            <label
              key={c.key}
              className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={preferences.channels[c.key as keyof typeof preferences.channels]}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    channels: { ...preferences.channels, [c.key]: e.target.checked },
                  })
                }
                className="w-5 h-5 text-blue-600 rounded"
              />
              <span className="text-gray-700">{c.icon}</span>
              <span className="font-medium text-gray-800">{c.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* الأنواع */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">أنواع الإشعارات</h2>
        <div className="space-y-2">
          {ALL_TYPES.map((type) => (
            <label
              key={type}
              className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={preferences.types[type]}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    types: { ...preferences.types, [type]: e.target.checked },
                  })
                }
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700">{NOTIFICATION_TYPE_LABELS[type]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ساعات الهدوء */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Moon className="w-5 h-5" />
          ساعات الهدوء
        </h2>
        <label className="flex items-center gap-3 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.quietHours.enabled}
            onChange={(e) =>
              setPreferences({
                ...preferences,
                quietHours: { ...preferences.quietHours, enabled: e.target.checked },
              })
            }
            className="w-5 h-5 text-blue-600 rounded"
          />
          <span className="text-gray-700">تفعيل ساعات الهدوء</span>
        </label>
        {preferences.quietHours.enabled && (
          <div className="grid grid-cols-2 gap-4 pr-8">
            <div>
              <label className="block text-sm text-gray-600 mb-1">من</label>
              <input
                type="time"
                value={preferences.quietHours.start}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    quietHours: { ...preferences.quietHours, start: e.target.value },
                  })
                }
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">إلى</label>
              <input
                type="time"
                value={preferences.quietHours.end}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    quietHours: { ...preferences.quietHours, end: e.target.value },
                  })
                }
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>
        )}
      </div>

      {/* ملخص البريد */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">ملخص البريد</h2>
        <select
          value={preferences.emailDigest}
          onChange={(e) =>
            setPreferences({
              ...preferences,
              emailDigest: e.target.value as NotificationPreferences['emailDigest'],
            })
          }
          className="w-full border rounded px-3 py-2"
        >
          <option value="never">لا ترسل ملخصاً</option>
          <option value="daily">ملخص يومي</option>
          <option value="weekly">ملخص أسبوعي</option>
        </select>
      </div>

      <div className="flex items-center justify-between">
        {message && <span className="text-sm font-medium text-gray-700">{message}</span>}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="mr-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium px-6 py-2 rounded-lg"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </button>
      </div>
    </div>
  );
}

export default NotificationSettings;