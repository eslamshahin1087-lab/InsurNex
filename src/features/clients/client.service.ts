import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
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

export async function activateIssuedClientV978(clientId:string,organizationId:string){
 const ref=doc(db,'clients',clientId);
 const snap=await getDoc(ref);
 if(!snap.exists()) throw new Error('Client not found: '+clientId);
 const data=snap.data() as InsuranceClient;
 if(data.organizationId!==organizationId) throw new Error('Client organization mismatch');
 if(data.status==='active') return;
 await updateDoc(ref,{status:'active',updatedAt:serverTimestamp()});
}

export async function repairIssuedProspectByNameV979(organizationId:string,clientName:string){
 const clientsSnap=await getDocs(query(collection(db,'clients'),where('organizationId','==',organizationId),limit(200)));
 const matches=clientsSnap.docs.filter(d=>String(d.data().name||'').trim().toLowerCase()===clientName.trim().toLowerCase());
 if(matches.length!==1) throw new Error('Safety stop: expected exactly one client named '+clientName+', found '+matches.length);
 const clientDoc=matches[0]; const client=clientDoc.data() as InsuranceClient;
 const policiesSnap=await getDocs(query(collection(db,'policies'),where('organizationId','==',organizationId),where('clientId','==',clientDoc.id),limit(50)));
 if(policiesSnap.empty) throw new Error('Safety stop: no Policy exists for client '+clientDoc.id);
 const operationsSnap=await getDocs(query(collection(db,'operations'),where('organizationId','==',organizationId),where('clientId','==',clientDoc.id),limit(100)));
 const completed=operationsSnap.docs.filter(d=>{const x=d.data();return x.kind==='policy_issuance'&&x.status==='completed'});
 if(completed.length===0) throw new Error('Safety stop: no completed issuance operation exists for client '+clientDoc.id);
 if(client.status==='active') return {clientId:clientDoc.id,changed:false,policyCount:policiesSnap.size,completedIssuanceCount:completed.length};
 if(client.status!=='prospect') throw new Error('Safety stop: client status is '+client.status+', not prospect');
 await updateDoc(clientDoc.ref,{status:'active',updatedAt:serverTimestamp()});
 return {clientId:clientDoc.id,changed:true,policyCount:policiesSnap.size,completedIssuanceCount:completed.length};
}
