import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Policy, InsuranceLine } from '../../types/insurance';
import {
  buildPolicyDocumentId,
  canTransitionQuoteStatus,
  getQuoteCommissionAmount,
  getQuoteValidationErrors,
  getTodayDateKey,
  isDateOnly,
  isQuoteOfferValid,
} from './quote-workflow';
import type {
  CreateQuoteOfferInput,
  IssuePolicyFromQuoteInput,
  IssuePolicyFromQuoteResult,
  QuoteOffer,
} from './quote-types';

const QUOTES = 'quotes';

function insuranceLine(value: unknown): InsuranceLine {
  const allowed: InsuranceLine[] = ['medical', 'motor', 'property', 'marine', 'life', 'liability', 'other'];
  return typeof value === 'string' && allowed.includes(value as InsuranceLine)
    ? value as InsuranceLine
    : 'other';
}

export async function listRfqQuotes(
  organizationId: string,
  rfqId: string,
): Promise<QuoteOffer[]> {
  if (!organizationId.trim() || !rfqId.trim()) return [];
  const snapshot = await getDocs(query(
    collection(db, QUOTES),
    where('organizationId', '==', organizationId),
    where('rfqId', '==', rfqId),
    orderBy('createdAt', 'desc'),
    limit(100),
  ));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as QuoteOffer));
}

export async function createQuoteOffer(input: CreateQuoteOfferInput): Promise<string> {
  const validationErrors = getQuoteValidationErrors(input);
  if (validationErrors.length) throw new Error(validationErrors[0]);

  const commissionAmount = getQuoteCommissionAmount(input.premium, input.commissionRate);
  if (commissionAmount === null) throw new Error('INVALID_COMMISSION_AMOUNT');

  const rfqRef = doc(db, 'rfqs', input.rfqId);
  const quoteRef = doc(collection(db, QUOTES));

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(rfqRef);
    if (!snapshot.exists()) throw new Error('RFQ_NOT_FOUND');

    const rfq = snapshot.data();
    if (rfq.organizationId !== input.organizationId) throw new Error('RFQ_ORGANIZATION_MISMATCH');
    if (rfq.clientId !== input.clientId) throw new Error('RFQ_CLIENT_MISMATCH');
    if (rfq.status === 'closed') throw new Error('RFQ_ALREADY_CLOSED');

    const targets = Array.isArray(rfq.insurers) ? rfq.insurers : [];
    const target = targets.find((item) => item.insurerId === input.insurerId);
    if (!target) throw new Error('INSURER_NOT_PART_OF_RFQ');

    const followUpTaskRef = target.followUpTaskId ? doc(db, 'tasks', target.followUpTaskId) : null;
    const followUpTaskSnapshot = followUpTaskRef ? await transaction.get(followUpTaskRef) : null;

    transaction.set(quoteRef, {
      ...input,
      leadId: rfq.leadId || '',
      quoteNumber: input.quoteNumber?.trim() || '',
      premium: Number(input.premium),
      commissionRate: Number(input.commissionRate),
      commissionAmount,
      deductible: input.deductible === undefined || input.deductible === null
        ? null
        : Number(input.deductible),
      currency: input.currency.trim().toUpperCase(),
      paymentTerms: input.paymentTerms?.trim() || '',
      coverageSummary: input.coverageSummary.trim(),
      documentIds: Array.from(new Set(input.documentIds || [])),
      notes: input.notes?.trim() || '',
      status: 'received',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const insurers = targets.map((item) => item.insurerId === input.insurerId
      ? {
          ...item,
          status: 'quote_received',
          quoteReceivedAt: new Date().toISOString(),
          quoteRecordIds: Array.from(new Set([...(item.quoteRecordIds || []), quoteRef.id])),
        }
      : item);

    transaction.update(rfqRef, {
      insurers,
      insurerIds: targets.map((item) => item.insurerId),
      status: 'quotes_received',
      updatedAt: serverTimestamp(),
    });

    if (followUpTaskRef && followUpTaskSnapshot?.exists()) {
      const task = followUpTaskSnapshot.data();
      if (task.organizationId === input.organizationId
        && task.relatedType === 'rfq'
        && task.relatedId === input.rfqId
        && task.relatedSubId === input.insurerId
        && task.status !== 'completed') {
        transaction.update(followUpTaskRef, { status: 'completed', updatedAt: serverTimestamp() });
      }
    }

    const timelineRef = doc(collection(db, 'clients', input.clientId, 'timeline'));
    transaction.set(timelineRef, {
      organizationId: input.organizationId,
      clientId: input.clientId,
      type: 'quote_received',
      title: `استلام عرض سعر من ${input.insurerName}`,
      description: `تم تسجيل قسط ${input.premium} ${input.currency} وعمولة ${commissionAmount} ${input.currency}.`,
      by: input.createdBy,
      byName: 'InsurNex',
      at: serverTimestamp(),
      metadata: {
        rfqId: input.rfqId,
        quoteId: quoteRef.id,
        insurerId: input.insurerId,
        premium: Number(input.premium),
        currency: input.currency,
        commissionAmount,
      },
    });
  });

  return quoteRef.id;
}

