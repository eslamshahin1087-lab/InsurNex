import { MessageSquarePlus, Sparkles } from 'lucide-react';
import { SUGGESTED_PROMPTS } from './copilot-utils';

interface Props {
  onPick: (prompt: string) => void;
  disabled?: boolean;
}

export default function SuggestedPrompts({ onPick, disabled }: Props) {
  return (
    <section style={{ marginTop: 8 }}>
      <div className="inx-section-head" style={{ marginTop: 0 }}>
        <h2>
          <Sparkles size={16} style={{ verticalAlign: 'middle', marginInlineEnd: 6 }} />
          اقتراحات سريعة
        </h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
        }}
      >
        {SUGGESTED_PROMPTS.map((item) => (
          <button
            key={item.label}
            type="button"
            className="inx-card inx-card-hover"
            disabled={disabled}
            onClick={() => onPick(item.prompt)}
            style={{
              textAlign: 'right',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: 14,
              background: 'var(--inx-surface)',
              border: '1px solid var(--inx-border)',
              color: 'var(--inx-text)',
            }}
          >
            <span className="inx-icon-circle inx-icon-circle-sm tone-primary">
              <MessageSquarePlus size={14} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}