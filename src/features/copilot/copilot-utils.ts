import type { CopilotMessage } from './copilot.types';

export function formatMessageTime(createdAt: unknown): string {
  if (!createdAt) return '';
  const maybeDate = createdAt as { toDate?: () => Date };
  const date =
    typeof maybeDate.toDate === 'function'
      ? maybeDate.toDate()
      : createdAt instanceof Date
        ? createdAt
        : null;
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '';
  }
}

export function buildTitleFromFirstMessage(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'محادثة جديدة';
  return trimmed.length > 40 ? `${trimmed.slice(0, 40)}…` : trimmed;
}

export function canSendMessage(text: string): boolean {
  return text.trim().length > 0 && text.trim().length <= 4000;
}

export function computeInitials(name?: string): string {
  if (!name) return 'AI';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export const SUGGESTED_PROMPTS: { label: string; prompt: string }[] = [
  {
    label: 'لخّص لي محفظة العملاء',
    prompt:
      'أعطني ملخصًا سريعًا لمحفظة العملاء الحالية، مع أهم النقاط التي يجب أن أركز عليها.',
  },
  {
    label: 'ما الوثائق التي تحتاج تجديدًا قريبًا؟',
    prompt:
      'ما الوثائق التي تنتهي خلال الثلاثين يومًا القادمة؟ رتبها حسب الأهمية.',
  },
  {
    label: 'كيف أحسّن نسبة الاحتفاظ بالعملاء؟',
    prompt:
      'أعطني خمس نصائح عملية لتحسين نسبة الاحتفاظ بالعملاء في مكتب وساطة تأمين.',
  },
  {
    label: 'اشرح لي الفرق بين التأمين الطبي والتكافل',
    prompt:
      'اشرح الفرق بين التأمين الطبي التقليدي والتأمين التكافلي الطبي باختصار.',
  },
  {
    label: 'ما المستندات المطلوبة لفتح مطالبة؟',
    prompt:
      'ما المستندات الأساسية المطلوبة عادةً لفتح مطالبة تأمين طبي؟',
  },
];

export function lastUserMessage(messages: CopilotMessage[]): CopilotMessage | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') return messages[i];
  }
  return null;
}