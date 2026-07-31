import { cn } from '@/lib/utils';

export default function Card({ children, className, padded = true, as: Comp = 'div', ...props }) {
  return (
    <Comp
      className={cn(
        'rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-primary)] shadow-[var(--shadow-card)]',
        padded && 'p-4 sm:p-5',
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}

export function SummaryCard({ title, value, subtitle, icon, trend, className, actions }) {
  return (
    <Card className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--text-muted)]">{title}</p>
          <p className="mt-1 truncate text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
            {value}
          </p>
          {subtitle ? <p className="mt-1 text-xs text-[var(--text-secondary)]">{subtitle}</p> : null}
          {trend ? <p className="mt-1 text-xs text-[var(--text-muted)]">{trend}</p> : null}
        </div>
        {icon ? <div className="shrink-0 text-[var(--action-primary)]">{icon}</div> : null}
      </div>
      {actions}
    </Card>
  );
}
