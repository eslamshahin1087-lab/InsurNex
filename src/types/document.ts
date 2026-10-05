export type DocumentCategory='policy'|'claim'|'client'|'identity'|'proposal'|'correspondence'|'other';
export type DocumentRelationType='client'|'policy'|'claim'|'general';
export type DocumentRecord={id:string;organizationId:string;name:string;category:DocumentCategory;originalFileName:string;contentType:string;size:number;storagePath:string;downloadUrl:string;relatedType:DocumentRelationType;relatedId:string;uploadedBy:string;notes:string;createdAt?:unknown};
