import { addDoc,collection,doc,getDocs,limit,orderBy,query,serverTimestamp,updateDoc,where } from 'firebase/firestore';
import { db } from '../../firebase/config';import type { AppTask,TaskInput,TaskStatus } from '../../types/task';
export async function listTasks(org:string){const q=query(collection(db,'tasks'),where('organizationId','==',org),orderBy('dueDate','asc'),limit(100));const s=await getDocs(q);return s.docs.map(d=>({id:d.id,...d.data()} as AppTask));}
export async function createTask(input:TaskInput,org:string,uid:string){return addDoc(collection(db,'tasks'),{...input,organizationId:org,createdBy:uid,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});}
export async function setTaskStatus(id:string,status:TaskStatus){await updateDoc(doc(db,'tasks',id),{status,updatedAt:serverTimestamp()});}
