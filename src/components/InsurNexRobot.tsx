import { useId } from 'react';

interface Props {
  size?: number;
  className?: string;
}

export default function InsurNexRobot({ size = 88, className = '' }: Props) {
  const svgId = useId().replaceAll(':', '');
  return (
    <svg
      className={`inx-robot ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${svgId}-shell`} x1="20" y1="18" x2="96" y2="108" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F7FCFF" />
          <stop offset=".52" stopColor="#CBE7FF" />
          <stop offset="1" stopColor="#72B8FF" />
        </linearGradient>
        <linearGradient id={`${svgId}-face`} x1="34" y1="36" x2="88" y2="79" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0A2A57" />
          <stop offset="1" stopColor="#071A37" />
        </linearGradient>
        <linearGradient id={`${svgId}-eye`} x1="43" y1="50" x2="77" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#75F2FF" />
          <stop offset="1" stopColor="#17A8FF" />
        </linearGradient>
        <filter id={`${svgId}-glow`} x="34" y="42" width="52" height="34" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <path d="M59.8 9.5v10" stroke="#168EFF" strokeWidth="4" strokeLinecap="round" />
      <circle className="inx-robot-beacon" cx="60" cy="8" r="5" fill="#32D6FF" />
      <rect x="16" y="40" width="12" height="28" rx="6" fill="#1678DF" />
      <rect x="92" y="40" width="12" height="28" rx="6" fill="#1678DF" />
      <path d="M28 34c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v35c0 14.9-12.1 27-27 27H55c-14.9 0-27-12.1-27-27V34Z" fill={`url(#${svgId}-shell)`} stroke="#EAF7FF" strokeWidth="3" />
      <path d="M36 39c0-5 4-9 9-9h30c5 0 9 4 9 9v25c0 10.5-8.5 19-19 19h-10c-10.5 0-19-8.5-19-19V39Z" fill={`url(#${svgId}-face)`} />
      <ellipse cx="48" cy="56" rx="6.5" ry="8" fill="#36D8FF" opacity=".48" filter={`url(#${svgId}-glow)`} />
      <ellipse cx="72" cy="56" rx="6.5" ry="8" fill="#36D8FF" opacity=".48" filter={`url(#${svgId}-glow)`} />
      <path d="M48 51v9m24-9v9" stroke={`url(#${svgId}-eye)`} strokeWidth="5" strokeLinecap="round" />
      <path d="M52 72c2.1 2.1 4.7 3.2 8 3.2s5.9-1.1 8-3.2" stroke="#73D8FF" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M42 98c3.8-4.2 9.2-6.5 15-6.5h6c5.8 0 11.2 2.3 15 6.5l7 8H35l7-8Z" fill="url(#inx-robot-shell)" />
      <path d="m60 96 8 3-2.5 9h-11L52 99l8-3Z" fill="#1376E8" />
      <path d="m60 98 4.8 1.8-1.5 5.2h-6.6l-1.5-5.2L60 98Z" fill="#EAF7FF" />
      <circle cx="24" cy="54" r="2" fill="#7DEBFF" />
      <circle cx="96" cy="54" r="2" fill="#7DEBFF" />
    </svg>
  );
}
