export interface CurrencyFinanceSummary {
  currency: string;
  grossPremiums: number;
  totalRevenue: number;
  outstandingReceivables: number;
  totalExpenses: number;
  netIncome: number;
  pendingCommissions: number;
  receivedCommissions: number;
}

export interface FinancialSummaryResult {
  currencies: CurrencyFinanceSummary[];
  dataQuality: {
    missingOrInvalidCurrencyRows: number;
    invalidAmountRows: number;
    unclassifiedRevenueRows: number;
  };
  recordCounts: {
    revenue: number;
    expenses: number;
    commissions: number;
  };
}

export type FinanceMetricKey =
  | 'totalRevenue'
  | 'totalExpenses'
  | 'netIncome'
  | 'pendingCommissions'
  | 'receivedCommissions';

export function computeFinancialSummary(
  revenue?: Array<{ amount: number; currency?: string; status: string; type?: 'premium' | 'commission' | 'fee' | 'outstanding' }>,
  expenses?: Array<{ amount: number; currency?: string }>,
  commissions?: Array<{ commissionAmount: number; currency?: string; status: string }>,
): FinancialSummaryResult;

export function formatCurrencyAmount(amount: number, currency: string, locale?: string): string;
export function formatFinanceMetric(currencies: CurrencyFinanceSummary[], metric: FinanceMetricKey, locale?: string): string;
export function buildPolicyCommissionDocumentId(policyId: string): string;
