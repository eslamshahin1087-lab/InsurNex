import { MessageSquare, Plus, Trash2, X } from 'lucide-react';
import type { CopilotConversation } from './copilot.types';

interface Props {
  conversations: CopilotConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose?: () => void;
  loading?: boolean;
}

function formatRelative(value: unknown): string {
  if (!value) return '';
  const d = (value as { toDate?: () => Date }).toDate?.();
  if (!d) return '';
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `قبل ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} س`;
  if (diff < 604800) return `قبل ${Math.floor(diff / 86400)} يوم`;
  return new Intl.DateTimeFormat('ar-EG', { month: 'short', day: 'numeric' }).format(d);
}

export default function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onClose,
  loading,
}: Props) {
  return (
    <aside className="copilot-sidebar">
      <header className="copilot-sidebar-head">
        <h3>المحادثات</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="inx-icon-btn filled" onClick={onNew} title="محادثة جديدة">
            <Plus size={16} />
          </button>
          {onClose && (
            <button
              type="button"
              className="inx-icon-btn"
              onClick={onClose}
              title="إغلاق"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </header>

      {loading ? (
        <div className="copilot-sidebar-empty">جاري التحميل...</div>
      ) : conversations.length === 0 ? (
        <div className="copilot-sidebar-empty">
          <MessageSquare size={22} />
          <span>لا توجد محادثات بعد</span>
        </div>
      ) : (
        <ul className="copilot-sidebar-list">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={`copilot-conv ${c.id === activeId ? 'active' : ''}`}
                onClick={() => onSelect(c.id)}
              >
                <span className="copilot-conv-icon">
                  <MessageSquare size={14} />
                </span>
                <span className="copilot-conv-copy">
                  <b>{c.title || 'محادثة'}</b>
                  <small>{c.lastMessage || 'بدون رسائل'}</small>
                  <em>{formatRelative(c.updatedAt)}</em>
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  className="copilot-conv-del"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('حذف هذه المحادثة؟')) onDelete(c.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                      if (window.confirm('حذف هذه المحادثة؟')) onDelete(c.id);
                    }
                  }}
                  title="حذف"
                >
                  <Trash2 size={13} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}