import { useMemo, useState } from 'react';
import { ArrowRight, FileCheck2, FileText, RefreshCw, Search, ShieldCheck, Users } from 'lucide-react';
import RfqWorkspace from '../rfq/RfqWorkspace';
import type { RfqRecord } from '../rfq/rfq-types';
import type { OperationWorkItem } from './operations-workflow.service';
import type { InsuranceClient } from '../../types/client';
import type { DocumentRecord } from '../../types/document';

type Props = {
  clients: InsuranceClient[];
  documents: DocumentRecord[];
  rfqs: RfqRecord[];
  operations: OperationWorkItem[];
  selectedClientId: string;
  onSelectClient: (clientId: string) => void;
  organizationId: string;
  uid: string;
  onChanged: () => Promise<void>;
};

export default function ClientRfqOperationsWorkspace({
  clients,
  documents,
  rfqs,
  operations,
  selectedClientId,
  onSelectClient,
  organizationId,
  uid,
  onChanged,
}: Props) {
  const [search, setSearch] = useState('');
  const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;
  const visibleClients = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('ar');
    return clients.filter((client) =>
      !term || [client.name, client.phone, client.email]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase('ar').includes(term))
    );
  }, [clients, search]);

  function documentsFor(clientId: string) {
    return documents.filter((document) => document.relatedType === 'client' && document.relatedId === clientId).length;
  }

  function rfqsFor(clientId: string) {
    return rfqs.filter((rfq) => rfq.clientId === clientId).length;
  }

  function operationsFor(clientId: string) {
    return operations.filter((operation) => operation.clientId === clientId && !['completed', 'cancelled'].includes(operation.status)).length;
  }

  return (
    <section className="op80-panel op80-client-rfq-workspace">
      <header className="op80-heading">
        <div>
          <span className="eyebrow">Client → RFQ → Market</span>
          <h2>{selectedClient ? 'طلبات عروض الأسعار للعميل' : 'اختيار العميل لبدء العمل'}</h2>
          <p>يعتمد العرض على بيانات العملاء والمستندات وطلبات عروض الأسعار المحفوظة حاليًا.</p>
        </div>
        {selectedClient ? (
          <button type="button" className="secondary-button" onClick={() => onSelectClient('')}>
            <ArrowRight size={16} /> اختيار عميل آخر
          </button>
        ) : null}
      </header>

      {!selectedClient ? (
        <>
          <label className="op80-search">
            <Search size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث باسم العميل أو الهاتف أو البريد"
              aria-label="البحث عن عميل"
            />
          </label>
          {visibleClients.length === 0 ? (
            <div className="op80-empty">
              <Users size={24} />
              <strong>{clients.length ? 'لا توجد نتائج مطابقة' : 'لا يوجد عملاء مسجلون بعد'}</strong>
              <p>أنشئ ملف العميل من زر «طلب جديد»، ثم عد إلى هذه الشاشة لبدء طلب عرض السعر.</p>
            </div>
          ) : (
            <div className="op80-client-grid">
              {visibleClients.map((client) => (
                <article key={client.id}>
                  <span className="op80-avatar"><Users size={19} /></span>
                  <div>
                    <b>{client.name}</b>
                    <small>{client.phone || client.email || 'بيانات الاتصال غير مكتملة'}</small>
                    <div className="op80-client-mini-stats">
                      <span><FileText size={14} /> {documentsFor(client.id)} مستند</span>
                      <span><FileCheck2 size={14} /> {rfqsFor(client.id)} RFQ</span>
                      <span><ShieldCheck size={14} /> {operationsFor(client.id)} عملية نشطة</span>
                    </div>
                  </div>
                  <button type="button" className="op80-primary" onClick={() => onSelectClient(client.id)}>
                    بدء العمل <ArrowRight size={15} />
                  </button>
                </article>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="op80-selected-client">
            <div>
              <span className="eyebrow">CLIENT</span>
              <h3>{selectedClient.name}</h3>
              <p>{selectedClient.phone || 'لا يوجد هاتف'} · {selectedClient.email || 'لا يوجد بريد'}</p>
            </div>
            <div className="op80-client-mini-stats">
              <span><FileText size={15} /> {documentsFor(selectedClient.id)} مستند</span>
              <span><FileCheck2 size={15} /> {rfqsFor(selectedClient.id)} طلب عرض</span>
              <span><ShieldCheck size={15} /> {operationsFor(selectedClient.id)} عملية نشطة</span>
            </div>
            <button type="button" className="secondary-button" onClick={() => void onChanged()}>
              <RefreshCw size={15} /> تحديث البيانات
            </button>
          </div>
          <RfqWorkspace
            key={selectedClient.id}
            organizationId={organizationId}
            clientId={selectedClient.id}
            clientName={selectedClient.name}
            uid={uid}
          />
        </>
      )}
    </section>
  );
}
