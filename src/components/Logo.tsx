import type { ImgHTMLAttributes } from 'react';

export type LogoVariant = 'lockup' | 'mark' | 'stacked';

type LogoProps = Pick<ImgHTMLAttributes<HTMLImageElement>, 'className' | 'id' | 'style' | 'title'> & {
  alt?: string;
  variant?: LogoVariant;
};

const HORIZONTAL_LOGO = '/branding/insurnex-brand-horizontal.webp';
const BRAND_MARK = '/branding/insurnex-brand-mark.webp';
const STACKED_LOGO = '/branding/logo-light.png';

export default function Logo({
  alt = 'InsurNex',
  variant = 'lockup',
  className,
  ...rest
}: LogoProps) {
  const source =
    variant === 'stacked'
      ? STACKED_LOGO
      : variant === 'mark'
        ? BRAND_MARK
        : HORIZONTAL_LOGO;

  const variantClass =
    variant === 'stacked'
      ? 'inx-logo-stacked'
      : variant === 'mark'
        ? 'inx-logo-mark'
        : 'inx-logo-lockup';

  return (
    <img
      src={source}
      alt={alt}
      data-logo-variant={variant}
      className={`${variantClass} ${className ?? ''}`.trim()}
      decoding="async"
      {...rest}
    />
  );
}
