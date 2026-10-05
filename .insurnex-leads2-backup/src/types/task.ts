export type TaskPriority='low'|'medium'|'high'|'urgent';
export type TaskStatus='open'|'in_progress'|'completed';
export type TaskRelatedType='general'|'client'|'policy'|'renewal'|'claim';
export interface AppTask {id:string;organizationId:string;title:string;description:string;priority:TaskPriority;status:TaskStatus;dueDate:string;assignedTo:string;relatedType:TaskRelatedType;relatedId:string;createdBy:string;createdAt?:unknown;updatedAt?:unknown;}
export type TaskInput=Omit<AppTask,'id'|'organizationId'|'createdBy'|'createdAt'|'updatedAt'>;
