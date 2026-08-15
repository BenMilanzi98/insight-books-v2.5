'use client';
import { tt } from '@/lib/i18n/runtime';

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
        'mb-6 flex flex-col gap-3 border-b border-[var(--admin-border)] pb-5 sm:flex-row sm:items-start sm:justify-between',
        className
      )}
    >
      <div className="min-w-0 flex-1">
        {breadcrumb ? (
          <nav aria-label={tt('Breadcrumb')} className="mb-1 text-xs text-[var(--admin-text-muted)]">
            {breadcrumb}
          </nav>
        ) : null}
        <div className="mb-2 h-1.5 w-16 rounded-full bg-gradient-to-r from-sky-500 via-emerald-400 to-amber-400" />
        <h1 className="admin-page-title-accent truncate text-xl font-bold tracking-tight sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-sm text-[var(--admin-text-muted)]">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
