export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}

export default function MiniDonutChart({
  segments,
  size = 120,
  thickness = 16,
  centerLabel,
  centerValue,
}: Props) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--inx-border)"
          strokeWidth={thickness}
          opacity="0.4"
        />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map((seg, i) => {
            const fraction = seg.value / total;
            const dashArray = `${fraction * circumference} ${circumference}`;
            const dashOffset = -offset * circumference;
            offset += fraction;
            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
              />
            );
          })}
        </g>
      </svg>
      {(centerLabel || centerValue) && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <div>
            {centerValue && (
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--inx-text)' }}>
                {centerValue}
              </div>
            )}
            {centerLabel && (
              <div style={{ fontSize: 11, color: 'var(--inx-muted)', marginTop: 2 }}>
                {centerLabel}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}