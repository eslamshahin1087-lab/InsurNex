import Anthropic from '@anthropic-ai/sdk';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeChatResult {
  reply: string;
  usage: unknown;
  model: string;
}

const MAX_MESSAGES = 30;
const MAX_CONTENT_LENGTH = 8000;

export function validateMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('INVALID_MESSAGES');
  }
  if (messages.length > MAX_MESSAGES) {
    throw new Error('TOO_MANY_MESSAGES');
  }
  const clean: ChatMessage[] = [];
  for (const raw of messages) {
    if (!raw || typeof raw !== 'object') throw new Error('INVALID_MESSAGES');
    const role = (raw as { role?: unknown }).role;
    const content = (raw as { content?: unknown }).content;
    if (role !== 'user' && role !== 'assistant') throw new Error('INVALID_MESSAGES');
    if (typeof content !== 'string' || !content.trim()) throw new Error('INVALID_MESSAGES');
    if (content.length > MAX_CONTENT_LENGTH) throw new Error('CONTENT_TOO_LONG');
    clean.push({ role, content: content.trim() });
  }
  if (clean[clean.length - 1].role !== 'user') {
    throw new Error('LAST_MESSAGE_MUST_BE_USER');
  }
  return clean;
}

export async function callClaude(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: ChatMessage[];
}): Promise<ClaudeChatResult> {
  const client = new Anthropic({
    apiKey: params.apiKey,
    timeout: 45000,
    maxRetries: 2,
  });

  const response = await client.messages.create({
    model: params.model,
    max_tokens: 1500,
    temperature: 0.3,
    system: params.systemPrompt,
    messages: params.messages,
  });

  const reply = response.content
    .filter((block) => block.type === 'text')
    .map((block) => (block as { text: string }).text)
    .join('')
    .trim();

  return {
    reply,
    usage: response.usage,
    model: response.model,
  };
}