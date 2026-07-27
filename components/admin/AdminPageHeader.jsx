'use client';

import { cn } from '@/lib/utils';

export default function AdminPageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
}) {
  return (
    <header
      className={cn(
        'mb-6 flex flex-col gap-3 border-b border-[var(--border-default)] pb-4 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div className="min-w-0 flex-1">
        {breadcrumb ? (
          <nav aria-label="Breadcrumb" className="mb-1 text-xs text-[var(--text-muted)]">
            {breadcrumb}
          </nav>
        ) : null}
        <h1 className="truncate text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm text-[var(--text-secondary)]">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
