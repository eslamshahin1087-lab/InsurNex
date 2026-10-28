// Supabase Edge Function: copilot-chat
// Deno runtime — Gemini + Groq with automatic fallback + full context support

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') ?? '';
const FIREBASE_API_KEY = Deno.env.get('FIREBASE_API_KEY') ?? '';

const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash';
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') ?? 'openai/gpt-oss-120b';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-firebase-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM_PROMPT = `You are InsurNex AI Copilot, an assistant built specifically for insurance brokers, brokerage offices, and brokerage companies.

## Your role
- Help the broker understand their clients, policies, claims, renewals, leads, insurers, and financials.
- Answer questions about specific entities when context is provided.
- Summarize portfolios, extract key information, and suggest next actions.
- Explain insurance concepts in clear language when asked.

## Strict rules
1. NEVER invent or guess factual data. If a value is not present in the supplied context, say so explicitly.
2. Treat all numbers, dates, and identifiers in the provided context as authoritative.
3. NEVER provide medical diagnoses, treatment recommendations, or clinical decisions.
4. NEVER make final business decisions. You provide analysis and options; the broker decides.
5. Do NOT expose raw JSON or internal field names to the user. Translate everything into natural language.
6. When the user writes in Arabic, respond in Arabic. When in English, respond in English.
7. Keep answers concise (typically 2-6 short paragraphs) unless the user asks for detail.
8. Use bullet points and short headings when the answer has structure. When listing items, prefer numbered or bulleted lists.
9. When the context includes portfolio data, ground your answers in those numbers explicitly.

## Output style
- Arabic: Modern Standard Arabic, professional and clear.
- English: professional, concise business English.
- Currency: use the currency code from context (EGP default). Format with thousand separators.
- Dates: use the format consistent with the user's language.`;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CopilotContext {
  page?: string;
  client?: Record<string, unknown>;
  policy?: Record<string, unknown>;
  policies?: Array<Record<string, unknown>>;
  claims?: Array<Record<string, unknown>>;
  renewals?: Array<Record<string, unknown>>;
  leads?: Array<Record<string, unknown>>;
  insurers?: Array<Record<string, unknown>>;
  tasks?: Array<Record<string, unknown>>;
  finance?: Record<string, unknown>;
  stats?: Record<string, unknown>;
  notes?: string;
}

function buildContextString(ctx?: CopilotContext): string {
  if (!ctx) return '';
  const parts: string[] = [];

  if (ctx.page) parts.push(`Current page/route: ${ctx.page}`);

  if (ctx.client) {
    parts.push(`## Client context (filtered; unverified)\n${JSON.stringify(ctx.client, null, 2)}`);
  }

  if (ctx.policy) {
    parts.push(`## Policy context (filtered; unverified)\n${JSON.stringify(ctx.policy, null, 2)}`);
  }

  if (ctx.policies && ctx.policies.length > 0) {
    parts.push(
      `## Policies portfolio (filtered; unverified; ${ctx.policies.length} items shown)\n` +
        JSON.stringify(ctx.policies.slice(0, 20), null, 2),
    );
  }

  if (ctx.claims && ctx.claims.length > 0) {
    parts.push(
      `## Claims (filtered; unverified; ${ctx.claims.length} items shown)\n` +
        JSON.stringify(ctx.claims.slice(0, 15), null, 2),
    );
  }

  if (ctx.renewals && ctx.renewals.length > 0) {
    parts.push(
      `## Upcoming renewals (filtered; unverified; ${ctx.renewals.length} items shown)\n` +
        JSON.stringify(ctx.renewals.slice(0, 15), null, 2),
    );
  }

  if (ctx.leads && ctx.leads.length > 0) {
    parts.push(
      `## Sales leads (filtered; unverified; ${ctx.leads.length} items shown)\n` +
        JSON.stringify(ctx.leads.slice(0, 15), null, 2),
    );
  }

  if (ctx.insurers && ctx.insurers.length > 0) {
    parts.push(
      `## Insurance companies (filtered; unverified; ${ctx.insurers.length} items shown)\n` +
        JSON.stringify(ctx.insurers.slice(0, 20), null, 2),
    );
  }

  if (ctx.tasks && ctx.tasks.length > 0) {
    parts.push(
      `## Tasks (filtered; unverified; ${ctx.tasks.length} items shown)\n` +
        JSON.stringify(ctx.tasks.slice(0, 15), null, 2),
    );
  }

  if (ctx.finance) {
    parts.push(`## Financial summary (filtered; unverified)\n${JSON.stringify(ctx.finance, null, 2)}`);
  }

  if (ctx.stats) {
    parts.push(`## Portfolio statistics (filtered; unverified)\n${JSON.stringify(ctx.stats, null, 2)}`);
  }

  if (ctx.notes) {
    parts.push(`## Additional notes from user\n${ctx.notes}`);
  }

  if (parts.length === 0) return '';

  return (
    '\n\n# ======== LIVE APPLICATION CONTEXT ========\n' +
    "The following data is the CURRENT, AUTHORITATIVE state of the broker's workspace. " +
    'Use it to answer concretely and specifically. When asked about "the portfolio", ' +
    '"my clients", "the policies", or similar, reference these figures directly. ' +
    'Do NOT echo raw JSON; summarize in natural language with real numbers.\n\n' +
    parts.join('\n\n') +
    '\n\n# ======== END OF CONTEXT ========'
  );
}

