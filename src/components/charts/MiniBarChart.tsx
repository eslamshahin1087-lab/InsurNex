interface Props {
  data: number[];
  height?: number;
  color?: string;
  labels?: string[];
}

export default function MiniBarChart({
  data,
  height = 60,
  color = 'var(--inx-blue)',
  labels,
}: Props) {
  if (!data.length) return null;

  const max = Math.max(...data, 1);
  const W = 100;
  const barWidth = W / data.length;
  const gap = 2;

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: `${height}px`, display: 'block' }}
    >
      {data.map((v, i) => {
        const h = (v / max) * (height - 4);
        return (
          <rect
            key={i}
            x={i * barWidth + gap / 2}
            y={height - h - 2}
            width={barWidth - gap}
            height={h}
            rx="1.5"
            fill={color}
          >
            {labels?.[i] && <title>{labels[i]}</title>}
          </rect>
        );
      })}
    </svg>
  );
}