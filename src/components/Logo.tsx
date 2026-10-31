import type { HTMLAttributes } from 'react';

export type LogoVariant = 'lockup' | 'mark' | 'stacked';

type LogoProps = Pick<HTMLAttributes<HTMLSpanElement>, 'className' | 'id' | 'style' | 'title'> & {
  alt?: string;
  variant?: LogoVariant;
};

const MARK_LIGHT = '/branding/insurnex-mark-light.svg';
const MARK_DARK = '/branding/insurnex-mark-dark.svg';
const STACKED_LOGO = '/branding/logo-light.png';

function BrandMark({ label, className = '' }: { label: string; className?: string }) {
  return (
    <span className={`inx-logo-mark ${className}`.trim()} role="img" aria-label={label}>
      <img className="inx-logo-mark-light" src={MARK_LIGHT} alt="" aria-hidden="true" />
      <img className="inx-logo-mark-dark" src={MARK_DARK} alt="" aria-hidden="true" />
    </span>
  );
}

export default function Logo({
  alt = 'InsurNex',
  variant = 'lockup',
  className,
  ...rest
}: LogoProps) {
  if (variant === 'stacked') {
    return (
      <img
        src={STACKED_LOGO}
        alt={alt}
        data-logo-variant={variant}
        className={className}
        {...rest}
      />
    );
  }

  if (variant === 'mark') {
    return <BrandMark label={alt} className={className} />;
  }

  return (
    <span className={`inx-logo-lockup ${className ?? ''}`.trim()} data-logo-variant={variant} role="img" aria-label={alt} {...rest}>
      <BrandMark label="" className="inx-logo-symbol" />
      <span className="inx-logo-wordmark" aria-hidden="true">
        Insur<span>Nex</span>
      </span>
    </span>
  );
}
