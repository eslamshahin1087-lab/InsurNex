export type TaskRelationType = 'client' | 'claim' | 'policy' | 'renewal' | 'general';
export type TaskRelation = { type: TaskRelationType; id: string; label: string; href: string };

export function resolveTaskRelation(relatedType?: string, relatedId?: string): TaskRelation {
  const type = (relatedType || 'general') as TaskRelationType;
  const id = relatedId || '';
  if (type === 'client' && id) return { type, id, label: 'ملف العميل', href: `/clients/${id}` };
  if (type === 'claim' && id) return { type, id, label: 'المطالبة', href: `/claims/${id}` };
  if (type === 'policy') return { type, id, label: 'الوثيقة', href: '/policies' };
  if (type === 'renewal') return { type, id, label: 'التجديد', href: '/renewals' };
  return { type: 'general', id: '', label: 'مهمة عامة', href: '/tasks' };
}

export function taskRelationKey(relatedType?: string, relatedId?: string) {
  const relation = resolveTaskRelation(relatedType, relatedId);
  return `${relation.type}:${relation.id || 'general'}`;
}
