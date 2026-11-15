import type { HTMLAttributes } from 'react';

export type LogoVariant = 'lockup' | 'mark' | 'stacked' | 'full';

type LogoProps = Pick<HTMLAttributes<HTMLSpanElement>, 'className' | 'id' | 'style' | 'title'> & {
  alt?: string;
  variant?: LogoVariant;
};

const LOGO_ASSETS = {
  compact: {
    light: '/branding/insurnex-logo-compact.svg',
    dark: '/branding/insurnex-logo-compact-dark.svg',
  },
  full: {
    light: '/branding/insurnex-logo.svg',
    dark: '/branding/insurnex-logo-dark.svg',
  },
};

export default function Logo({
  alt = 'InsurNex',
  variant = 'lockup',
  className,
  ...rest
}: LogoProps) {
  if (variant === 'mark') {
    return (
      <span
        className={`inx-logo-mark ${className ?? ''}`.trim()}
        role="img"
        aria-label={alt}
        {...rest}
      >
        <img className="inx-logo-mark-image" src="/branding/insurnex-mark.svg" alt="" aria-hidden="true" />
      </span>
    );
  }

  const artwork = variant === 'stacked' || variant === 'full' ? LOGO_ASSETS.full : LOGO_ASSETS.compact;
  const logoClassName = [
    'inx-logo-lockup',
    variant === 'stacked' ? 'inx-logo-stacked' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <span
      className={logoClassName}
      data-logo-variant={variant}
      role="img"
      aria-label={alt}
      {...rest}
    >
      <img className="inx-logo-image inx-logo-image-light" src={artwork.light} alt="" aria-hidden="true" />
      <img className="inx-logo-image inx-logo-image-dark" src={artwork.dark} alt="" aria-hidden="true" />
    </span>
  );
}
