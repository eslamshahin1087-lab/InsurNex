import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { updateProfile, type User } from 'firebase/auth';
import { db } from '../../firebase/config';
import type { OrganizationType } from '../../types/auth';

function organizationId(uid:string){ return `org_${uid}`; }
export async function createOwnerWorkspace(user:User, input:{displayName:string; organizationName:string; organizationType:OrganizationType}){
  const orgId=organizationId(user.uid); const batch=writeBatch(db);
  batch.set(doc(db,'organizations',orgId),{name:input.organizationName.trim(),type:input.organizationType,ownerId:user.uid,country:'EG',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  batch.set(doc(db,'users',user.uid),{email:user.email ?? '',displayName:input.displayName.trim(),organizationId:orgId,role:'owner',status:'active',membershipEnforced:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  batch.set(doc(db,'organizations',orgId,'members',user.uid),{uid:user.uid,email:user.email ?? '',displayName:input.displayName.trim(),role:'owner',status:'active',createdAt:serverTimestamp()});
  await batch.commit(); await updateProfile(user,{displayName:input.displayName.trim()}); return orgId;
}
