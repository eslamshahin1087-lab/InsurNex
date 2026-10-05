import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { getApp } from 'firebase/app';
import type { Medical42Result } from './medical42.types';

export type GeminiMedicalAnalysis = {
  executiveSummary: string;
  keyFindings: string[];
  costDrivers: string[];
  memberInsights: string[];
  providerInsights: string[];
  trendInsights: string[];
  riskSignals: string[];
  caseManagementOpportunities: string[];
  renewalConsiderations: string[];
  recommendedActions: string[];
  dataLimitations: string[];
};

const PRIMARY_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODEL = 'gemini-3.5-flash-lite';
const RETRY_DELAYS_MS = [1200, 2800, 5500];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const clean = (value: string) => value.replace(/^```json\s*/i, '').replace(/```$/, '').trim();

function statusOf(error: unknown): number | null {
  const text = String((error as { message?: unknown })?.message ?? error ?? '');
  const match = text.match(/\[(\d{3})\]|(?:status(?: code)?[: ]+)(\d{3})|\b(4\d\d|5\d\d)\b/i);
  const raw = match?.[1] ?? match?.[2] ?? match?.[3];
  return raw ? Number(raw) : null;
}

function isRetryable(error: unknown) {
  const status = statusOf(error);
  return status === 408 || status === 429 || (status !== null && status >= 500 && status <= 599);
}

function makeContext(r: Medical42Result, language: 'ar' | 'en') {
  return {
    language,
    records: r.records,
    members: r.members,
    providers: r.providers,
    gross: r.gross,
    copay: r.copay,
    net: r.net,
    copayRate: r.copayRate,
    avgTransaction: r.avgTransaction,
    avgMember: r.avgMember,
    top10Share: r.top10Share,
    top50Share: r.top50Share,
    above50k: r.above50k,
    above100k: r.above100k,
    costDrivers: r.costDrivers.slice(0, 12),
    providersRanked: r.providersRanked.slice(0, 12).map(({ name, count, members, gross, share, severity }) => ({ name, count, members, gross, share, severity })),
    membersRanked: r.membersRanked.slice(0, 12).map(({ count, gross, share, severity }, index) => ({ memberRank: index + 1, count, gross, share, severity })),
    activities: r.activities.slice(0, 15).map(({ name, count, gross, share, severity }) => ({ name, count, gross, share, severity })),
    trend: r.trend.slice(0, 36),
    signals: r.signals,
    dataGaps: r.dataGaps,
  };
}

function promptFor(r: Medical42Result, language: 'ar' | 'en') {
  const languageName = language === 'ar' ? 'Arabic' : 'English';
  return `You are InsurNex Medical Insurance Intelligence. Analyze insurance utilization and portfolio cost only. Never diagnose, recommend treatment, or infer missing facts. Numeric metrics below are validated deterministic calculations and must not be recalculated or invented. Member names and identifiers have been removed. Answer in ${languageName}. Return ONLY valid JSON with these exact keys: executiveSummary:string, keyFindings:string[], costDrivers:string[], memberInsights:string[], providerInsights:string[], trendInsights:string[], riskSignals:string[], caseManagementOpportunities:string[], renewalConsiderations:string[], recommendedActions:string[], dataLimitations:string[].\nAGGREGATED_CONTEXT=${JSON.stringify(makeContext(r, language))}`;
}

async function generate(modelName: string, prompt: string): Promise<GeminiMedicalAnalysis> {
  const ai = getAI(getApp(), { backend: new GoogleAIBackend() });
  const model = getGenerativeModel(ai, {
    model: modelName,
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  });
  const result = await model.generateContent(prompt);
  return JSON.parse(clean(result.response.text())) as GeminiMedicalAnalysis;
}

export type GeminiProgress = 'connecting' | 'retrying' | 'fallback' | 'complete';

export async function requestGeminiMedicalAnalysis(r: Medical42Result, language: 'ar' | 'en', onProgress?: (state: GeminiProgress) => void): Promise<GeminiMedicalAnalysis> {
  const prompt = promptFor(r, language);
  onProgress?.('connecting');
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const answer = await generate(PRIMARY_MODEL, prompt);
      onProgress?.('complete');
      return answer;
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === RETRY_DELAYS_MS.length) break;
      onProgress?.('retrying');
      const jitter = Math.floor(Math.random() * 450);
      await sleep(RETRY_DELAYS_MS[attempt] + jitter);
    }
  }
  if (isRetryable(lastError)) {
    onProgress?.('fallback');
    try {
      const answer = await generate(FALLBACK_MODEL, prompt);
      onProgress?.('complete');
      return answer;
    } catch (fallbackError) {
      lastError = fallbackError;
    }
  }
  throw lastError;
}
