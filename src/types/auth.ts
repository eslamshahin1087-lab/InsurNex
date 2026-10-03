export type UserRole = 'owner' | 'admin' | 'broker' | 'sales' | 'claims' | 'finance' | 'staff';
export type OrganizationType = 'individual' | 'office' | 'company';
export interface AppUser { uid:string; email:string; displayName:string; organizationId:string; role:UserRole; status:'active'|'invited'|'disabled'; }
export interface Organization { id:string; name:string; type:OrganizationType; ownerId:string; country:string; createdAt?:unknown; updatedAt?:unknown; }
