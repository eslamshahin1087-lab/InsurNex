import { useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, FileCheck2, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  advanceOperation,
  POLICY_ISSUANCE_STAGES,
  type OperationStatus,
  type OperationWorkItem,
} from './operations-workflow.service';
import { Link } from 'react-router-dom';

type Props = {
  item: OperationWorkItem;
  organizationId: string;
  uid: string;
  onClose: () => void;
  onChanged: () => Promise<void>;
};

const STAGES: { value: OperationStatus; label: string }[] = [
  { value: 'request', label: 'استلام طلب الإصدار' },
  { value: 'data_collection', label: 'استكمال البيانات' },
  { value: 'market_submission', label: 'التعامل مع السوق' },
  { value: 'quotation', label: 'مراجعة العرض' },
  { value: 'client_approval', label: 'موافقة العميل' },
  { value: 'binding', label: 'ربط التغطية' },
  { value: 'policy_issuance', label: 'إصدار الوثيقة' },
  { value: 'policy_checking', label: 'التحقق من الوثيقة' },
  { value: 'completed', label: 'مكتملة' },
];

export default function IssuanceWorkspace({ item, organizationId, uid, onClose, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const stageIndex = POLICY_ISSUANCE_STAGES.indexOf(item.status);
  const currentStage = STAGES.find((stage) => stage.value === item.status);
  const nextStage = stageIndex >= 0 ? POLICY_ISSUANCE_STAGES[stageIndex + 1] : undefined;
  const canAdvance = Boolean(
    item.kind === 'policy_issuance' &&
    nextStage &&
    nextStage !== 'completed' &&
    item.organizationId === organizationId &&
    item.createdBy
  );

  async function advance() {
    if (!canAdvance || busy) return;
    setBusy(true);
    setError('');
    try {
      await advanceOperation(item, uid);
      await onChanged();
    } catch (reason) {
      console.error('Failed to advance issuance workflow', reason);
      setError('تعذر تحديث مرحلة الإصدار. تحقق من الصلاحيات ثم أعد المحاولة.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="op80-panel op80-issuance-workspace" dir="rtl">
      <header className="op80-heading">
        <div>
          <span className="eyebrow">ISSUANCE WORKFLOW</span>
          <h2>{item.title || 'طلب إصدار وثيقة'}</h2>
          <p>{item.clientName || 'عميل غير محدد'} · {item.insurerName || 'شركة تأمين غير محددة'}</p>
        </div>
        <button type="button" className="secondary-button" onClick={onClose}>
          <ArrowRight size={16} /> العودة إلى صندوق العمليات
        </button>
      </header>

      <div className="op80-selected-client">
        <div>
          <span className="eyebrow">الحالة الحالية</span>
          <h3>{currentStage?.label || item.status}</h3>
          <p>{item.policyNumber ? 'رقم الوثيقة: ' + item.policyNumber : 'لم يُسجل رقم وثيقة مرتبط بهذا الطلب حتى الآن.'}</p>
        </div>
        <div className="op80-client-mini-stats">
          <span><FileCheck2 size={15} /> {item.rfqId ? 'RFQ ' + item.rfqId.slice(0, 8) : 'بدون RFQ مرتبط'}</span>
          <span><ShieldCheck size={15} /> {item.premium == null ? 'القسط غير مسجل' : Number(item.premium).toLocaleString('ar-EG') + ' ' + (item.currency || 'EGP')}</span>
          <span><Clock3 size={15} /> {item.dueDate || 'لا يوجد موعد استحقاق'}</span>
        </div>
      </div>

      <section className="op80-panel" aria-label="مراحل الإصدار">
        <h3>مراحل سير العمل</h3>
        <ol className="op80-issuance-stages">
          {STAGES.map((stage, index) => {
            const done = stageIndex >= 0 && index < stageIndex;
            const current = stage.value === item.status;
            return (
              <li key={stage.value} className={current ? 'current' : done ? 'done' : ''}>
                <span>{done ? <CheckCircle2 size={17} /> : index + 1}</span>
                <div><strong>{stage.label}</strong>{current ? <small>المرحلة الحالية</small> : null}</div>
              </li>
            );
          })}
        </ol>
      </section>

      {error ? <p className="op80-alert" role="alert">{error}</p> : null}

      {item.status === 'policy_checking' ? (
        <div className="op80-note" role="status">
          <strong>يلزم ربط وثيقة فعلية قبل إغلاق الطلب.</strong>
          <p>لم يتم تغيير حالة الطلب إلى «مكتمل» تلقائيًا؛ ذلك يمنع تسجيل إصدار مكتمل دون مرجع وثيقة.</p>
          <Link to="/policies" className="op80-primary"><ShieldCheck size={16} /> فتح إدارة الوثائق</Link>
        </div>
      ) : item.status === 'completed' ? (
        <div className="op80-note" role="status"><CheckCircle2 size={18} /> هذا الطلب مسجل كمكتمل.</div>
      ) : item.status === 'cancelled' ? (
        <div className="op80-note" role="status">تم إلغاء هذا الطلب.</div>
      ) : (
        <button type="button" className="op80-primary" disabled={!canAdvance || busy} onClick={() => void advance()}>
          {busy ? <RefreshCw size={17} /> : <ArrowRight size={17} />}
          {busy ? 'جارٍ تحديث المرحلة...' : nextStage ? 'الانتقال إلى: ' + (STAGES.find((stage) => stage.value === nextStage)?.label || nextStage) : 'لا توجد مرحلة تالية'}
        </button>
      )}
      <p className="op80-note">تحديث المرحلة يستخدم سجل العمليات الحالي فقط ولا ينشئ وثيقة تأمين أو يغيّر معرّفات البيانات.</p>
    </section>
  );
}
