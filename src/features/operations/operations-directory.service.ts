import { addDoc, collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
export type OperationsEmailContact={id:string;organizationId:string;email:string;label:string;createdBy:string;createdAt?:unknown};
export async function listOperationsEmails(org:string){const s=await getDocs(query(collection(db,'operationsEmailDirectory'),where('organizationId','==',org),limit(100)));return s.docs.map(d=>({id:d.id,...d.data()} as OperationsEmailContact)).sort((a,b)=>a.email.localeCompare(b.email));}
export async function addOperationsEmail(org:string,email:string,label:string,uid:string){return addDoc(collection(db,'operationsEmailDirectory'),{organizationId:org,email:email.trim().toLowerCase(),label:label.trim(),createdBy:uid,createdAt:serverTimestamp()});}
export async function removeOperationsEmail(id:string){await deleteDoc(doc(db,'operationsEmailDirectory',id));}
