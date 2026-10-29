import {
  ArrowRight,
  Bot,
  Building2,
  CalendarDays,
  CheckCircle2,
  Mail,
  Moon,
  Phone,
  Save,
  Sun,
  Target,
  XCircle,
} from 'lucide-react';
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
import { setCurrentContext } from '../features/copilot/copilot-context.store';
import { useTheme } from '../theme/ThemeProvider';

const STAGE_TONES: Record<LeadStage, string> = {
  new: 'primary',
  contacted: 'warning',
  qualified: 'primary',
  quotation: 'warning',
  negotiation: 'warning',
  won: 'success',
  lost: 'danger',
};

export default function LeadDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
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

  // Copilot context
  useEffect(() => {
    if (!lead) return;
    setCurrentContext({
      page: 'lead-details',
      lead: { id: lead.id },
      leads: [
        {
          name: lead.name,
          companyName: lead.companyName,
          stage: lead.stage,
          insuranceType: lead.insuranceType,
          estimatedValue: lead.estimatedValue,
        },
      ],
      notes: `The broker is viewing lead 360 for: ${lead.name}`,
    });
  }, [lead]);

  const allowed = useMemo(
    () => (lead ? getAllowedLeadStages(lead.stage) : []),
    [lead],
  );

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
      await recordLeadTaskActivity(
        profile.organizationId,
        lead.id,
        user.uid,
        taskTitle.trim(),
      );
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
      const clientId = await convertWonLeadToClient(
        lead.id,
        profile.organizationId,
        user.uid,
      );
      nav(`/clients/${clientId}`);
    } catch (e) {
      console.error(e);
      setError('تعذر تحويل العميل المحتمل إلى عميل.');
    } finally {
      setSaving(false);
    }
  }

  const askCopilot = () => {
    if (!lead) return;
    nav('/copilot', {
      state: {
        context: {
          page: 'lead-details',
          leads: [
            {
              name: lead.name,
              companyName: lead.companyName,
              stage: lead.stage,
              insuranceType: lead.insuranceType,
              estimatedValue: lead.estimatedValue,
            },
          ],
          notes: `The broker is viewing lead 360 for: ${lead.name}`,
        },
      },
    });
  };

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
            <Link
              to="/leads"
              className="inx-btn inx-btn-secondary"
              style={{ marginTop: 8 }}
            >
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
        {/* HEADER */}
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            padding: '4px 0 14px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <Link
              to="/leads"
              className="inx-link"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 6,
              }}
            >
              <ArrowRight size={16} /> العملاء المحتملون
            </Link>
            <span className="eyebrow">Lead 360</span>
            <h2 style={{ margin: '2px 0 6px', fontSize: 20, color: 'var(--inx-text)' }}>
              {lead.name}
            </h2>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className={`inx-badge inx-badge-${STAGE_TONES[lead.stage]}`}>
                {LEAD_STAGE_LABELS[lead.stage]}
              </span>
              <span className="inx-badge inx-badge-neutral">
                أولوية {LEAD_PRIORITY_LABELS[lead.priority]}
              </span>
            </div>
          </div>

          <div className="inx-header-circular">
            <button
              type="button"
              className="inx-circle-btn"
              onClick={toggleTheme}
              title={resolvedTheme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
            >
              {resolvedTheme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              type="button"
              className="inx-circle-btn filled"
              onClick={askCopilot}
              title="مساعد InsurNex"
            >
              <Bot size={17} />
            </button>
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

        {/* KPI summary */}
        <div className="inx-kpi-grid" style={{ marginBottom: 16 }}>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-cyan">🛡️</span>
            </div>
            <div className="inx-kpi-value" style={{ fontSize: 15 }}>
              {lead.insuranceType || '—'}
            </div>
            <small className="inx-kpi-label">نوع التأمين</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-success">💰</span>
            </div>
            <div className="inx-kpi-value" style={{ fontSize: 15 }}>
              {Number(lead.estimatedValue || 0).toLocaleString('ar-EG')} ج.م
            </div>
            <small className="inx-kpi-label">القيمة المتوقعة</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-warning">📊</span>
            </div>
            <div className="inx-kpi-value">{acts.length}</div>
            <small className="inx-kpi-label">نشاطات مسجلة</small>
          </article>
          <article className="inx-kpi">
            <div className="inx-kpi-head">
              <span className="inx-3d-icon sm tone-purple">📌</span>
            </div>
            <div className="inx-kpi-value" style={{ fontSize: 15 }}>
              {LEAD_SOURCE_LABELS[lead.source]}
            </div>
            <small className="inx-kpi-label">المصدر</small>
          </article>
        </div>

        {/* Details */}
        <div className="inx-section-head">
          <h2>بيانات العميل المحتمل</h2>
        </div>
        <div className="inx-card" style={{ marginBottom: 16 }}>
          <ul className="inx-list">
            {lead.companyName && (
              <li className="inx-list-item">
                <span className="inx-icon-circle inx-icon-circle-sm">
                  <Building2 size={14} />
                </span>
                <div className="inx-list-copy">
                  <small>الشركة</small>
                  <b>{lead.companyName}</b>
                </div>
              </li>
            )}
            <li className="inx-list-item">
              <span className="inx-icon-circle inx-icon-circle-sm">
                <Phone size={14} />
              </span>
              <div className="inx-list-copy">
                <small>الهاتف</small>
                <b>{lead.phone}</b>
              </div>
            </li>
            <li className="inx-list-item">
              <span className="inx-icon-circle inx-icon-circle-sm">
                <Mail size={14} />
              </span>
              <div className="inx-list-copy">
                <small>البريد الإلكتروني</small>
                <b>{lead.email || 'غير متوفر'}</b>
              </div>
            </li>
            <li className="inx-list-item">
              <span className="inx-icon-circle inx-icon-circle-sm tone-cyan">
                <ShieldIcon />
              </span>
              <div className="inx-list-copy">
                <small>شركة التأمين المفضلة</small>
                <b>{lead.preferredInsurerName || 'غير محددة'}</b>
              </div>
            </li>
          </ul>
        </div>

        {/* Stage transitions */}
        {lead.stage !== 'won' && lead.stage !== 'lost' && (
          <>
            <div className="inx-section-head">
              <h2>تحديث المرحلة</h2>
            </div>
            <div className="inx-card" style={{ marginBottom: 16 }}>
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
          </>
        )}

        {lead.stage === 'won' && (
          <>
            <div className="inx-section-head">
              <h2>الصفقة مغلقة</h2>
            </div>
            <div className="inx-card" style={{ marginBottom: 16 }}>
              {lead.clientId ? (
                <Link
                  to={`/clients/${lead.clientId}`}
                  className="inx-btn inx-btn-primary"
                >
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
          </>
        )}

        {/* Add task */}
        <div className="inx-section-head">
          <h2>إضافة مهمة متابعة</h2>
        </div>
        <div className="inx-card" style={{ marginBottom: 16 }}>
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
            <button
              type="submit"
              className="inx-btn inx-btn-primary"
              disabled={saving}
            >
              <Save size={14} /> إنشاء المهمة
            </button>
          </form>
        </div>

        {/* Notes */}
        <div className="inx-section-head">
          <h2>الملاحظات</h2>
        </div>
        <div className="inx-card" style={{ marginBottom: 16 }}>
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

        {/* Activity log */}
        <div className="inx-section-head">
          <h2>سجل النشاط</h2>
          <small style={{ color: 'var(--inx-muted)', fontSize: 12 }}>
            {acts.length} عنصر
          </small>
        </div>
        <div className="inx-card">
          {acts.length === 0 ? (
            <div className="inx-empty">
              <b>لا يوجد نشاط بعد</b>
            </div>
          ) : (
            <ul className="inx-list">
              {acts.map((a) => (
                <li key={a.id} className="inx-list-item">
                  <span className="inx-icon-circle inx-icon-circle-sm tone-cyan">
                    <CalendarDays size={14} />
                  </span>
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

function ShieldIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}