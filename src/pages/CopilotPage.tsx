import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, MessageSquare, Send } from 'lucide-react';
import { useAuth } from '../features/auth/auth-context';
import ChatMessage from '../features/copilot/ChatMessage';
import ConversationSidebar from '../features/copilot/ConversationSidebar';
import SuggestedPrompts from '../features/copilot/SuggestedPrompts';
import {
  createConversation,
  deleteConversation,
  listConversations,
  listMessages,
  sendMessage,
} from '../features/copilot/copilot.service';
import {
  buildTitleFromFirstMessage,
  canSendMessage,
} from '../features/copilot/copilot-utils';
import type { CopilotConversation, CopilotMessage } from '../features/copilot/copilot.types';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import '../theme/copilot.css';

export default function CopilotPage() {
  const { profile, user } = useAuth();
  const [conversations, setConversations] = useState<CopilotConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId],
  );

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!profile?.organizationId || !user?.uid) {
      setLoadingConvs(false);
      return;
    }
    setLoadingConvs(true);
    try {
      const rows = await listConversations(profile.organizationId, user.uid);
      setConversations(rows);
    } catch (e) {
      console.error('Failed to load conversations', e);
      setError('تعذر تحميل المحادثات.');
    } finally {
      setLoadingConvs(false);
    }
  }, [profile?.organizationId, user?.uid]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeId || !profile?.organizationId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMsgs(true);
    (async () => {
      try {
        const rows = await listMessages(activeId, profile.organizationId);
        if (!cancelled) setMessages(rows);
      } catch (e) {
        console.error('Failed to load messages', e);
        if (!cancelled) setError('تعذر تحميل الرسائل.');
      } finally {
        if (!cancelled) setLoadingMsgs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId, profile?.organizationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  // Focus textarea
  useEffect(() => {
    textareaRef.current?.focus();
  }, [activeId]);

  async function handleNew() {
    if (!profile?.organizationId || !user?.uid) return;
    try {
      const id = await createConversation(profile.organizationId, user.uid);
      setActiveId(id);
      setMessages([]);
      setError('');
      await loadConversations();
    } catch (e) {
      console.error(e);
      setError('تعذر إنشاء محادثة جديدة.');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteConversation(id);
      if (id === activeId) {
        setActiveId(null);
        setMessages([]);
      }
      await loadConversations();
    } catch (e) {
      console.error(e);
      setError('تعذر حذف المحادثة.');
    }
  }

  async function submitText(text: string) {
    if (!profile?.organizationId || !user?.uid) return;
    if (!canSendMessage(text) || sending) return;

    let conversationId = activeId;
    if (!conversationId) {
      try {
        conversationId = await createConversation(
          profile.organizationId,
          user.uid,
          buildTitleFromFirstMessage(text),
        );
        setActiveId(conversationId);
      } catch (e) {
        console.error(e);
        setError('تعذر بدء محادثة جديدة.');
        return;
      }
    }

    setSending(true);
    setError('');
    const previousHistory = messages;
    const userText = text.trim();
    setInput('');

    const optimistic: CopilotMessage = {
      id: `local-${Date.now()}`,
      conversationId,
      organizationId: profile.organizationId,
      userId: user.uid,
      role: 'user',
      content: userText,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const response = await sendMessage({
        organizationId: profile.organizationId,
        userId: user.uid,
        conversationId,
        userText,
        history: previousHistory,
      });

      const fresh = await listMessages(conversationId, profile.organizationId);
      setMessages(fresh);

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                lastMessage: response.reply.slice(0, 120),
                title:
                  c.title === 'محادثة جديدة'
                    ? buildTitleFromFirstMessage(userText)
                    : c.title,
              }
            : c,
        ),
      );

      if (activeConversation?.title === 'محادثة جديدة' || !activeConversation) {
        try {
          await updateDoc(doc(db, 'copilotConversations', conversationId), {
            title: buildTitleFromFirstMessage(userText),
          });
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      console.error('Copilot request failed', e);
      setError('تعذر الاتصال بالمساعد الذكي. حاول مرة أخرى.');
      setMessages(previousHistory);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submitText(input);
    }
  }

  return (
    <main className="mobile-page copilot-page" dir="rtl">
      <ConversationSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={handleNew}
        onDelete={handleDelete}
        loading={loadingConvs}
      />

      <section className="copilot-chat">
        <header className="copilot-chat-head">
          <div className="title">
            <span className="inx-icon-circle tone-cyan">
              <Bot size={18} />
            </span>
            <div>
              <h2>InsurNex AI Copilot</h2>
              <small>
                {activeConversation?.title || 'مساعدك الذكي داخل المنصة'}
              </small>
            </div>
          </div>
        </header>

        <div className="copilot-messages">
          {error && <div className="copilot-error">{error}</div>}

          {messages.length === 0 && !loadingMsgs && (
            <div className="copilot-empty">
              <span className="inx-icon-circle inx-icon-circle-lg tone-primary">
                <MessageSquare size={22} />
              </span>
              <h3>كيف يمكنني مساعدتك؟</h3>
              <p>
                اسألني عن عملائك، وثائقك، مطالباتك، أو أي مفهوم تأميني.
                سأجيبك بناءً على السياق المتاح.
              </p>
            </div>
          )}

          {loadingMsgs && messages.length === 0 && (
            <div className="copilot-empty">جاري التحميل...</div>
          )}

          {messages.map((m) => (
            <ChatMessage key={m.id} message={m} />
          ))}

          {sending && (
            <div className="copilot-typing">
              <span />
              <span />
              <span />
              المساعد يفكر...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {messages.length === 0 && !loadingMsgs && (
          <div style={{ padding: '0 16px' }}>
            <SuggestedPrompts
              onPick={(prompt) => void submitText(prompt)}
              disabled={sending}
            />
          </div>
        )}

        <div className="copilot-input">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب سؤالك هنا... (Shift+Enter لسطر جديد)"
            rows={1}
            disabled={sending}
          />
          <button
            type="button"
            className="copilot-send"
            disabled={sending || !canSendMessage(input)}
            onClick={() => void submitText(input)}
            aria-label="إرسال"
          >
            <Send size={18} />
          </button>
        </div>
      </section>
    </main>
  );
}