import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Loader2, Plus, RefreshCw, Send, X } from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import {
  addTimelineEvent,
  listTimelineEvents,
  formatTimelineDate,
  timelineIcon,
  timelineTone,
  type TimelineEvent,
  type TimelineEventType,
} from './timeline.service';

interface Props {
  clientId: string;
  organizationId: string;
}

const EVENT_LABELS: Record<TimelineEventType, string> = {
  created: 'إنشاء العميل',
  updated: 'تحديث البيانات',
  document_added: 'إضافة مستند',
  document_removed: 'حذف مستند',
  policy_added: 'إضافة وثيقة',
  claim_opened: 'فتح مطالبة',
  renewal: 'تجديد',
  note: 'ملاحظة',
  call: 'مكالمة',
  meeting: 'اجتماع',
  email: 'بريد',
  task: 'مهمة',
};

export default function ClientTimeline({ clientId, organizationId }: Props) {
  const { user, profile } = useAuth();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await listTimelineEvents(clientId, organizationId);
      setEvents(rows);
    } catch (e) {
      console.error(e);
      setError('تعذر تحميل النشاط.');
    } finally {
      setLoading(false);
    }
  }, [clientId, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="timeline-section">
      <header className="timeline-head">
        <div>
          <span className="eyebrow">Timeline</span>
          <h2>سجل النشاط</h2>
          <p>كل ما حدث مع هذا العميل في مكان واحد.</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="inx-icon-btn"
            onClick={() => void load()}
            title="تحديث"
            disabled={loading}
          >
            <RefreshCw size={15} />
          </button>
          <button
            type="button"
            className="inx-btn inx-btn-primary inx-btn-sm"
            onClick={() => setShowAdd(true)}
          >
            <Plus size={14} /> إضافة ملاحظة
          </button>
        </div>
      </header>

      {error && <div className="timeline-error">{error}</div>}

      {loading ? (
        <div className="timeline-loading">
          <Loader2 size={22} className="spin" />
          <span>جاري التحميل...</span>
        </div>
      ) : events.length === 0 ? (
        <div className="timeline-empty">
          <b>لا يوجد نشاط بعد</b>
          <small>سيظهر هنا كل حدث يتعلق بالعميل تلقائيًا.</small>
        </div>
      ) : (
        <ol className="timeline-list">
          {events.map((e) => (
            <li key={e.id} className={`timeline-item tone-${timelineTone(e.type)}`}>
              <span className="timeline-marker">
                {timelineIcon(e.type)}
              </span>
              <div className="timeline-body">
                <div className="timeline-title-row">
                  <b>{e.title}</b>
                  <span className="timeline-type-badge">{EVENT_LABELS[e.type] || e.type}</span>
                </div>
                {e.description && <p>{e.description}</p>}
                <small className="timeline-meta">
                  {formatTimelineDate(e.at)}
                  {e.byName && ` · ${e.byName}`}
                </small>
              </div>
            </li>
          ))}
        </ol>
      )}

      {showAdd && user && profile && (
        <AddNoteModal
          clientId={clientId}
          organizationId={organizationId}
          userId={user.uid}
          userName={profile.displayName || 'مستخدم'}
          onClose={() => setShowAdd(false)}
          onAdded={async () => {
            setShowAdd(false);
            await load();
          }}
        />
      )}
    </section>
  );
}

// ============================================================
// Add Note Modal
// ============================================================

function AddNoteModal({
  clientId,
  organizationId,
  userId,
  userName,
  onClose,
  onAdded,
}: {
  clientId: string;
  organizationId: string;
  userId: string;
  userName: string;
  onClose: () => void;
  onAdded: () => Promise<void>;
}) {
  const [type, setType] = useState<TimelineEventType>('note');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError('');
    try {
      await addTimelineEvent({
        clientId,
        organizationId,
        type,
        title: title.trim(),
        description: description.trim(),
        by: userId,
        byName: userName,
      });
      await onAdded();
    } catch (e) {
      console.error(e);
      setError('تعذر حفظ الملاحظة.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="timeline-modal-backdrop" onClick={onClose}>
      <form
        className="timeline-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <header>
          <h3>إضافة حدث جديد</h3>
          <button type="button" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="timeline-modal-body">
          <label className="timeline-field">
            <span>نوع الحدث</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TimelineEventType)}
            >
              <option value="note">📝 ملاحظة</option>
              <option value="call">📞 مكالمة</option>
              <option value="meeting">👥 اجتماع</option>
              <option value="email">✉️ بريد</option>
            </select>
          </label>

          <label className="timeline-field">
            <span>العنوان *</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: اتصال مع العميل بشأن التجديد"
              autoFocus
            />
          </label>

          <label className="timeline-field">
            <span>التفاصيل</span>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ملاحظات إضافية..."
            />
          </label>

          {error && <div className="timeline-error">{error}</div>}
        </div>

        <footer>
          <button
            type="submit"
            className="inx-btn inx-btn-primary"
            disabled={busy || !title.trim()}
          >
            <Send size={14} /> {busy ? 'جاري الحفظ...' : 'حفظ'}
          </button>
          <button type="button" className="inx-btn inx-btn-secondary" onClick={onClose}>
            إلغاء
          </button>
        </footer>
      </form>
    </div>
  );
}