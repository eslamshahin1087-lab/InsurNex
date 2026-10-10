import { ArrowRight, CheckCircle2, Save, Target, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { createTask } from '../features/tasks/task.service';
import {
  convertWonLeadToClient,
  getAllowedLeadStages,
  getLead,
  listLeadActivities,
  recordLeadTaskActivity,
  setLeadStage,
  updateLeadNotes,
  type LeadActivity,
} from '../features/leads/lead.service';
import type { Lead, LeadStage } from '../types/lead';
import {
  LEAD_PRIORITY_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_STAGE_LABELS,
} from '../types/lead';

export default function LeadDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [acts, setActs] = useState<LeadActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');

  async function load() {
    if (!id || !profile?.organizationId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError('');
      const [l, a] = await Promise.all([
        getLead(id, profile.organizationId),
        listLeadActivities(profile.organizationId, id),
      ]);
      setLead(l);
      setActs(a);
      if (l) {
        setNotes(l.notes || '');
        setLostReason(l.lostReason || '');
      }
    } catch (e) {
      console.error(e);
      setError('تعذر تحميل بيانات العميل المحتمل.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id, profile?.organizationId]);

  const allowed = useMemo(() => (lead ? getAllowedLeadStages(lead.stage) : []), [lead]);

  async function move(next: LeadStage) {
    if (!lead || !profile || !user) return;
    if (next === 'lost' && !lostReason.trim()) {
      setError('يرجى إدخال سبب الخسارة قبل التحديث.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      await setLeadStage(
        lead.id,
        lead.stage,
        next,
        profile.organizationId,
        user.uid,
        next === 'lost' ? lostReason : undefined,
      );
      await load();
    } catch (e) {
      console.error(e);
      setError('تعذر تحديث مرحلة العميل.');
    } finally {
      setSaving(false);
    }
  }

  async function saveNotes() {
    if (!lead || !profile || !user) return;
    try {
      setSaving(true);
      await updateLeadNotes(lead.id, notes, profile.organizationId, user.uid);
      await load();
    } catch (e) {
      console.error(e);
      setError('تعذر حفظ الملاحظات.');
    } finally {
      setSaving(false);
    }
  }

  async function addTask(e: FormEvent) {
    e.preventDefault();
    if (!lead || !profile || !user || !taskTitle.trim() || !taskDue) return;
    try {
      setSaving(true);
      await createTask(
        {
          title: taskTitle.trim(),
          description: `متابعة العميل المحتمل: ${lead.name}`,
          priority: 'medium',
          status: 'open',
          dueDate: taskDue,
          assignedTo: user.uid,
          relatedType: 'lead',
          relatedId: lead.id,
        },
        profile.organizationId,
        user.uid,
      );
      await recordLeadTaskActivity(profile.organizationId, lead.id, user.uid, taskTitle.trim());
      setTaskTitle('');
      setTaskDue('');
      await load();
    } catch (err) {
      console.error(err);
      setError('تعذر إنشاء المهمة.');
    } finally {
      setSaving(false);
    }
  }

  async function convert() {
    if (!lead || !profile || !user) return;
    try {
      setSaving(true);
      setError('');
      const clientId = await convertWonLeadToClient(lead.id, profile.organizationId, user.uid);
      nav(`/clients/${clientId}`);
    } catch (e) {
      console.error(e);
      setError('تعذر تحويل العميل المحتمل إلى عميل.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-container">
          <div className="inx-empty">جاري تحميل Lead 360...</div>
        </div>
      </main>
    );
  }

  if (!lead) {
    return (
      <main className="mobile-page" dir="rtl">
        <div className="inx-container">
          <div className="inx-empty">
            <Target size={32} />
            <b>لم يتم العثور على العميل المحتمل</b>
            <small>{error}</small>
            <Link to="/leads" className="inx-btn inx-btn-secondary" style={{ marginTop: 8 }}>
              <ArrowRight size={16} /> العودة للعملاء المحتملين
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mobile-page" dir="rtl">
      <div className="inx-container">
        <header className="inx-section-head" style={{ marginTop: 0 }}>
          <div>
            <Link
              to="/leads"
              className="inx-link"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6 }}
            >
              <ArrowRight size={16} /> العملاء المحتملون
            </Link>
            <span className="eyebrow">Lead 360</span>
            <h2>{lead.name}</h2>
            <small style={{ color: 'var(--inx-muted)' }}>
              {LEAD_STAGE_LABELS[lead.stage]} · أولوية {LEAD_PRIORITY_LABELS[lead.priority]}
            </small>
          </div>
        </header>

        {error && (
          <div
            className="inx-card"
            role="alert"
            style={{ marginBottom: 12, borderColor: 'var(--inx-danger)' }}
          >
            <span className="inx-badge inx-badge-danger">{error}</span>
          </div>
        )}

        <div className="inx-card" style={{ marginBottom: 16 }}>
          <div className="inx-card-head"><h3>بيانات العميل المحتمل</h3></div>
          <ul className="inx-list">
            <li className="inx-list-item">
              <div className="inx-list-copy">
                <small>نوع التأمين</small>
                <b>{lead.insuranceType}</b>
              </div>
            </li>
            <li className="inx-list-item">
              <div className="inx-list-copy">
                <small>المصدر</small>
                <b>{LEAD_SOURCE_LABELS[lead.source]}</b>
              </div>
            </li>
            <li className="inx-list-item">
              <div className="inx-list-copy">
                <small>الهاتف</small>
                <b>{lead.phone}</b>
              </div>
            </li>
            <li className="inx-list-item">
              <div className="inx-list-copy">
                <small>البريد الإلكتروني</small>
                <b>{lead.email || 'غير متوفر'}</b>
              </div>
            </li>
            <li className="inx-list-item">
              <div className="inx-list-copy">
                <small>شركة التأمين المفضلة</small>
                <b>{lead.preferredInsurerName || 'غير محددة'}</b>
              </div>
            </li>
            <li className="inx-list-item">
              <div className="inx-list-copy">
                <small>القيمة المتوقعة</small>
                <b>{Number(lead.estimatedValue || 0).toLocaleString('ar-EG')} ج.م</b>
              </div>
            </li>
          </ul>
        </div>

        {lead.stage !== 'won' && lead.stage !== 'lost' && (
          <div className="inx-card" style={{ marginBottom: 16 }}>
            <div className="inx-card-head"><h3>تحديث المرحلة</h3></div>
            {allowed.includes('lost') && (
              <textarea
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="سبب الخسارة (إذا كانت المرحلة النهائية خسارة)"
                rows={2}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  border: '1px solid var(--inx-border)',
                  borderRadius: 'var(--inx-radius-sm)',
                  background: 'var(--inx-surface)',
                  color: 'var(--inx-text)',
                  marginBottom: 10,
                }}
              />
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {allowed.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={saving}
                  onClick={() => void move(s)}
                  className={`inx-btn inx-btn-sm ${
                    s === 'won'
                      ? 'inx-btn-primary'
                      : s === 'lost'
                      ? 'inx-btn-danger'
                      : 'inx-btn-secondary'
                  }`}
                >
                  {s === 'won' && <CheckCircle2 size={14} />}
                  {s === 'lost' && <XCircle size={14} />}
                  {s !== 'won' && s !== 'lost' && <ArrowRight size={14} />}
                  {LEAD_STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        )}

        {lead.stage === 'won' && (
          <div className="inx-card" style={{ marginBottom: 16 }}>
            <div className="inx-card-head"><h3>الصفقة مغلقة</h3></div>
            {lead.clientId ? (
              <Link to={`/clients/${lead.clientId}`} className="inx-btn inx-btn-primary">
                فتح Client 360
              </Link>
            ) : (
              <button
                type="button"
                className="inx-btn inx-btn-primary"
                disabled={saving}
                onClick={() => void convert()}
              >
                تحويل إلى عميل
              </button>
            )}
          </div>
        )}

        <div className="inx-card" style={{ marginBottom: 16 }}>
          <div className="inx-card-head"><h3>إضافة مهمة متابعة</h3></div>
          <form onSubmit={addTask} style={{ display: 'grid', gap: 8 }}>
            <input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="عنوان المهمة"
              required
              style={{
                padding: '9px 12px',
                border: '1px solid var(--inx-border)',
                borderRadius: 'var(--inx-radius-sm)',
                background: 'var(--inx-surface)',
                color: 'var(--inx-text)',
              }}
            />
            <input
              type="date"
              value={taskDue}
              onChange={(e) => setTaskDue(e.target.value)}
              required
              style={{
                padding: '9px 12px',
                border: '1px solid var(--inx-border)',
                borderRadius: 'var(--inx-radius-sm)',
                background: 'var(--inx-surface)',
                color: 'var(--inx-text)',
              }}
            />
            <button type="submit" className="inx-btn inx-btn-primary" disabled={saving}>
              <Save size={14} /> إنشاء المهمة
            </button>
          </form>
        </div>

        <div className="inx-card" style={{ marginBottom: 16 }}>
          <div className="inx-card-head"><h3>الملاحظات</h3></div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            style={{
              width: '100%',
              padding: '9px 12px',
              border: '1px solid var(--inx-border)',
              borderRadius: 'var(--inx-radius-sm)',
              background: 'var(--inx-surface)',
              color: 'var(--inx-text)',
              marginBottom: 10,
            }}
          />
          <button
            type="button"
            className="inx-btn inx-btn-secondary"
            disabled={saving}
            onClick={() => void saveNotes()}
          >
            <Save size={14} /> حفظ الملاحظات
          </button>
        </div>

        <div className="inx-card">
          <div className="inx-card-head"><h3>سجل النشاط</h3></div>
          {acts.length === 0 ? (
            <div className="inx-empty"><b>لا يوجد نشاط بعد</b></div>
          ) : (
            <ul className="inx-list">
              {acts.map((a) => (
                <li key={a.id} className="inx-list-item">
                  <div className="inx-list-copy">
                    <b style={{ fontWeight: 600, fontSize: 13 }}>{a.message}</b>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}