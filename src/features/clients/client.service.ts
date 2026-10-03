import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { ClientInput, InsuranceClient } from '../../types/client';
export async function createClient(input:ClientInput, organizationId:string, uid:string){
 const ref=await addDoc(collection(db,'clients'),{...input,organizationId,createdBy:uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()}); return ref.id;
}
export async function listClients(organizationId:string){
 const q=query(collection(db,'clients'),where('organizationId','==',organizationId),orderBy('createdAt','desc'),limit(100));
 const snap=await getDocs(q); return snap.docs.map(d=>({id:d.id,...d.data()} as InsuranceClient));
}
export async function getClient(id:string){const snap=await getDoc(doc(db,'clients',id));return snap.exists()?({id:snap.id,...snap.data()} as InsuranceClient):null;}
