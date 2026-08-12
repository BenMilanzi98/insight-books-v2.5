import { cn } from '@/lib/utils';

/**
 * POS-matched glass content panel with optional top accent bar.
 * @param {'default'|'green'|'rose'|'blue'|'purple'|false} [accent]
 */
export default function PosStylePanel({
  children,
  className,
  accent = 'default',
  as: Comp = 'div',
}) {
  const accentClass =
    accent === false
      ? ''
      : accent === 'green'
        ? 'tenant-glass-card--accent-green'
        : accent === 'rose'
          ? 'tenant-glass-card--accent-rose'
          : 'tenant-glass-card--accent';

  return (
    <Comp className={cn('tenant-glass-card', accentClass, className)}>
      {children}
    </Comp>
  );
}
