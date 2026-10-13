import type { ImgHTMLAttributes } from 'react';
import { useTheme } from '../theme/ThemeProvider';

type LogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>;

export default function Logo({ alt = 'InsurNex', ...rest }: LogoProps) {
  const { resolvedTheme } = useTheme();
  const src =
    resolvedTheme === 'dark'
      ? '/branding/logo-dark.png'
      : '/branding/logo-light.png';
  return <img src={src} alt={alt} {...rest} />;
}
