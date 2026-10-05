export type Medical42Level='info'|'watch'|'high'|'critical';
export interface Medical42Mapping{member:string;memberId:string;category:string;date:string;provider:string;activity:string;gross:string;copay:string;net:string}
export interface Medical42Record{member:string;memberId:string;category:string;date:string;provider:string;activity:string;gross:number;copay:number;net:number}
export interface Medical42Rank{name:string;count:number;members:number;gross:number;copay:number;net:number;share:number;severity:number}
export interface Medical42Trend{month:string;count:number;members:number;gross:number;severity:number;partial:boolean;daysObserved:number}
export interface Medical42Signal{level:Medical42Level;title:string;finding:string;evidence:string[];action:string}
export interface Medical42Result{records:number;members:number;providers:number;gross:number;copay:number;net:number;copayRate:number;avgTransaction:number;avgMember:number;top10Share:number;top50Share:number;above25k:number;above50k:number;above75k:number;above100k:number;under1k:number;categories:Medical42Rank[];providersRanked:Medical42Rank[];membersRanked:Medical42Rank[];activities:Medical42Rank[];pharmacy:Medical42Rank[];trend:Medical42Trend[];signals:Medical42Signal[];costDrivers:{name:string;amount:number;share:number}[];dataGaps:string[]}
