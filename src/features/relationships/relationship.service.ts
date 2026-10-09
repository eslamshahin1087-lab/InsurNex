import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from '../../firebase/config';

export type RelatedPolicy = { id:string; clientId:string; clientName:string; insurerName:string; policyNumber:string; line:string; startDate:string; expiryDate:string; premium:number; currency:string; status:string; };
export type RelatedClaim = { id:string; clientId:string; clientName:string; claimNumber:string; policyId:string; policyNumber:string; insurerName:string; status:string; incidentDate:string; claimAmount:number; currency:string; };
export type RelatedTask = { id:string; title:string; status:string; priority:string; dueDate:string; relatedType:string; relatedId:string; };
export type ClientRelations = { policies:RelatedPolicy[]; claims:RelatedClaim[]; tasks:RelatedTask[] };

export async function listPoliciesForOrganization(organizationId:string):Promise<RelatedPolicy[]> {
 const q=query(collection(db,'policies'),where('organizationId','==',organizationId),orderBy('createdAt','desc'),limit(200));
 const s=await getDocs(q); return s.docs.map(d=>({id:d.id,...d.data()} as RelatedPolicy));
}
export async function getClientRelations(organizationId:string, clientId:string):Promise<ClientRelations> {
 const policiesQ=query(collection(db,'policies'),where('organizationId','==',organizationId),where('clientId','==',clientId),orderBy('createdAt','desc'),limit(200));
 const claimsQ=query(collection(db,'claims'),where('organizationId','==',organizationId),where('clientId','==',clientId),limit(100));
 const tasksQ=query(collection(db,'tasks'),where('organizationId','==',organizationId),where('relatedType','==','client'),where('relatedId','==',clientId),limit(100));
 const [p,c,t]=await Promise.all([getDocs(policiesQ),getDocs(claimsQ),getDocs(tasksQ)]);
 return {policies:p.docs.map(d=>({id:d.id,...d.data()} as RelatedPolicy)),claims:c.docs.map(d=>({id:d.id,...d.data()} as RelatedClaim)),tasks:t.docs.map(d=>({id:d.id,...d.data()} as RelatedTask))};
}