async function verifyFirebaseToken(idToken: string): Promise<{ uid: string }> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) throw new Error('INVALID_TOKEN');
  const data = await res.json();
  const user = data?.users?.[0];
  if (!user?.localId) throw new Error('INVALID_TOKEN');
  return { uid: user.localId };
}

function validateMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) throw new Error('INVALID_MESSAGES');
  if (messages.length > 30) throw new Error('TOO_MANY_MESSAGES');
  const clean: ChatMessage[] = [];
  for (const raw of messages) {
    if (!raw || typeof raw !== 'object') throw new Error('INVALID_MESSAGES');
    const role = (raw as { role?: unknown }).role;
    const content = (raw as { content?: unknown }).content;
    if (role !== 'user' && role !== 'assistant') throw new Error('INVALID_MESSAGES');
    if (typeof content !== 'string' || !content.trim()) throw new Error('INVALID_MESSAGES');
    if (content.length > 8000) throw new Error('CONTENT_TOO_LONG');
    clean.push({ role, content: content.trim() });
  }
  if (clean[clean.length - 1].role !== 'user') throw new Error('LAST_MESSAGE_MUST_BE_USER');
  return clean;
}

async function callGemini(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_NOT_CONFIGURED');
  const contents = messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 1500, temperature: 0.3 },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error('Gemini API error', res.status, errText);
    throw new Error(`GEMINI_FAILED:${res.status}`);
  }
  const data = await res.json();
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) throw new Error('GEMINI_EMPTY');
  return String(reply).trim();
}

async function callGroq(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  if (!GROQ_API_KEY) throw new Error('GROQ_NOT_CONFIGURED');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'apikey': GROQ_API_KEY,
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 1500,
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error('Groq API error', res.status, errText);
    throw new Error(`GROQ_FAILED:${res.status}:${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) throw new Error('GROQ_EMPTY');
  return String(reply).trim();
}

async function callAI(
  systemPrompt: string,
  messages: ChatMessage[],
): Promise<{ reply: string; provider: string }> {
  if (GROQ_API_KEY) {
    try {
      const reply = await callGroq(systemPrompt, messages);
      return { reply, provider: `groq:${GROQ_MODEL}` };
    } catch (e) {
      console.warn('Groq failed, falling back to Gemini', e);
    }
  }
  if (GEMINI_API_KEY) {
    try {
      const reply = await callGemini(systemPrompt, messages);
      return { reply, provider: `gemini:${GEMINI_MODEL}` };
    } catch (e) {
      console.error('Gemini also failed', e);
    }
  }
  throw new Error('ALL_PROVIDERS_FAILED');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'METHOD_NOT_ALLOWED' }), {
      status: 405,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }

  try {
    const firebaseToken = req.headers.get('x-firebase-token');
    if (!firebaseToken) throw new Error('MISSING_TOKEN');

    await verifyFirebaseToken(firebaseToken);

    const body = await req.json();
    const messages = validateMessages(body?.messages);
    const context = body?.context as CopilotContext | undefined;

    const systemPrompt = SYSTEM_PROMPT + buildContextString(context);
    const { reply, provider } = await callAI(systemPrompt, messages);

    return new Response(JSON.stringify({ ok: true, reply, model: provider }), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (err) {
    console.error('copilot-chat error', err);
    const message = err instanceof Error ? err.message : 'UNKNOWN';
    const status =
      message === 'INVALID_TOKEN' || message === 'MISSING_TOKEN' ? 401 : 400;
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});