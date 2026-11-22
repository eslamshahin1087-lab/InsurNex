import type { LucideIcon } from 'lucide-react';

type CopperIconProps = {
  Icon: LucideIcon;
  size?: number;
  className?: string;
  strokeWidth?: number;
  'aria-hidden'?: boolean;
};

/** Consistent copper treatment for InsurNex navigation and shortcut icons. */
export default function CopperIcon({
  Icon,
  size = 20,
  className,
  strokeWidth = 1.9,
  'aria-hidden': ariaHidden = true,
}: CopperIconProps) {
  return (
    <span className={['inx-copper-icon', className].filter(Boolean).join(' ')}>
      <Icon size={size} strokeWidth={strokeWidth} aria-hidden={ariaHidden} />
    </span>
  );
}
