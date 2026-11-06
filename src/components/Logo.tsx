import type { HTMLAttributes } from 'react';

export type LogoVariant = 'lockup' | 'mark' | 'stacked';

type LogoProps = Pick<HTMLAttributes<HTMLSpanElement>, 'className' | 'id' | 'style' | 'title'> & {
  alt?: string;
  variant?: LogoVariant;
};

// This transparent PNG is the exact supplied InsurNex artwork already stored in
// public/branding/logo-light.png. It is used in both themes to preserve the
// supplied gold finish without adding a theme-dependent background rectangle.
const BRAND_ARTWORK = '/branding/logo-light.png';
const STACKED_LOGO = BRAND_ARTWORK;

function BrandMark({ label, className = '' }: { label: string; className?: string }) {
  return (
    <span className={`inx-logo-mark ${className}`.trim()} role="img" aria-label={label}>
      <img
        className="inx-logo-mark-artwork"
        src={BRAND_ARTWORK}
        alt=""
        aria-hidden="true"
      />
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
