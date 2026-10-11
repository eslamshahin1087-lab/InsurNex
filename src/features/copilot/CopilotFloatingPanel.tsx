import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Maximize2, MessageSquare, Minimize2, Send, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import ChatMessage from './ChatMessage';
import SuggestedPrompts from './SuggestedPrompts';
import {
  createConversation,
  deleteConversation,
  listConversations,
  listMessages,
  sendMessage,
} from './copilot.service';
import { buildTitleFromFirstMessage, canSendMessage } from './copilot-utils';
import type {
  CopilotContextPayload,
  CopilotConversation,
  CopilotMessage,
} from './copilot.types';
import { getCurrentContext } from './copilot-context.store';

interface Props {
  onClose: () => void;
}

export default function CopilotFloatingPanel({ onClose }: Props) {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [minimized, setMinimized] = useState(false);
  const [conversations, setConversations] = useState<CopilotConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Re-read context whenever route changes
  const incomingContext = useMemo<CopilotContextPayload | undefined>(
    () => getCurrentContext(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [location.pathname, activeId],
  );

  // Always create a fresh conversation when panel opens
  useEffect(() => {
    if (!profile?.organizationId || !user?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const id = await createConversation(profile.organizationId, user.uid);
        if (cancelled) return;
        setActiveId(id);

        const rows = await listConversations(profile.organizationId, user.uid);
        if (cancelled) return;
        setConversations(rows);
      } catch (e) {
        console.error('Failed to start fresh conversation', e);
        if (!cancelled) setError('تعذر بدء محادثة جديدة.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.organizationId, user?.uid]);

  // Load messages
  useEffect(() => {
    if (!activeId || !profile?.organizationId) return;
    let cancelled = false;
    setLoadingMsgs(true);
    (async () => {
      try {
        const rows = await listMessages(activeId, profile.organizationId);
        if (!cancelled) setMessages(rows);
      } catch (e) {
        console.error('Failed to load messages', e);
      } finally {
        if (!cancelled) setLoadingMsgs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId, profile?.organizationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending, minimized]);

  useEffect(() => {
    if (!minimized) textareaRef.current?.focus();
  }, [activeId, minimized]);

  const handleNew = useCallback(async () => {
    if (!profile?.organizationId || !user?.uid) return;
    try {
      const id = await createConversation(profile.organizationId, user.uid);
      const rows = await listConversations(profile.organizationId, user.uid);
      setConversations(rows);
      setActiveId(id);
      setMessages([]);
      setError('');
    } catch (e) {
      console.error(e);
      setError('تعذر إنشاء محادثة جديدة.');
    }
  }, [profile?.organizationId, user?.uid]);

  async function submitText(text: string) {
    if (!profile?.organizationId || !user?.uid) return;
    if (!canSendMessage(text) || sending || !activeId) return;

    setSending(true);
    setError('');
    const previousHistory = messages;
    const userText = text.trim();
    setInput('');

    const optimistic: CopilotMessage = {
      id: `local-${Date.now()}`,
      conversationId: activeId,
      organizationId: profile.organizationId,
      userId: user.uid,
      role: 'user',
      content: userText,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const latestContext = getCurrentContext() ?? incomingContext;

      const response = await sendMessage({
        organizationId: profile.organizationId,
        userId: user.uid,
        conversationId: activeId,
        userText,
        history: previousHistory,
        context: latestContext,
      });

      const fresh = await listMessages(activeId, profile.organizationId);
      setMessages(fresh);

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
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
    } catch (e) {
      console.error('Floating copilot failed', e);
      setError('تعذر الاتصال بالمساعد. حاول مرة أخرى.');
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

  async function handleDeleteCurrent() {
    if (!activeId || !profile?.organizationId) return;
    if (!window.confirm('حذف هذه المحادثة؟')) return;
    try {
      await deleteConversation(activeId, profile.organizationId);
      setActiveId(null);
      setMessages([]);
      await handleNew();
    } catch (e) {
      console.error(e);
    }
  }

  // Portal target
  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  if (!portalTarget) return null;

  // Minimized view
  if (minimized) {
    return createPortal(
      <button
        type="button"
        className="copilot-floating-minimized"
        onClick={() => setMinimized(false)}
        aria-label="فتح المساعد الذكي"
      >
        <Bot size={20} />
        <span>المساعد الذكي</span>
        <Maximize2 size={14} />
      </button>,
      portalTarget,
    );
  }

  // Full panel
  return createPortal(
    <div className="copilot-floating" dir="rtl">
      <header className="copilot-floating-head">
        <div className="title">
          <span className="inx-icon-circle tone-cyan" style={{ width: 32, height: 32 }}>
            <Bot size={16} />
          </span>
          <div>
            <strong>InsurNex AI</strong>
            <small>
              {incomingContext?.page
                ? `السياق: ${incomingContext.page}`
                : 'مساعدك الذكي'}
            </small>
          </div>
        </div>
        <div className="actions">
          <button type="button" onClick={handleNew} title="محادثة جديدة">
            +
          </button>
          <button
            type="button"
            onClick={() => navigate('/copilot')}
            title="فتح الصفحة الكاملة"
          >
            <MessageSquare size={14} />
          </button>
          <button
            type="button"
            onClick={() => setMinimized(true)}
            title="تصغير"
          >
            <Minimize2 size={14} />
          </button>
          <button type="button" onClick={onClose} title="إغلاق">
            <X size={14} />
          </button>
        </div>
      </header>

      <div className="copilot-floating-messages">
        {error && <div className="copilot-error">{error}</div>}

        {messages.length === 0 && !loadingMsgs && (
          <div className="copilot-empty" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15 }}>كيف يمكنني مساعدتك؟</h3>
            <p style={{ fontSize: 12 }}>اسألني عن أي شيء في هذه الصفحة.</p>
          </div>
        )}

        {loadingMsgs && messages.length === 0 && (
          <div className="copilot-empty" style={{ padding: 20 }}>
            جاري التحميل...
          </div>
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
        <div style={{ padding: '0 12px' }}>
          <SuggestedPrompts
            onPick={(prompt) => void submitText(prompt)}
            disabled={sending}
          />
        </div>
      )}

      <div className="copilot-floating-input">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="اكتب سؤالك..."
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
          <Send size={16} />
        </button>
      </div>

      {conversations.length > 1 && (
        <div className="copilot-floating-footer">
          <span>{conversations.length} محادثة</span>
          <button type="button" onClick={() => void handleDeleteCurrent()}>
            حذف الحالية
          </button>
        </div>
      )}
    </div>,
    portalTarget,
  );
}