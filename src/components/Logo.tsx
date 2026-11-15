import { useId, type HTMLAttributes } from 'react';

export type LogoVariant = 'lockup' | 'mark' | 'stacked';

type LogoProps = Pick<HTMLAttributes<HTMLSpanElement>, 'className' | 'id' | 'style' | 'title'> & {
  alt?: string;
  variant?: LogoVariant;
};

function BrandMark({ label, className = '' }: { label?: string; className?: string }) {
  const gradientId = `inx-mark-${useId().replace(/:/g, '')}`;

  return (
    <span
      className={`inx-logo-mark ${className}`.trim()}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="6" y1="5" x2="40" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#19A9F8" />
            <stop offset="1" stopColor="#126CF3" />
          </linearGradient>
        </defs>
        <path
          d="M24 3.5 42 11v11.4c0 11.3-7.2 18.5-18 22.1C13.2 40.9 6 33.7 6 22.4V11l18-7.5Z"
          fill={`url(#${gradientId})`}
        />
        <path
          d="M15.2 15.1h4.4l9.2 11.8V15.1h4v18h-4.1l-9.5-12.2v12.2h-4v-18Z"
          fill="white"
          fillRule="evenodd"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

function Wordmark() {
  return (
    <span className="inx-logo-wordmark" aria-hidden="true">
      Insur<span>Nex</span>
    </span>
  );
}

export default function Logo({
  alt = 'InsurNex',
  variant = 'lockup',
  className,
  ...rest
}: LogoProps) {
  if (variant === 'mark') {
    return <BrandMark label={alt} className={className} />;
  }

  return (
    <span
      className={`inx-logo-lockup ${variant === 'stacked' ? 'inx-logo-stacked' : ''} ${className ?? ''}`.trim()}
      data-logo-variant={variant}
      role="img"
      aria-label={alt}
      {...rest}
    >
      <BrandMark className="inx-logo-symbol" />
      <Wordmark />
    </span>
  );
}

