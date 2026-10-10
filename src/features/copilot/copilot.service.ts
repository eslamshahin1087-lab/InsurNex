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
import { getApp } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../firebase/config';
import type {
  CopilotContextPayload,
  CopilotConversation,
  CopilotMessage,
  CopilotRequestMessage,
  CopilotResponse,
} from './copilot.types';

const REGION = 'europe-west1';
const MAX_HISTORY = 20;

let cachedFunctions: ReturnType<typeof getFunctions> | null = null;

function functionsInstance() {
  if (!cachedFunctions) {
    cachedFunctions = getFunctions(getApp(), REGION);
  }
  return cachedFunctions;
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

export async function deleteConversation(conversationId: string): Promise<void> {
  const msgs = await getDocs(
    query(
      collection(db, 'copilotMessages'),
      where('conversationId', '==', conversationId),
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
): Promise<CopilotMessage[]> {
  const q = query(
    collection(db, 'copilotMessages'),
    where('conversationId', '==', conversationId),
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

// ---------- Claude Call ----------

export async function sendToCopilot(params: {
  history: CopilotRequestMessage[];
  context?: CopilotContextPayload;
}): Promise<CopilotResponse> {
  const fn = httpsCallable<
    { messages: CopilotRequestMessage[]; context?: CopilotContextPayload },
    CopilotResponse
  >(functionsInstance(), 'copilotChat');

  const result = await fn({
    messages: params.history.slice(-MAX_HISTORY),
    context: params.context,
  });

  return result.data;
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

  const response = await sendToCopilot({ history: requestHistory, context });

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