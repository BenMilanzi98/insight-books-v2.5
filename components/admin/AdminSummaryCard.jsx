'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

const TONE_STYLES = {
  neutral: {
    card: 'admin-card-slate',
    border: 'border-l-[var(--admin-accent-strong)]',
    iconWrap: 'bg-sky-100 text-sky-700',
  },
  info: {
    card: 'admin-card-sky',
    border: 'border-l-[var(--admin-info)]',
    iconWrap: 'bg-sky-100 text-sky-700',
  },
  success: {
    card: 'admin-card-emerald',
    border: 'border-l-[var(--admin-success)]',
    iconWrap: 'bg-emerald-100 text-emerald-700',
  },
  warning: {
    card: 'admin-card-amber',
    border: 'border-l-[var(--admin-warning)]',
    iconWrap: 'bg-amber-100 text-amber-800',
  },
  danger: {
    card: 'admin-card-rose',
    border: 'border-l-[var(--admin-danger)]',
    iconWrap: 'bg-rose-100 text-rose-700',
  },
};

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
  const styles = TONE_STYLES[tone] || TONE_STYLES.neutral;

  const body = (
    <div
      className={cn(
        'admin-lift rounded-[var(--admin-radius)] border border-l-4 p-4 shadow-[var(--admin-shadow-card)]',
        styles.card,
        styles.border,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-text-muted)]">
            {label}
          </p>
          {error ? (
            <p className="mt-2 text-sm font-medium text-[var(--admin-danger)]" role="alert">
              Unavailable
            </p>
          ) : (
            <p className="mt-2 break-words text-xl font-bold leading-tight tabular-nums tracking-tight text-[var(--admin-text)] sm:text-2xl">
              {value}
            </p>
          )}
          {hint && !error ? (
            <p className="mt-1 text-xs font-medium text-[var(--admin-text-muted)]">{hint}</p>
          ) : null}
        </div>
        {Icon ? (
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              styles.iconWrap
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </div>
        ) : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block min-w-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-focus-ring)]"
      >
        {body}
      </Link>
    );
  }
  return body;
}
