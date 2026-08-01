import { cn } from '@/lib/utils';

/**
 * Standard page width wrapper. Presentation only.
 * Default is full width so modules fill the available shell.
 * @param {'default'|'narrow'|'wide'|'full'} [variant]
 */
export default function PageContainer({
  children,
  className,
  variant = 'full',
  as: Comp = 'div',
}) {
  const widths = {
    default: 'max-w-none',
    narrow: 'max-w-3xl',
    wide: 'max-w-none',
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
