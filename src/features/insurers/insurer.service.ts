import { addDoc, collection, getDocs, limit, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../firebase/config'; import type { Insurer } from '../../types/insurance';
export async function listInsurers(organizationId:string){const q=query(collection(db,'insurers'),where('organizationId','==',organizationId),orderBy('name'),limit(100));const snap=await getDocs(q);return snap.docs.map(d=>({id:d.id,...d.data()} as Insurer));}
export async function createInsurer(input:Omit<Insurer,'id'|'organizationId'|'createdAt'>,organizationId:string){return addDoc(collection(db,'insurers'),{...input,organizationId,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});}
