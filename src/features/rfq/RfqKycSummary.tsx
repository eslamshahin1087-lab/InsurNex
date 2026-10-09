import type { RfqRecord } from './rfq-types';

type DocumentOption = { id: string; fileName: string };

type Props = {
  clientName: string;
  rfqs: RfqRecord[];
  documents: DocumentOption[];
};

export default function RfqKycSummary({ clientName, rfqs, documents }: Props) {
  const insurerTargets = rfqs.flatMap((rfq) => rfq.insurers ?? []);
  const quotesReceived = insurerTargets.filter((target) => target.status === 'quote_received').length;
  const pendingResponses = insurerTargets.filter((target) =>
    target.status === 'sent' || target.status === 'follow_up'
  ).length;

  return (
    <section className="rfq-v81-summary" aria-label="ملخص جاهزية طلبات عروض الأسعار">
      <div className="rfq-v81-summary-heading">
        <div>
          <small>CLIENT READINESS</small>
          <h3>ملخص ملف العميل</h3>
          <p>{clientName || 'العميل المحدد'} · مؤشرات مبنية على السجلات الحالية</p>
        </div>
      </div>
      <div className="rfq-v81-summary-grid">
        <article>
          <span>طلبات عروض الأسعار</span>
          <strong>{rfqs.length}</strong>
        </article>
        <article>
          <span>مستندات العميل المتاحة</span>
          <strong>{documents.length}</strong>
        </article>
        <article>
          <span>عروض مستلمة</span>
          <strong>{quotesReceived}</strong>
        </article>
        <article>
          <span>ردود بانتظار المتابعة</span>
          <strong>{pendingResponses}</strong>
        </article>
      </div>
    </section>
  );
}
