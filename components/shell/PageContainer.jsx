import { cn } from '@/lib/utils';

/**
 * Standard page width wrapper. Presentation only.
 * @param {'default'|'narrow'|'wide'|'full'} [variant]
 */
export default function PageContainer({
  children,
  className,
  variant = 'default',
  as: Comp = 'div',
}) {
  const widths = {
    default: 'max-w-7xl',
    narrow: 'max-w-3xl',
    wide: 'max-w-[90rem]',
    full: 'max-w-none',
  };
  return (
    <Comp
      className={cn(
        // Shell main already provides page padding — avoid double gutters.
        'mx-auto w-full',
        widths[variant] || widths.default,
        className
      )}
    >
      {children}
    </Comp>
  );
}
