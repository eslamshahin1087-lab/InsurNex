export type TaskRelationType = 'client' | 'claim' | 'policy' | 'renewal' | 'lead' | 'general';
export type TaskRelation = { type: TaskRelationType; id: string; label: string; href: string };

export function resolveTaskRelation(relatedType?: string, relatedId?: string): TaskRelation {
  const type = (relatedType || 'general') as TaskRelationType;
  const id = relatedId || '';
  if (type === 'client' && id) return { type, id, label: 'Ù…Ù„Ù Ø§Ù„Ø¹Ù…ÙŠÙ„', href: `/clients/${id}` };
  if (type === 'claim' && id) return { type, id, label: 'Ø§Ù„Ù…Ø·Ø§Ù„Ø¨Ø©', href: `/claims/${id}` };
  if (type === 'lead' && id) return { type, id, label: 'ÙØ±ØµØ© Ø§Ù„Ø¨ÙŠØ¹', href: `/leads/${id}` };
  if (type === 'policy') return { type, id, label: 'Ø§Ù„ÙˆØ«ÙŠÙ‚Ø©', href: '/policies' };
  if (type === 'renewal') return { type, id, label: 'Ø§Ù„ØªØ¬Ø¯ÙŠØ¯', href: '/renewals' };
  return { type: 'general', id: '', label: 'Ù…Ù‡Ù…Ø© Ø¹Ø§Ù…Ø©', href: '/tasks' };
}

export function taskRelationKey(relatedType?: string, relatedId?: string) {
  const relation = resolveTaskRelation(relatedType, relatedId);
  return `${relation.type}:${relation.id || 'general'}`;
}