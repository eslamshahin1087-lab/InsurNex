// ============================================================
// src/features/notifications/components/NotificationBell.tsx
// ============================================================

import { useState, useEffect, useRef } from 'react';
import {
  BellRing,
  CheckCheck,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Info,
  AlertCircle,
  FileWarning,
  UserPlus,
  Calendar,
} from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import type { Notification } from '../types';

// ============================================================
// Props
// ============================================================
interface NotificationBellProps {
  onNavigate?: (link: string) => void;
}

// ============================================================
// أنماط الأولوية
// ============================================================
const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'border-r-4 border-red-500 bg-red-50',
  high: 'border-r-4 border-orange-500 bg-orange-50',
  normal: 'border-r-4 border-blue-500 bg-blue-50',
  low: 'border-r-4 border-gray-300 bg-gray-50',
};

// ============================================================
// أيقونات الأنواع
// ============================================================
const TYPE_ICONS: Record<string, React.ReactNode> = {
  policy_expiring: <AlertTriangle className="w-5 h-5 text-orange-500" />,
  policy_expired: <AlertCircle className="w-5 h-5 text-red-500" />,
  renewal_reminder: <Calendar className="w-5 h-5 text-blue-500" />,
  lead_created: <UserPlus className="w-5 h-5 text-green-500" />,
  document_expiring: <FileWarning className="w-5 h-5 text-orange-500" />,
  default: <Info className="w-5 h-5 text-gray-500" />,
};

// ============================================================
// تنسيق الوقت
// ============================================================
function timeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'الآن';
  if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} دقيقة`;
  if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} ساعة`;
  const days = Math.floor(seconds / 86400);
  if (days === 1) return 'أمس';
  if (days < 30) return `منذ ${days} يوم`;
  return date.toLocaleDateString('ar-EG');
}

// ============================================================
// المكوّن
// ============================================================
export function NotificationBell({ onNavigate }: NotificationBellProps) {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } =
    useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // إغلاق عند النقر خارج القائمة
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClick = async (n: Notification) => {
    if (!n.read) await markAsRead(n.id);
    if (n.link) {
      if (onNavigate) onNavigate(n.link);
      else window.location.href = n.link;
    }
    setIsOpen(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteNotification(id);
  };

  const filtered =
    activeFilter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div className="relative inx-notification-anchor" ref={dropdownRef} dir="rtl">
      {/* زر الجرس */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors inx-notification-trigger"
        aria-label="الإشعارات"
      >
        <BellRing className="w-6 h-6 text-gray-700 inx-notification-trigger-icon" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -left-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* القائمة */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-96 bg-white rounded-lg shadow-2xl border border-gray-200 z-50 max-h-[600px] flex flex-col inx-notification-popover">
          <div className="p-4 border-b border-gray-200 inx-notification-popover-header">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-gray-900 inx-notification-popover-title">
                الإشعارات
                {unreadCount > 0 && (
                  <span className="mr-2 text-sm font-normal text-gray-500">
                    ({unreadCount} جديد)
                  </span>
                )}
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <CheckCheck className="w-4 h-4" />
                  تعليم الكل كمقروء
                </button>
              )}
            </div>
            <div className="flex gap-2 inx-notification-filters">
              <button
                onClick={() => setActiveFilter('all')}
                className={`inx-notification-filter px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  activeFilter === 'all'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                الكل ({notifications.length})
              </button>
              <button
                onClick={() => setActiveFilter('unread')}
                className={`inx-notification-filter px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  activeFilter === 'unread'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                غير المقروءة ({unreadCount})
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 inx-notification-scroll">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-500 inx-notification-empty">
                <BellRing className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>
                  {activeFilter === 'unread'
                    ? 'لا توجد إشعارات غير مقروءة'
                    : 'لا توجد إشعارات'}
                </p>
              </div>
            ) : (
              filtered.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`inx-notification-item p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                    !n.read ? 'bg-blue-50/30' : ''
                  } ${PRIORITY_STYLES[n.priority] || ''}`}
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {TYPE_ICONS[n.type] || TYPE_ICONS.default}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          className={`text-sm text-gray-900 ${
                            !n.read ? 'font-bold' : 'font-semibold'
                          }`}
                        >
                          {n.title}
                        </h4>
                        <button
                          onClick={(e) => handleDelete(e, n.id)}
                          className="text-gray-400 hover:text-red-500 flex-shrink-0"
                          aria-label="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{n.body}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-400">{timeAgo(n.createdAt)}</span>
                        {!n.read && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                      </div>
                      {n.actionRequired && n.actionUrl && (
                        <a
                          href={n.actionUrl}
                          className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-600 hover:text-blue-800"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                          {n.actionLabel || 'اتخاذ إجراء'}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 text-center inx-notification-footer">
              <button
                onClick={() => {
                  onNavigate?.('/notifications');
                  setIsOpen(false);
                }}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                عرض كل الإشعارات
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
