import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Bot, CheckCircle2, Loader2, Send, User } from 'lucide-react';
import type {
  ClientWizardInput,
  RiskAssessment,
} from '../client.types';
import { sendToCopilot } from '../../copilot/copilot.service';
import { calculateCompleteness } from '../risk-assessment.service';
import { useAuth } from '../../auth/auth-context';

interface Props {
  clientId: string;
  clientName: string;
  clientCode: string;
  wizardData: ClientWizardInput;
  riskAssessment: RiskAssessment;
  onAnalysisReady: (analysis: {
    summary: string;
    recommendations: string[];
    suggestedProducts: Array<{
      productName: string;
      reason: string;
      estimatedPremium: number;
    }>;
    analyzedAt: unknown;
  }) => void;
  onClose: () => void;
}

interface ChatBubble {
  role: 'user' | 'assistant';
  content: string;
}

export default function AiAnalysisChatBox({
  clientName,
  clientCode,
  wizardData,
  onAnalysisReady,
  onClose,
}: Props) {
  const { profile, user } = useAuth();
  const copilotScope = profile?.organizationId || user?.uid || null;

  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [analyzing, setAnalyzing] = useState(true);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // ============================================================
  // Build the analysis prompt
  // ============================================================
  const analysisPrompt = useMemo(() => {
    const completeness = calculateCompleteness(wizardData);
    const details: string[] = [];
    details.push(`**النوع:** ${wizardData.type === 'individual' ? 'فردي' : 'شركات'}`);
    if (wizardData.type === 'corporate' && wizardData.corporate) {
      const c = wizardData.corporate;
      if (c.primaryActivity) details.push(`**النشاط:** ${c.primaryActivity}`);
      if (c.employeeCount) details.push(`**عدد الموظفين:** ${c.employeeCount}`);
      if (c.sector) details.push(`**القطاع:** ${c.sector}`);
    }

    details.push(
      `**الاحتياجات:** ${wizardData.needs.map(needLabel).join('، ') || 'لم تحدد'}`,
    );
    details.push(`**اكتمال البيانات:** ${completeness}%`);
    details.push(`**عدد المستندات:** ${wizardData.documents.length}`);

    return `ملخص احتياجات تأمينية غير معرّف للعميل. البيانات التالية:

${details.join('\n')}

المطلوب منك:
1. **تحليل سريع**: اكتب ملخصًا قصيرًا (2-3 أسطر) عن هذا العميل واحتياجاته المحتملة.
2. **التوصيات**: اقترح 2-4 منتجات تأمينية مناسبة مع سبب مختصر لكل واحد.
3. **تقدير الأقساط**: إن أمكن، أعط تقديرًا تقريبيًا للقسط السنوي (بالجنيه المصري).

اكتب الرد بالعربية بشكل منظم. لا تستخدم عناوين markdown كبيرة، فقط نص عادي منظّم.`;
  }, [wizardData]);

  // ============================================================
  // Run analysis on mount
  // ============================================================
  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setError('');

    const initialUser: ChatBubble = {
      role: 'user',
      content: 'تحليل احتياجات التأمين للعميل الجديد',
    };
    setMessages([initialUser]);

    try {
      if (!copilotScope) throw new Error('WORKSPACE_ACCESS_DENIED');
      const response = await sendToCopilot({
        organizationId: copilotScope,
        history: [{ role: 'user', content: analysisPrompt }],
      });

      const assistantBubble: ChatBubble = {
        role: 'assistant',
        content: response.reply,
      };
      setMessages([initialUser, assistantBubble]);

      // Extract recommendations (simple split by numbered list)
      const lines = response.reply.split('\n').filter((l) => l.trim());
      const recs = lines
        .filter((l) => /^\d|^[-•]/.test(l.trim()))
        .map((l) => l.replace(/^[\d\-•.\s]+/, '').trim())
        .filter((l) => l.length > 10)
        .slice(0, 5);

      onAnalysisReady({
        summary: response.reply.slice(0, 500),
        recommendations: recs,
        suggestedProducts: [],
        analyzedAt: new Date(),
      });
    } catch {
      setError('تعذر تحليل البيانات. يمكنك طرح أسئلتك يدويًا.');
      setMessages([
        initialUser,
        {
          role: 'assistant',
          content: '⚠️ لم أتمكن من الاتصال بخدمة التحليل. يمكنك سؤالي مباشرة عن احتياجات التأمين.',
        },
      ]);
    } finally {
      setAnalyzing(false);
    }
  }, [analysisPrompt, clientName, onAnalysisReady]);

  useEffect(() => {
    void runAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // Auto-scroll
  // ============================================================
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, sending]);

  // ============================================================
  // Follow-up questions
  // ============================================================
  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setInput('');
    const userBubble: ChatBubble = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userBubble]);
    setSending(true);

    try {
      const history = [...messages, userBubble].map((m) => ({
        role: m.role,
        content: m.content,
      }));
      if (!copilotScope) throw new Error('WORKSPACE_ACCESS_DENIED');
      const response = await sendToCopilot({ organizationId: copilotScope, history });
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '⚠️ تعذر الحصول على الرد. حاول مرة أخرى.',
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="ai-chat-page">
      <header className="ai-chat-head">
        <div className="ai-chat-title">
          <span className="inx-icon-circle tone-success">
            <CheckCircle2 size={18} />
          </span>
          <div>
            <b>✅ تم إنشاء العميل بنجاح</b>
            <small>
              {clientName} — كود: <span style={{ fontFamily: 'monospace' }}>{clientCode}</span>
            </small>
          </div>
        </div>
        <button
          type="button"
          className="inx-btn inx-btn-primary inx-btn-sm"
          onClick={onClose}
        >
          عرض ملف العميل <ArrowRight size={14} />
        </button>
      </header>

      <div className="ai-chat-box" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`chat-bubble bubble-${m.role}`}>
            <span className="bubble-avatar">
              {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </span>
            <div className="bubble-content">
              {m.content.split('\n').map((line, j) => (
                <p key={j}>{line || '\u00A0'}</p>
              ))}
            </div>
          </div>
        ))}

        {analyzing && (
          <div className="chat-bubble bubble-assistant">
            <span className="bubble-avatar">
              <Bot size={14} />
            </span>
            <div className="bubble-content typing-indicator">
              <Loader2 size={16} className="spin" />
              <span>جاري تحليل بيانات العميل...</span>
            </div>
          </div>
        )}

        {error && <div className="ai-chat-error">{error}</div>}
      </div>

      {/* QUICK SUGGESTIONS */}
      {!analyzing && messages.length > 0 && (
        <div className="ai-chat-suggestions">
          <button
            type="button"
            onClick={() => void handleSend('ما أفضل شركة تأمين لهذا العميل؟')}
          >
            أفضل شركة تأمين؟
          </button>
          <button
            type="button"
            onClick={() => void handleSend('قدّر القسط السنوي بدقة أكبر')}
          >
            تقدير القسط
          </button>
          <button
            type="button"
            onClick={() => void handleSend('ما الوثائق الناقصة للعميل؟')}
          >
            الوثائق الناقصة
          </button>
        </div>
      )}

      <div className="ai-chat-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend(input);
            }
          }}
          placeholder="اسأل عن العميل... (Shift+Enter لسطر جديد)"
          rows={1}
          disabled={sending || analyzing}
        />
        <button
          type="button"
          onClick={() => void handleSend(input)}
          disabled={sending || analyzing || !input.trim()}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

function needLabel(need: string): string {
  const map: Record<string, string> = {
    motor: 'سيارات',
    health: 'صحي',
    life: 'حياة',
    property: 'ممتلكات',
    travel: 'سفر',
    business: 'تجاري',
    'professional-liability': 'مسؤولية مهنية',
    equipment: 'معدات',
    cyber: 'سيبراني',
  };
  return map[need] || need;
}