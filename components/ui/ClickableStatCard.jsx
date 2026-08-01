'use client';

import { cn } from '@/lib/utils';

/**
 * Shared clickable KPI / summary card (expenses-style).
 * Use for module landing stats that filter a list or navigate to what they represent.
 */
export default function ClickableStatCard({
  label,
  value,
  count,
  countLabel,
  icon: Icon,
  active = false,
  onClick,
  title,
  className,
  valueClassName,
  iconWrapClassName,
  barClassName = 'from-[var(--brand-blue-light)] via-[var(--brand-blue)] to-[var(--brand-blue-dark)]',
  children,
}) {
  const hint = active
    ? 'Click again to clear'
    : 'Click to open';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title || (active ? `Clear ${label} filter` : `Show ${label}`)}
      className={cn(
        'group relative w-full overflow-hidden rounded-2xl border border-white/50 bg-white/80 text-left shadow-lg backdrop-blur-sm transition-all duration-300',
        'hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color)]',
        active && 'ring-2 ring-[var(--primary-color)] ring-offset-2',
        className
      )}
    >
      <div className={cn('absolute left-0 top-0 h-1 w-full bg-gradient-to-r', barClassName)} />
      <div className="flex items-start justify-between gap-3 p-5 sm:p-6">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-600 sm:text-sm">
              {label}
            </p>
            {active ? (
              <span className="shrink-0 rounded-full bg-[var(--admin-accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--primary-color)]">
                Active
              </span>
            ) : null}
          </div>
          <p
            className={cn(
              'truncate text-2xl font-bold text-gray-900 sm:text-3xl',
              valueClassName
            )}
            title={typeof value === 'string' || typeof value === 'number' ? String(value) : undefined}
          >
            {value}
          </p>
          {(count != null || countLabel || children) && (
            <div className="mt-2 text-xs text-gray-500">
              {count != null ? (
                <span>
                  <span className="font-semibold text-gray-700">{count}</span>
                  {countLabel ? ` ${countLabel}` : ''}
                </span>
              ) : null}
              {children}
              <span className="mt-1 block text-[11px] text-gray-400">{hint}</span>
            </div>
          )}
          {count == null && !countLabel && !children ? (
            <span className="mt-2 block text-[11px] text-gray-400">{hint}</span>
          ) : null}
        </div>
        {Icon ? (
          <div
            className={cn(
              'shrink-0 rounded-xl bg-[var(--admin-accent-soft)] p-3 text-[var(--primary-color)]',
              iconWrapClassName
            )}
          >
            <Icon size={24} aria-hidden />
          </div>
        ) : null}
      </div>
    </button>
  );
}
