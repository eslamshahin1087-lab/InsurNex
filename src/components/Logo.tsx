import type { ImgHTMLAttributes } from 'react';

export type LogoVariant = 'lockup' | 'mark' | 'stacked';

type LogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  variant?: LogoVariant;
};

export default function Logo({
  alt = 'InsurNex',
  variant = 'lockup',
  ...rest
}: LogoProps) {
  return (
    <img
      src="/branding/logo-light.png"
      alt={alt}
      data-logo-variant={variant}
      {...rest}
    />
  );
}