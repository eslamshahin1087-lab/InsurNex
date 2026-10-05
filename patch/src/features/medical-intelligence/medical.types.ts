export type Money=number;export type MedicalLevel='low'|'moderate'|'high'|'critical';
export interface MedicalRecord{member:string;provider:string;category:string;service:string;drug:string;date:string;gross:Money;copay:Money;net:Money}
export interface RankedMetric{name:string;count:number;amount:Money;share:number;average:Money}
export interface MedicalTrendPoint{period:string;count:number;amount:Money;average:Money;partial:boolean}
export interface MedicalInsight{level:MedicalLevel;title:string;detail:string;evidence:string[]}
export interface MedicalAnalyticsResult{records:number;members:number;providers:number;gross:Money;copay:Money;net:Money;copayRate:number|null;averageLine:Money;averageMember:Money;top10Share:number;top50Share:number;highCost50k:number;highCost100k:number;membersUnder1k:number;categories:RankedMetric[];providersRanked:RankedMetric[];membersRanked:RankedMetric[];drugs:RankedMetric[];trend:MedicalTrendPoint[];insights:MedicalInsight[];dataGaps:string[]}
