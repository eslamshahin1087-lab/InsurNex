import type { RfqRecord } from '../rfq/rfq-types';

type Props = {
  organizationId: string;
  clientId: string;
  uid: string;
  rfqs: RfqRecord[];
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'مسودة',
  sent: 'تم الإرسال',
  follow_up: 'تحتاج متابعة',
  quote_received: 'تم استلام العرض',
  declined: 'اعتذار',
  no_response: 'لا يوجد رد',
};

export default function QuoteIntelligencePanel({ rfqs }: Props) {
  const targets = rfqs.flatMap((rfq) =>
    (rfq.insurers ?? []).map((insurer) => ({
      rfqId: rfq.id,
      insuranceType: rfq.insuranceType,
      insurerName: insurer.insurerName,
      status: insurer.status,
      followUpAt: insurer.followUpAt,
      quoteReceivedAt: insurer.quoteReceivedAt,
    }))
  );
  const received = targets.filter((target) => target.status === 'quote_received');
  const waiting = targets.filter((target) => target.status === 'sent' || target.status === 'follow_up');
  const declined = targets.filter((target) => target.status === 'declined' || target.status === 'no_response');

  return (
    <section className="client-section rfq-v81-intelligence" aria-label="متابعة استجابات شركات التأمين">
      <header className="section-heading">
        <div>
          <small>QUOTE RESPONSE OVERVIEW</small>
          <h2>متابعة عروض شركات التأمين</h2>
          <p>ملخص لحالة الردود المسجلة في طلبات عروض الأسعار لهذا العميل؛ لا تُنشأ تقديرات أو أسعار غير مسجلة.</p>
        </div>
      </header>
      <div className="rfq-v81-summary-grid">
        <article><span>إجمالي الإرسالات للشركات</span><strong>{targets.length}</strong></article>
        <article><span>عروض مستلمة</span><strong>{received.length}</strong></article>
        <article><span>بانتظار الرد أو المتابعة</span><strong>{waiting.length}</strong></article>
        <article><span>اعتذار / بلا رد</span><strong>{declined.length}</strong></article>
      </div>
      {targets.length === 0 ? (
        <div className="rfq-v81-state">لا توجد استجابات مسجلة بعد. أنشئ طلب عرض سعر وحدد شركات التأمين لبدء المتابعة.</div>
      ) : (
        <div className="rfq-v81-intelligence-list">
          {targets.map((target, index) => (
            <article key={target.rfqId + ':' + target.insurerName + ':' + index}>
              <div>
                <strong>{target.insurerName || 'شركة تأمين غير محددة'}</strong>
                <small>{target.insuranceType || 'نوع تأمين غير محدد'} · RFQ {target.rfqId.slice(0, 8)}</small>
              </div>
              <span className={'rfq-v81-status status-' + target.status}>
                {STATUS_LABELS[target.status] || target.status}
              </span>
              {target.followUpAt ? <small>المتابعة: {target.followUpAt}</small> : null}
              {target.quoteReceivedAt ? <small>استلام العرض: {target.quoteReceivedAt}</small> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
