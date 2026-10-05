import type { Medical42Result } from './medical42.types';
export type RiskBand='low'|'medium'|'high'|'critical';
export type Medical54Metric={label:string;value:number;unit:'money'|'count'|'ratio';band:RiskBand;note:string};
export type Medical54MatrixItem={label:string;frequency:number;severity:number;gross:number;share:number;band:RiskBand};
export type Medical54Result={frequencyPerMember:number;severityPerTransaction:number;costPerActiveMember:number;concentrationScore:number;providerDependencyScore:number;highCostScore:number;renewalRiskScore:number;renewalBand:RiskBand;matrix:Medical54MatrixItem[];providerServiceSignals:string[];caseManagementSignals:string[];pharmacySignals:string[];trendSignals:string[];executiveActions:string[];metrics:Medical54Metric[]};
const clamp=(n:number)=>Math.max(0,Math.min(100,n));
const band=(n:number):RiskBand=>n>=80?'critical':n>=60?'high':n>=35?'medium':'low';
export function analyzeMedical54(r:Medical42Result):Medical54Result{
 const frequencyPerMember=r.members?r.records/r.members:0,severityPerTransaction=r.records?r.gross/r.records:0,costPerActiveMember=r.members?r.gross/r.members:0;
 const concentrationScore=clamp(r.top10Share*220+r.top50Share*35);
 const providerDependencyScore=clamp((r.providersRanked[0]?.share||0)*240+(r.providersRanked.slice(0,3).reduce((s,x)=>s+x.share,0))*45);
 const highCostScore=clamp((r.members?r.above50k/r.members:0)*450+(r.members?r.above100k/r.members:0)*900+r.top10Share*90);
 const trendRows=r.trend.filter(x=>!x.partial),last=trendRows.at(-1),prev=trendRows.at(-2);const trendDelta=last&&prev&&prev.gross?(last.gross-prev.gross)/prev.gross:0;
 const renewalRiskScore=clamp(concentrationScore*.3+providerDependencyScore*.2+highCostScore*.3+Math.max(0,trendDelta)*100*.2);
 const matrix=r.membersRanked.slice(0,12).map((x,i)=>{const frequency=x.count;const severity=x.severity;const relativeSeverity=severityPerTransaction?severity/severityPerTransaction:0;const score=clamp(Math.min(50,frequency*2)+Math.min(50,relativeSeverity*18));return{label:`Member Rank ${i+1}`,frequency,severity,gross:x.gross,share:x.share,band:band(score)}});
 const providerServiceSignals=r.providersRanked.slice(0,5).map(x=>`${x.name}: ${(x.share*100).toFixed(1)}% of cost, ${x.count} transactions, severity ${x.severity.toFixed(0)}.`);
 const pharmacyShare=r.pharmacy.reduce((s,x)=>s+x.gross,0)/(r.gross||1);const pharmacySignals=[`Detected pharmacy-like activity share: ${(pharmacyShare*100).toFixed(1)}%.`,...r.pharmacy.slice(0,5).map(x=>`${x.name}: ${x.count} transactions, cost ${x.gross.toFixed(0)}.`)];
 const caseManagementSignals=[...r.membersRanked.filter(x=>x.gross>=100000).slice(0,8).map((x,i)=>`Member Rank ${i+1}: high-cost case above 100K with ${x.count} transactions.`),...r.membersRanked.filter(x=>x.count>=50).slice(0,5).map((x,i)=>`High-frequency member candidate ${i+1}: ${x.count} transactions.`)];
 const trendSignals: string[]=[...(trendDelta>0?[`Latest complete month cost increased ${(trendDelta*100).toFixed(1)}% versus previous complete month.`]:[`No positive latest complete-month acceleration detected.`]),...r.trend.filter(x=>x.partial).map(x=>`${x.month} is partial and should be normalized before renewal projection.`)];
 const executiveActions=[renewalRiskScore>=60?'Escalate the portfolio for focused renewal review before pricing decisions.':'Maintain standard renewal monitoring with targeted utilization review.',r.top10Share>=.15?'Prioritize case management for the highest-cost member cohort.':'Continue monitoring member concentration.',(r.providersRanked[0]?.share||0)>=.2?'Review dependency, unit cost and utilization mix at the leading provider.':'Provider concentration is not currently the dominant signal.',pharmacyShare>=.3?'Perform chronic medication and repeat-dispensing review.':'Continue pharmacy trend monitoring.'];
 const metrics:Medical54Metric[]=[{label:'Frequency / Member',value:frequencyPerMember,unit:'ratio',band:band(clamp(frequencyPerMember*3)),note:'Average medical transactions per active member.'},{label:'Severity / Transaction',value:severityPerTransaction,unit:'money',band:band(clamp(severityPerTransaction/50)),note:'Average gross amount per transaction.'},{label:'Cost / Active Member',value:costPerActiveMember,unit:'money',band:band(clamp(costPerActiveMember/150)),note:'Average portfolio cost per active member.'},{label:'Concentration Score',value:concentrationScore,unit:'ratio',band:band(concentrationScore),note:'Composite member concentration indicator.'},{label:'Provider Dependency',value:providerDependencyScore,unit:'ratio',band:band(providerDependencyScore),note:'Composite provider concentration indicator.'},{label:'Renewal Risk',value:renewalRiskScore,unit:'ratio',band:band(renewalRiskScore),note:'Operational renewal-risk indicator, not a pricing recommendation.'}];
 return{frequencyPerMember,severityPerTransaction,costPerActiveMember,concentrationScore,providerDependencyScore,highCostScore,renewalRiskScore,renewalBand:band(renewalRiskScore),matrix,providerServiceSignals,caseManagementSignals,pharmacySignals,trendSignals,executiveActions,metrics};
}

export function medical54GeminiContext(r: Medical42Result) {
  const a = analyzeMedical54(r);
  return {
    frequencyPerMember: a.frequencyPerMember,
    severityPerTransaction: a.severityPerTransaction,
    costPerActiveMember: a.costPerActiveMember,
    concentrationScore: a.concentrationScore,
    providerDependencyScore: a.providerDependencyScore,
    highCostScore: a.highCostScore,
    renewalRiskScore: a.renewalRiskScore,
    renewalBand: a.renewalBand,
    frequencySeverityMatrix: a.matrix.slice(0, 12),
    providerSignals: a.providerServiceSignals.slice(0, 8),
    pharmacySignals: a.pharmacySignals.slice(0, 10),
    caseManagementSignals: a.caseManagementSignals.slice(0, 12),
    trendSignals: a.trendSignals.slice(0, 10),
    executiveActions: a.executiveActions,
  };
}