export async function setQuoteOfferStatus(
  quoteId: string,
  organizationId: string,
  nextStatus: 'received' | 'shortlisted' | 'selected' | 'rejected',
): Promise<void> {
  if (!quoteId.trim() || !organizationId.trim()) throw new Error('QUOTE_CONTEXT_REQUIRED');
  const quoteRef = doc(db, QUOTES, quoteId);

  await runTransaction(db, async (transaction) => {
    const quoteSnapshot = await transaction.get(quoteRef);
    if (!quoteSnapshot.exists()) throw new Error('QUOTE_NOT_FOUND');

    const quote = quoteSnapshot.data() as QuoteOffer;
    if (quote.organizationId !== organizationId) throw new Error('QUOTE_ORGANIZATION_MISMATCH');
    if (!canTransitionQuoteStatus(quote.status, nextStatus)) throw new Error('INVALID_QUOTE_TRANSITION');
    if (nextStatus === 'selected' && !isQuoteOfferValid(quote)) throw new Error('QUOTE_EXPIRED');

    const rfqRef = doc(db, 'rfqs', quote.rfqId);
    const rfqSnapshot = await transaction.get(rfqRef);
    if (!rfqSnapshot.exists()) throw new Error('RFQ_NOT_FOUND');
    if (rfqSnapshot.data().organizationId !== organizationId) throw new Error('RFQ_ORGANIZATION_MISMATCH');
    if (rfqSnapshot.data().status === 'closed') throw new Error('RFQ_ALREADY_CLOSED');

    if (nextStatus === 'selected') {
      const previousSelectedId = String(rfqSnapshot.data().selectedQuoteId || '');
      if (previousSelectedId && previousSelectedId !== quoteId) {
        const previousSelectedRef = doc(db, QUOTES, previousSelectedId);
        const previousSelectedSnapshot = await transaction.get(previousSelectedRef);
        if (previousSelectedSnapshot.exists()) {
          const previousSelected = previousSelectedSnapshot.data();
          if (previousSelected.organizationId !== organizationId || previousSelected.rfqId !== quote.rfqId) {
            throw new Error('INVALID_SELECTED_QUOTE_REFERENCE');
          }
          if (previousSelected.status === 'selected') {
            transaction.update(previousSelectedRef, {
              status: 'shortlisted',
              updatedAt: serverTimestamp(),
            });
          }
        }
      }
    }

    transaction.update(quoteRef, {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
    const rfqPatch: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (nextStatus === 'selected') {
      rfqPatch.selectedQuoteId = quoteId;
      rfqPatch.selectedInsurerId = quote.insurerId;
    } else if (quote.status === 'selected' && rfqSnapshot.data().selectedQuoteId === quoteId) {
      rfqPatch.selectedQuoteId = '';
      rfqPatch.selectedInsurerId = '';
    }
    transaction.update(rfqRef, rfqPatch);
  });
}

export async function issuePolicyFromSelectedQuote(
  input: IssuePolicyFromQuoteInput,
): Promise<IssuePolicyFromQuoteResult> {
  const policyNumber = input.policyNumber.trim();
  const today = getTodayDateKey();

  if (!input.organizationId.trim() || !input.quoteId.trim() || !input.uid.trim()) {
    throw new Error('ISSUANCE_CONTEXT_REQUIRED');
  }
  if (!policyNumber) throw new Error('POLICY_NUMBER_REQUIRED');
  if (!isDateOnly(input.startDate) || !isDateOnly(input.expiryDate) || input.startDate >= input.expiryDate) {
    throw new Error('INVALID_POLICY_DATE_RANGE');
  }
  if (!isDateOnly(input.followUpDate) || input.followUpDate < today) {
    throw new Error('INVALID_FOLLOW_UP_DATE');
  }

  const quoteRef = doc(db, QUOTES, input.quoteId);
  const taskRef = doc(collection(db, 'tasks'));
  const quoteIssuedActivityRef = doc(collection(db, 'leadActivities'));
  const todayLocal = getTodayDateKey(new Date());

  const result = await runTransaction(db, async (transaction) => {
    const quoteSnapshot = await transaction.get(quoteRef);
    if (!quoteSnapshot.exists()) throw new Error('QUOTE_NOT_FOUND');
    const quote = quoteSnapshot.data() as QuoteOffer;
    if (quote.organizationId !== input.organizationId) throw new Error('QUOTE_ORGANIZATION_MISMATCH');
    const policyId = buildPolicyDocumentId(input.organizationId, quote.insurerId, policyNumber);
    const policyRef = doc(db, 'policies', policyId);
    if (quote.status !== 'selected') throw new Error('QUOTE_NOT_SELECTED');
    if (!isQuoteOfferValid(quote, todayLocal)) throw new Error('QUOTE_EXPIRED');

    const rfqRef = doc(db, 'rfqs', quote.rfqId);
    const clientRef = doc(db, 'clients', quote.clientId);
    const rfqSnapshot = await transaction.get(rfqRef);
    const clientSnapshot = await transaction.get(clientRef);
    const policySnapshot = await transaction.get(policyRef);
    if (!rfqSnapshot.exists()) throw new Error('RFQ_NOT_FOUND');
    if (!clientSnapshot.exists()) throw new Error('CLIENT_NOT_FOUND');
    if (policySnapshot.exists()) {
      if (policySnapshot.data().quoteId === input.quoteId) throw new Error('QUOTE_ALREADY_ISSUED');
      throw new Error('POLICY_NUMBER_ALREADY_EXISTS_FOR_INSURER');
    }

    const rfq = rfqSnapshot.data();
    const client = clientSnapshot.data();
    if (rfq.organizationId !== input.organizationId || rfq.clientId !== quote.clientId) {
      throw new Error('RFQ_RELATIONSHIP_MISMATCH');
    }
    if (rfq.selectedQuoteId !== input.quoteId) throw new Error('RFQ_SELECTED_QUOTE_MISMATCH');
    if (client.organizationId !== input.organizationId) throw new Error('CLIENT_ORGANIZATION_MISMATCH');
    if (!Array.isArray(rfq.insurers) || !rfq.insurers.some((item: { insurerId: string }) => item.insurerId === quote.insurerId)) {
      throw new Error('QUOTE_INSURER_NOT_IN_RFQ');
    }

    let leadSnapshot = null;
    let leadRef = null;
    if (rfq.leadId) {
      leadRef = doc(db, 'leads', String(rfq.leadId));
      leadSnapshot = await transaction.get(leadRef);
      if (!leadSnapshot.exists()) throw new Error('LEAD_NOT_FOUND');
      const lead = leadSnapshot.data();
      if (lead.organizationId !== input.organizationId || lead.clientId !== quote.clientId) {
        throw new Error('LEAD_RELATIONSHIP_MISMATCH');
      }
      if (!['quotation', 'negotiation', 'won'].includes(String(lead.stage))) {
        throw new Error('LEAD_NOT_READY_FOR_ISSUANCE');
      }
      if (lead.stage === 'lost') throw new Error('LEAD_ALREADY_LOST');
    }

    const documentIds = Array.from(new Set([
      ...(Array.isArray(rfq.documentIds) ? rfq.documentIds : []),
      ...(Array.isArray(quote.documentIds) ? quote.documentIds : []),
    ]));

    const policyData: Omit<Policy, 'id'> = {
      organizationId: input.organizationId,
      clientId: quote.clientId,
      clientName: String(rfq.clientName || client.name || ''),
      insurerId: quote.insurerId,
      insurerName: quote.insurerName,
      policyNumber,
      line: insuranceLine(rfq.insuranceType),
      product: quote.quoteNumber || rfq.insuranceType || 'تغطية تأمينية',
      startDate: input.startDate,
      expiryDate: input.expiryDate,
      premium: Number(quote.premium),
      commissionRate: Number(quote.commissionRate),
      commissionAmount: Number(quote.commissionAmount),
      currency: quote.currency,
      status: input.startDate <= today ? 'active' : 'pending',
      coverage: quote.coverageSummary || rfq.coverageSummary || '',
      ...(quote.deductible === null || quote.deductible === undefined ? {} : { deductible: Number(quote.deductible) }),
      paymentTerms: quote.paymentTerms || '',
      createdBy: input.uid,
      policyId,
      issuedAt: serverTimestamp(),
      rfqId: quote.rfqId,
      quoteId: input.quoteId,
      leadId: rfq.leadId || '',
      documentIds,
      renewalChain: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    transaction.set(policyRef, policyData);
    transaction.update(quoteRef, {
      status: 'issued',
      policyId,
      policyNumber,
      issuedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.update(rfqRef, {
      status: 'closed',
      selectedQuoteId: input.quoteId,
      selectedInsurerId: quote.insurerId,
      issuedPolicyId: policyId,
      updatedAt: serverTimestamp(),
    });
    transaction.update(clientRef, {
      status: 'active',
      updatedAt: serverTimestamp(),
    });

    const clientTimelineRef = doc(collection(db, 'clients', quote.clientId, 'timeline'));
    transaction.set(clientTimelineRef, {
      organizationId: input.organizationId,
      clientId: quote.clientId,
      type: 'policy_issued_from_quote',
      title: `تم إصدار الوثيقة ${policyNumber}`,
      description: `تم إصدار الوثيقة من عرض ${quote.insurerName} المرتبط بطلب التسعير.`,
      by: input.uid,
      byName: 'InsurNex',
      at: serverTimestamp(),
      metadata: {
        rfqId: quote.rfqId,
        quoteId: input.quoteId,
        policyId,
        insurerId: quote.insurerId,
        premium: quote.premium,
        currency: quote.currency,
      },
    });

    transaction.set(taskRef, {
      organizationId: input.organizationId,
      title: `متابعة الوثيقة ${policyNumber}`,
      description: `متابعة تسليم الوثيقة والتحقق من استكمال خطوات العميل.`,
      priority: 'medium',
      status: 'open',
      dueDate: input.followUpDate,
      assignedTo: input.uid,
      relatedType: 'policy',
      relatedId: policyId,
      createdBy: input.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (leadSnapshot && leadRef) {
      const lead = leadSnapshot.data();
      if (lead.stage !== 'won') {
        transaction.update(leadRef, {
          stage: 'won',
          wonAt: serverTimestamp(),
          lastActivityAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      transaction.set(quoteIssuedActivityRef, {
        organizationId: input.organizationId,
        leadId: quote.leadId || rfq.leadId,
        type: 'converted',
        message: `تم إصدار الوثيقة ${policyNumber} من عرض ${quote.insurerName}`,
        createdBy: input.uid,
        createdAt: serverTimestamp(),
      });
    }

    return { policyId, policyNumber, followUpTaskId: taskRef.id };
  });

  return result;
}
