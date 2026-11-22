import type { LucideIcon } from 'lucide-react';

type CopperIconProps = {
  Icon: LucideIcon;
  asset?: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
  'aria-hidden'?: boolean;
};

/** Copper icon image with a Lucide fallback for unassigned assets. */
export default function CopperIcon({
  Icon,
  asset,
  size = 20,
  className,
  strokeWidth = 1.9,
  'aria-hidden': ariaHidden = true,
}: CopperIconProps) {
  return (
    <span className={['inx-copper-icon', className].filter(Boolean).join(' ')}>
      {asset ? (
        <img
          src={`/insurnex-copper-icons/${asset}`}
          width={size}
          height={size}
          alt=""
          aria-hidden={ariaHidden}
          style={{ display: 'block', width: size, height: size, objectFit: 'contain' }}
        />
      ) : (
        <Icon size={size} strokeWidth={strokeWidth} aria-hidden={ariaHidden} />
      )}
    </span>
  );
}
