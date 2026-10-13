import type { ImgHTMLAttributes } from 'react';

type LogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>;

export default function Logo({ alt = 'InsurNex', ...rest }: LogoProps) {
  return <img src="/branding/logo-light.png" alt={alt} {...rest} />;
}
