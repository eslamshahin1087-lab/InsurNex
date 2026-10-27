import type { ImgHTMLAttributes } from 'react';
import { useTheme } from '../theme/ThemeProvider';

export type LogoVariant = 'lockup' | 'mark' | 'stacked';

type LogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  variant?: LogoVariant;
};

export default function Logo({
  alt = 'InsurNex',
  variant = 'lockup',
  ...rest
}: LogoProps) {
  const { resolvedTheme } = useTheme();
  const suffix = resolvedTheme === 'dark' ? 'dark' : 'light';
  const src =
    variant === 'mark'
      ? `/branding/insurnex-mark-${suffix}.svg`
      : variant === 'stacked'
        ? suffix === 'dark'
          ? '/branding/insurnex-brand-dark.svg'
          : '/branding/insurnex-brand.svg'
        : `/branding/logo-${suffix}.svg`;

  return <img src={src} alt={alt} data-logo-variant={variant} {...rest} />;
}
