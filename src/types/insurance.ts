export type PolicyStatus = 'active' | 'pending' | 'expired' | 'cancelled';
export type InsuranceLine = 'medical' | 'motor' | 'property' | 'marine' | 'life' | 'liability' | 'other';
export interface Insurer { id:string; organizationId:string; name:string; contactName:string; phone:string; email:string; status:'active'|'inactive'; createdAt?:unknown; }
export interface Policy { id:string; organizationId:string; clientId:string; clientName:string; insurerId:string; insurerName:string; policyNumber:string; line:InsuranceLine; product:string; startDate:string; expiryDate:string; premium:number; commissionRate:number; commissionAmount:number; currency:string; status:PolicyStatus; coverage:string; createdBy:string; createdAt?:unknown; updatedAt?:unknown; }
export type PolicyInput = Omit<Policy,'id'|'organizationId'|'clientName'|'insurerName'|'commissionAmount'|'createdBy'|'createdAt'|'updatedAt'>;
