import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';

export type RenewalStage='overdue'|'urgent'|'due30'|'due60'|'due90'|'later';
export type Renewal2Item={id:string;policyId:string;clientId:string;clientName:string;insurerName:string;policyNumber:string;line:string;expiryDate:string;premium:number;currency:string;status:string;daysLeft:number;stage:RenewalStage};

function dayStart(d:Date){return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()}
function daysUntil(date:string){if(!date)return Number.MAX_SAFE_INTEGER;const t=new Date(date+'T00:00:00');if(Number.isNaN(t.getTime()))return Number.MAX_SAFE_INTEGER;return Math.ceil((dayStart(t)-dayStart(new Date()))/86400000)}
function stage(days:number):RenewalStage{if(days<0)return 'overdue';if(days<=7)return 'urgent';if(days<=30)return 'due30';if(days<=60)return 'due60';if(days<=90)return 'due90';return 'later'}

export async function listRenewals2(org:string):Promise<Renewal2Item[]>{
 const q=query(collection(db,'policies'),where('organizationId','==',org),limit(300));
 const s=await getDocs(q);
 return s.docs.map(d=>{
  const v=d.data();const days=daysUntil(String(v.expiryDate||''));
  return {id:d.id,policyId:d.id,clientId:String(v.clientId||''),clientName:String(v.clientName||''),insurerName:String(v.insurerName||''),policyNumber:String(v.policyNumber||''),line:String(v.line||''),expiryDate:String(v.expiryDate||''),premium:Number(v.premium||0),currency:String(v.currency||'EGP'),status:String(v.status||''),daysLeft:days,stage:stage(days)};
 }).filter(x=>x.status!=='cancelled'&&Boolean(x.expiryDate)).sort((a,b)=>a.daysLeft-b.daysLeft);
}
