interface Props {
  data: number[];
  height?: number;
  color?: string;
  fillColor?: string;
}

export default function MiniLineChart({
  data,
  height = 60,
  color = 'var(--inx-blue)',
  fillColor,
}: Props) {
  if (!data.length) return null;

  const W = 100;
  const H = height;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = data.length > 1 ? W / (data.length - 1) : 0;

  const points = data
    .map((v, i) => {
      const x = i * step;
      const y = H - ((v - min) / range) * (H - 8) - 4;
      return `${x},${y}`;
    })
    .join(' ');

  const fillPoints = `0,${H} ${points} ${W},${H}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: `${H}px`, display: 'block' }}
    >
      {fillColor && <polygon points={fillPoints} fill={fillColor} />}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}