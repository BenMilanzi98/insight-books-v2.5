'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function AdminSummaryCard({
  label,
  value,
  hint,
  href,
  icon: Icon,
  tone = 'neutral',
  error,
  className,
}) {
  const toneBorder =
    tone === 'danger'
      ? 'border-l-[var(--status-danger)]'
      : tone === 'warning'
        ? 'border-l-[var(--status-warning)]'
        : tone === 'success'
          ? 'border-l-[var(--status-success)]'
          : 'border-l-[var(--action-primary)]';

  const body = (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--surface-primary)] p-4 shadow-[var(--shadow-card)] border-l-4',
        toneBorder,
        href && 'transition-colors hover:border-[var(--border-strong)]',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            {label}
          </p>
          {error ? (
            <p className="mt-2 text-sm font-medium text-[var(--status-danger)]" role="alert">
              Unavailable
            </p>
          ) : (
            <p className="mt-2 truncate text-2xl font-semibold tabular-nums text-[var(--text-primary)]">
              {value}
            </p>
          )}
          {hint && !error ? (
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{hint}</p>
          ) : null}
        </div>
        {Icon ? (
          <Icon className="h-5 w-5 shrink-0 text-[var(--text-muted)]" aria-hidden />
        ) : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]">
        {body}
      </Link>
    );
  }
  return body;
}
