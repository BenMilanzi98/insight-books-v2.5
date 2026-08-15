'use client';
import { tt } from '@/lib/i18n/runtime';

import { cn } from '@/lib/utils';
import AdminLoadingState from './AdminLoadingState';
import AdminEmptyState from './AdminEmptyState';

export default function AdminChartCard({
  title,
  description,
  actions,
  loading,
  error,
  empty,
  emptyTitle = 'No data',
  emptyDescription = 'Nothing to chart for this period.',
  onRetry,
  children,
  className,
  heightClass = 'h-72',
  accent = 'sky',
}) {
  const accentBar =
    accent === 'emerald'
      ? 'from-emerald-400 to-teal-500'
      : accent === 'amber'
        ? 'from-amber-400 to-orange-400'
        : accent === 'rose'
          ? 'from-rose-400 to-pink-500'
          : 'from-sky-400 to-cyan-500';

  return (
    <section
      className={cn(
        'admin-lift relative flex min-h-0 flex-col overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-card)] sm:p-5',
        className
      )}
    >
      <div
        className={cn('absolute inset-x-0 top-0 h-1 bg-gradient-to-r', accentBar)}
        aria-hidden
      />
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 pt-1">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--admin-text)]">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-[var(--admin-text-muted)]">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      <div className={cn('relative min-h-0 flex-1', heightClass)}>
        {loading ? (
          <AdminLoadingState label="Loading chart" className="h-full" />
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-[var(--admin-danger)]" role="alert">
              {error}
            </p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="text-sm font-medium text-[var(--admin-accent-strong)] underline"
              >
                {tt('Retry')}
              </button>
            ) : null}
          </div>
        ) : empty ? (
          <AdminEmptyState
            title={emptyTitle}
            description={emptyDescription}
            className="h-full border-0 bg-transparent shadow-none"
          />
        ) : (
          children
        )}
      </div>
    </section>
  );
}
