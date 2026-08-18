'use client';
import { tt } from '@/lib/i18n/runtime';

import { cn } from '@/lib/utils';

export default function AdminEmptyState({
  title = tt('No results'),
  description,
  action,
  className,
  icon: Icon,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-default)] bg-[var(--surface-muted)] px-6 py-12 text-center',
        className
      )}
      role="status"
    >
      {Icon ? (
        <Icon className="mb-3 h-10 w-10 text-[var(--text-muted)]" aria-hidden />
      ) : null}
      <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-[var(--text-secondary)]">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
