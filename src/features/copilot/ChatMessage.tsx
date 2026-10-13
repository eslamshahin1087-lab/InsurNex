import { Bot, User } from 'lucide-react';
import { formatMessageTime } from './copilot-utils';
import type { CopilotMessage } from './copilot.types';

interface Props {
  message: CopilotMessage;
}

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user';
  const time = formatMessageTime(message.createdAt);

  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        flexDirection: isUser ? 'row-reverse' : 'row',
        marginBottom: 14,
      }}
    >
      <span
        className={`inx-icon-circle ${isUser ? 'tone-primary' : 'tone-cyan'}`}
        style={{ width: 36, height: 36, flexShrink: 0 }}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </span>

      <div
        style={{
          maxWidth: '78%',
          padding: '12px 14px',
          borderRadius: 'var(--inx-radius, 14px)',
          background: isUser ? 'var(--inx-gradient)' : 'var(--inx-surface)',
          color: isUser ? '#fff' : 'var(--inx-text)',
          border: isUser ? 'none' : '1px solid var(--inx-border)',
          boxShadow: isUser
            ? '0 8px 20px rgba(30, 66, 114, 0.22)'
            : 'var(--inx-shadow-sm)',
          fontSize: 14,
          lineHeight: 1.8,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        <div>{message.content}</div>
        {time && (
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              opacity: isUser ? 0.85 : 0.6,
              textAlign: isUser ? 'left' : 'right',
            }}
          >
            {time}
          </div>
        )}
      </div>
    </div>
  );
}