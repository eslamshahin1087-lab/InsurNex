import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';
import { auth, db } from '../../firebase/config';
import type {
  CopilotContextPayload,
  CopilotConversation,
  CopilotMessage,
  CopilotRequestMessage,
  CopilotResponse,
} from './copilot.types';

const MAX_HISTORY = 20;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined;

let cachedSupabase: ReturnType<typeof createClient> | null = null;
function supabaseInstance() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('SUPABASE_NOT_CONFIGURED');
  }
  if (!cachedSupabase) {
    cachedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return cachedSupabase;
}

// ---------- Conversations ----------

export async function listConversations(
  organizationId: string,
  userId: string,
): Promise<CopilotConversation[]> {
  const q = query(
    collection(db, 'copilotConversations'),
    where('organizationId', '==', organizationId),
    where('userId', '==', userId),
    orderBy('updatedAt', 'desc'),
    limit(50),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CopilotConversation));
}

export async function createConversation(
  organizationId: string,
  userId: string,
  title = 'محادثة جديدة',
): Promise<string> {
  const ref = await addDoc(collection(db, 'copilotConversations'), {
    organizationId,
    userId,
    title,
    lastMessage: '',
    messageCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteConversation(
  conversationId: string,
  organizationId: string,
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('NOT_AUTHENTICATED');
  const msgs = await getDocs(
    query(
      collection(db, 'copilotMessages'),
      where('organizationId', '==', organizationId),
      where('conversationId', '==', conversationId),
      where('userId', '==', currentUser.uid),
    ),
  );
  await Promise.all(msgs.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, 'copilotConversations', conversationId));
}

async function touchConversation(
  conversationId: string,
  lastMessage: string,
): Promise<void> {
  await updateDoc(doc(db, 'copilotConversations', conversationId), {
    lastMessage: lastMessage.slice(0, 120),
    updatedAt: serverTimestamp(),
  });
}

// ---------- Messages ----------

export async function listMessages(
  conversationId: string,
  organizationId: string,
): Promise<CopilotMessage[]> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('NOT_AUTHENTICATED');
  const q = query(
    collection(db, 'copilotMessages'),
    where('organizationId', '==', organizationId),
    where('conversationId', '==', conversationId),
    where('userId', '==', currentUser.uid),
    orderBy('createdAt', 'asc'),
    limit(200),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CopilotMessage));
}

async function saveMessage(params: {
  conversationId: string;
  organizationId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
}): Promise<void> {
  await addDoc(collection(db, 'copilotMessages'), {
    conversationId: params.conversationId,
    organizationId: params.organizationId,
    userId: params.userId,
    role: params.role,
    content: params.content,
    createdAt: serverTimestamp(),
  });
}

// ---------- Copilot Call (Supabase Edge Function) ----------

export async function sendToCopilot(params: {
  organizationId: string;
  history: CopilotRequestMessage[];
  context?: CopilotContextPayload;
}): Promise<CopilotResponse> {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('NOT_AUTHENTICATED');
  const idToken = await currentUser.getIdToken();

  const client = supabaseInstance();
  const { data, error } = await client.functions.invoke('copilot-chat', {
    body: {
      organizationId: params.organizationId,
      messages: params.history.slice(-MAX_HISTORY),
      context: params.context,
    },
    headers: { 'x-firebase-token': idToken },
  });

  if (error) {
    let realMessage = error.message;
    const ctx = (error as { context?: Response }).context;
    if (ctx) {
      try {
        const body = await ctx.clone().json();
        if (body?.error) realMessage = String(body.error);
        if (body?.message) realMessage = String(body.message);
      } catch {
        try {
          const txt = await ctx.clone().text();
          if (txt) realMessage = txt.slice(0, 300);
        } catch {
          /* ignore */
        }
      }
    }
    throw new Error(`COPILOT_GATEWAY_FAILED:${realMessage}`);
  }

  if (!data?.ok) throw new Error(data?.error || 'COPILOT_GATEWAY_REJECTED');

  return {
    reply: String(data.reply || '').trim(),
    model: data.model,
  };
}

// ---------- High-level flow ----------

export async function sendMessage(params: {
  organizationId: string;
  userId: string;
  conversationId: string;
  userText: string;
  history: CopilotMessage[];
  context?: CopilotContextPayload;
}): Promise<CopilotResponse> {
  const { organizationId, userId, conversationId, userText, history, context } = params;

  await saveMessage({
    conversationId,
    organizationId,
    userId,
    role: 'user',
    content: userText,
  });

  const requestHistory: CopilotRequestMessage[] = [
    ...history
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userText },
  ];

  const response = await sendToCopilot({ organizationId, history: requestHistory, context });

  await saveMessage({
    conversationId,
    organizationId,
    userId,
    role: 'assistant',
    content: response.reply,
  });

  await touchConversation(conversationId, response.reply);

  return response;
}