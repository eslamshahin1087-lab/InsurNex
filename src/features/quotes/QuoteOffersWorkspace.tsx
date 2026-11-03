import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import './quote-offers.css';
import type { RfqRecord } from '../rfq/rfq-types';
import type { QuoteOffer } from './quote-types';
import {
  createQuoteOffer,
  issuePolicyFromSelectedQuote,
  listRfqQuotes,
  setQuoteOfferStatus,
} from './quote.service';
import {
  compareQuoteOffers,
  getTodayDateKey,
  isQuoteOfferValid,
} from './quote-workflow';

type Props = {
  organizationId: string;
  clientId: string;
  clientName: string;
  uid: string;
  rfqs: RfqRecord[];
  onPolicyIssued?: () => void;
};

const STATUS_LABELS: Record<string, string> = {
  received: 'عرض مستلم',
  shortlisted: 'ضمن القائمة المختصرة',
  selected: 'العرض المختار',
  rejected: 'مرفوض',
  issued: 'تم الإصدار',
};

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('ar-EG', {
      style: 'currency',
      currency: currency || 'EGP',
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `${Number(value || 0).toLocaleString('ar-EG')} ${currency || ''}`.trim();
  }
}

export default function QuoteOffersWorkspace({
  organizationId,
  clientId,
  clientName,
  uid,
  rfqs,
  onPolicyIssued,
}: Props) {
  const today = getTodayDateKey();
  const [activeRfqId, setActiveRfqId] = useState('');
  const [offers, setOffers] = useState<QuoteOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [insurerId, setInsurerId] = useState('');
  const [quoteNumber, setQuoteNumber] = useState('');
  const [premium, setPremium] = useState('');
  const [currency, setCurrency] = useState('EGP');
  const [commissionRate, setCommissionRate] = useState('');
  const [deductible, setDeductible] = useState('');
  const [coverageSummary, setCoverageSummary] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [effectiveStartDate, setEffectiveStartDate] = useState('');
  const [effectiveEndDate, setEffectiveEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [issueQuote, setIssueQuote] = useState<QuoteOffer | null>(null);
  const [policyNumber, setPolicyNumber] = useState('');
  const [policyStartDate, setPolicyStartDate] = useState('');
  const [policyExpiryDate, setPolicyExpiryDate] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');

  useEffect(() => {
    if (!rfqs.length) {
      setActiveRfqId('');
      setOffers([]);
      return;
    }
    if (!rfqs.some((rfq) => rfq.id === activeRfqId)) {
      setActiveRfqId(rfqs[0].id);
    }
  }, [rfqs, activeRfqId]);

  const activeRfq = rfqs.find((rfq) => rfq.id === activeRfqId) || null;

  async function loadOffers(rfqId = activeRfqId) {
    if (!rfqId) {
      setOffers([]);
      return;
    }
    setLoading(true);
    try {
      const rows = await listRfqQuotes(organizationId, rfqId);
      setOffers(rows);
    } catch {
      setError('تعذر تحميل عروض الأسعار لهذا الطلب.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    if (!activeRfqId) return () => { active = false; };
    setLoading(true);
    listRfqQuotes(organizationId, activeRfqId)
      .then((rows) => { if (active) setOffers(rows); })
      .catch(() => { if (active) setError('تعذر تحميل عروض الأسعار لهذا الطلب.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [organizationId, activeRfqId]);

  const sortedOffers = useMemo(() => compareQuoteOffers(offers), [offers]);
  const commission = useMemo(() => {
    const amount = Number(premium);
    const rate = Number(commissionRate);
    return premium.trim() !== '' && commissionRate.trim() !== '' && Number.isFinite(amount) && Number.isFinite(rate)
      ? ((amount * rate) / 100).toFixed(2)
      : '—';
  }, [premium, commissionRate]);

  async function submitQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeRfq || !insurerId || !uid) return;
    const target = activeRfq.insurers.find((item) => item.insurerId === insurerId);
    if (!target) {
      setError('شركة التأمين المحددة ليست ضمن طلب التسعير.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await createQuoteOffer({
        organizationId,
        rfqId: activeRfq.id,
        clientId,
        insurerId,
        insurerName: target.insurerName,
        quoteNumber,
        premium: Number(premium),
        currency,
        commissionRate: Number(commissionRate),
        deductible: deductible.trim() ? Number(deductible) : undefined,
        coverageSummary: coverageSummary.trim() || activeRfq.coverageSummary || '',
        paymentTerms,
        validUntil,
        effectiveStartDate,
        effectiveEndDate,
        documentIds: activeRfq.documentIds || [],
        notes,
        createdBy: uid,
      });
      setPremium('');
      setQuoteNumber('');
      setNotes('');
      setNotice('تم تسجيل عرض السعر وربطه بطلب التسعير والعميل.');
      await loadOffers(activeRfq.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل عرض السعر.');
    } finally {
      setBusy(false);
    }
  }

  async function chooseOffer(offer: QuoteOffer) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await setQuoteOfferStatus(offer.id, organizationId, 'selected');
      setNotice(`تم اختيار عرض ${offer.insurerName}. يمكنك الآن إصدار الوثيقة منه.`);
      await loadOffers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر اختيار العرض.');
    } finally {
      setBusy(false);
    }
  }

  function openIssue(offer: QuoteOffer) {
    setIssueQuote(offer);
    setPolicyNumber('');
    setPolicyStartDate(offer.effectiveStartDate || '');
    setPolicyExpiryDate(offer.effectiveEndDate || '');
    setFollowUpDate('');
  }

  async function issueSelectedOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!issueQuote) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await issuePolicyFromSelectedQuote({
        organizationId,
        quoteId: issueQuote.id,
        policyNumber,
        startDate: policyStartDate,
        expiryDate: policyExpiryDate,
        followUpDate,
        uid,
      });
      setIssueQuote(null);
      setNotice(`تم إنشاء الوثيقة ${result.policyNumber} وإنشاء مهمة متابعة مرتبطة بها.`);
      await loadOffers();
      onPolicyIssued?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إصدار الوثيقة من العرض المختار.');
    } finally {
      setBusy(false);
    }
  }

  if (!rfqs.length) return null;

  return (
    <section className="client-section rfq-v81-intelligence" aria-label="عروض شركات التأمين ومقارنة الأسعار">
      <header className="section-heading">
        <div>
          <small>QUOTE COMPARISON & POLICY ISSUANCE</small>
          <h2>العروض السعرية وإصدار الوثيقة</h2>
          <p>سجّل الأسعار الفعلية المستلمة من الشركات، قارن شروطها، ثم اختر عرضاً واحداً لإصدار وثيقة مرتبطة بسجل العميل والفرصة.</p>
        </div>
      </header>

      {error ? <div className="rfq-v81-error" role="alert">{error}</div> : null}
      {notice ? <div className="rfq-v81-state" role="status">{notice}</div> : null}

      <div className="rfq-v81-form">
        <label>
          طلب التسعير
          <select value={activeRfqId} onChange={(event) => { setActiveRfqId(event.target.value); setError(''); setNotice(''); }}>
            {rfqs.map((rfq) => (
              <option key={rfq.id} value={rfq.id}>
                {rfq.insuranceType} · {rfq.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {activeRfq ? (
        <>
          <div className="rfq-v81-form">
            <div className="rfq-v81-readonly"><b>العميل:</b> {clientName}</div>
            <div className="rfq-v81-readonly"><b>نوع التأمين:</b> {activeRfq.insuranceType}</div>
            <form onSubmit={(event) => void submitQuote(event)} style={{ display: 'grid', gap: 10 }}>
              <h3>تسجيل عرض سعر وارد من شركة تأمين</h3>
              <div className="form-grid">
                <label>
                  شركة التأمين *
                  <select required value={insurerId} onChange={(event) => setInsurerId(event.target.value)}>
                    <option value="">اختر شركة من الشركات المحددة في RFQ</option>
                    {(activeRfq.insurers || []).map((target) => (
                      <option key={target.insurerId} value={target.insurerId}>{target.insurerName}</option>
                    ))}
                  </select>
                </label>
                <label>رقم العرض<input value={quoteNumber} onChange={(event) => setQuoteNumber(event.target.value)} maxLength={80} /></label>
                <label>القسط الإجمالي *<input type="number" min="0.01" step="0.01" required value={premium} onChange={(event) => setPremium(event.target.value)} /></label>
                <label>العملة<select value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="EGP">EGP</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="SAR">SAR</option><option value="AED">AED</option><option value="QAR">QAR</option><option value="KWD">KWD</option></select></label>
                <label>نسبة العمولة % *<input required type="number" min="0" max="100" step="0.01" value={commissionRate} onChange={(event) => setCommissionRate(event.target.value)} /></label>
                <label>العمولة المحسوبة<input readOnly value={commission} /></label>
                <label>مبلغ التحمل (اتركه فارغاً إذا لم يرد في العرض)<input type="number" min="0" step="0.01" value={deductible} onChange={(event) => setDeductible(event.target.value)} /></label>
                <label>صالح حتى *<input type="date" min={today} required value={validUntil} onChange={(event) => setValidUntil(event.target.value)} /></label>
                <label>بداية التغطية المقترحة<input type="date" value={effectiveStartDate} onChange={(event) => setEffectiveStartDate(event.target.value)} /></label>
                <label>نهاية التغطية المقترحة<input type="date" min={effectiveStartDate} value={effectiveEndDate} onChange={(event) => setEffectiveEndDate(event.target.value)} /></label>
                <label className="wide">ملخص التغطية<textarea value={coverageSummary} onChange={(event) => setCoverageSummary(event.target.value)} placeholder={activeRfq.coverageSummary || 'التغطيات والاستثناءات الأساسية'} /></label>
                <label className="wide">شروط السداد<input value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} placeholder="مثال: دفعة واحدة / أقساط" /></label>
                <label className="wide">ملاحظات داخلية<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
              </div>
              <button type="submit" className="primary-button" disabled={busy || !insurerId || !premium || !validUntil}>
                {busy ? 'جارٍ التسجيل...' : 'حفظ العرض وربطه بطلب التسعير'}
              </button>
            </form>
          </div>

          <div className="rfq-v81-intelligence-list">
            <div className="section-heading">
              <div><small>MARKET QUOTE RECORDS</small><h3>مقارنة العروض المسجلة</h3></div>
              <small>{offers.length} عرض</small>
            </div>
            {loading ? <div className="rfq-v81-state">جارٍ تحميل العروض...</div> : null}
            {!loading && !offers.length ? <div className="rfq-v81-state">لم يتم تسجيل عروض بعد لهذا الطلب.</div> : null}
            {!loading && sortedOffers.map((offer) => {
              const valid = isQuoteOfferValid(offer, today);
              return (
                <article key={offer.id}>
                  <div>
                    <strong>{offer.insurerName}</strong>
                    <small>{offer.quoteNumber ? `رقم العرض: ${offer.quoteNumber} · ` : ''}{offer.currency}</small>
                    <small>القسط: {money(offer.premium, offer.currency)} · التحمل: {offer.deductible == null ? 'غير محدد' : money(offer.deductible, offer.currency)}</small>
                    <small>العمولة: {money(offer.commissionAmount, offer.currency)} ({offer.commissionRate}%) · صالح حتى: {offer.validUntil}</small>
                    <small>{offer.coverageSummary || 'لا يوجد ملخص تغطية مسجل'}</small>
                    {offer.paymentTerms ? <small>السداد: {offer.paymentTerms}</small> : null}
                  </div>
                  <span className={'rfq-v81-status status-' + offer.status}>{STATUS_LABELS[offer.status] || offer.status}</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(offer.status === 'received' || offer.status === 'shortlisted') ? (
                      <button type="button" className="rfq-v81-dropdown-trigger" disabled={busy || !valid} onClick={() => void chooseOffer(offer)}>
                        اختيار العرض
                      </button>
                    ) : null}
                    {offer.status === 'selected' ? (
                      <button type="button" className="primary-button" disabled={busy || !valid} onClick={() => openIssue(offer)}>
                        إصدار الوثيقة من هذا العرض
                      </button>
                    ) : null}
                    {offer.status === 'issued' && offer.policyId ? (
                      <Link className="rfq-v81-dropdown-trigger" to={`/policies/${offer.policyId}`}>فتح الوثيقة</Link>
                    ) : null}
                    {!valid && offer.status !== 'issued' && offer.status !== 'rejected' ? <small>انتهت صلاحية العرض أو يحتاج إلى مراجعة.</small> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </>
      ) : null}

      {issueQuote ? (
        <div className="modal-backdrop">
          <section className="modal policy-modal" dir="rtl" role="dialog" aria-modal="true" aria-label="إصدار وثيقة من العرض المختار">
            <header>
              <div><span className="eyebrow">Policy Issuance</span><h2>إصدار الوثيقة</h2><small>{issueQuote.insurerName} · {money(issueQuote.premium, issueQuote.currency)}</small></div>
              <button type="button" className="icon-button" disabled={busy} onClick={() => setIssueQuote(null)}>×</button>
            </header>
            <form className="client-form" onSubmit={(event) => void issueSelectedOffer(event)}>
              <div className="form-grid">
                <label>اسم العميل<input readOnly value={clientName} /></label>
                <label>شركة التأمين<input readOnly value={issueQuote.insurerName} /></label>
                <label>رقم الوثيقة الصادر من الشركة *<input required value={policyNumber} onChange={(event) => setPolicyNumber(event.target.value)} maxLength={100} /></label>
                <label>تاريخ بداية الوثيقة *<input required type="date" value={policyStartDate} onChange={(event) => setPolicyStartDate(event.target.value)} /></label>
                <label>تاريخ انتهاء الوثيقة *<input required type="date" min={policyStartDate} value={policyExpiryDate} onChange={(event) => setPolicyExpiryDate(event.target.value)} /></label>
                <label>موعد أول متابعة *<input required type="date" min={today} value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} /></label>
              </div>
              <p className="rfq-v81-state">سيتم إنشاء سجل الوثيقة وربطه بالعرض وطلب التسعير والعميل، وتفعيل ملف العميل، وإضافة مهمة متابعة مرتبطة بالوثيقة.</p>
              <footer>
                <button type="button" className="secondary-button" disabled={busy} onClick={() => setIssueQuote(null)}>إلغاء</button>
                <button type="submit" className="primary-button" disabled={busy || !policyNumber.trim()}>
                  {busy ? 'جارٍ الإصدار...' : 'تأكيد إصدار الوثيقة'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
