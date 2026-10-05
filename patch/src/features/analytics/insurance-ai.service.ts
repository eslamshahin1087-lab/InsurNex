import type { AnalyticsSnapshot } from './analytics.service';
export type InsuranceAIInsight={summary:string;risks:string[];opportunities:string[];actions:string[]};
export function buildInsuranceAnalysisContext(data:AnalyticsSnapshot){return{portfolio:{clients:data.clients,policies:data.policies,premium:data.premium,claims:data.claims,claimAmount:data.claimAmount},sales:{pipeline:data.pipeline,won:data.won,lost:data.lost,winRate:data.winRate,stages:data.stages,sources:data.sources},insuranceTypes:data.insuranceTypes,insurers:data.insurers};}
// Integration point for Firebase AI Logic. Send aggregate metrics, not raw PII, and require structured JSON output.
