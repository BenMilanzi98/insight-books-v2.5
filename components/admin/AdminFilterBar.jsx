'use client';

import { useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Search + filter slot. On small screens, extra filters open in a panel.
 */
export default function AdminFilterBar({
  search = '',
  onSearchChange,
  searchPlaceholder = 'Search…',
  children,
  actions,
  className,
}) {
  const [open, setOpen] = useState(false);
  const hasFilters = Boolean(children);

  return (
    <div
      className={cn(
        'mb-4 rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 sm:p-4',
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {typeof onSearchChange === 'function' ? (
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-text-muted)]"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-11 w-full rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-white py-2 pl-9 pr-3 text-sm text-[var(--admin-text)] placeholder:text-[var(--admin-text-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-focus-ring)]"
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {hasFilters ? (
            <button
              type="button"
              className="inline-flex h-11 items-center gap-2 rounded-[var(--admin-radius)] border border-[var(--admin-border)] px-3 text-sm font-medium text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)] md:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
            >
              {open ? <X className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4" />}
              Filters
            </button>
          ) : null}
          {actions}
        </div>
      </div>

      {hasFilters ? (
        <div
          className={cn(
            'mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4',
            open ? 'grid' : 'hidden md:grid'
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
