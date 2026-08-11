'use client';

import { cn } from '@/lib/utils';

/**
 * Canonical tenant summary / KPI card (invoice visual language).
 * Static (div) or interactive (button) — same chrome either way.
 */
export default function StatCard({
  label,
  value,
  count,
  countLabel,
  helper,
  icon: Icon,
  active = false,
  onClick,
  title,
  className,
  valueClassName,
  iconWrapClassName,
  barClassName = 'from-[var(--brand-blue-light)] via-[var(--brand-blue)] to-[var(--brand-blue-dark)]',
  interactive = false,
  children,
}) {
  const isInteractive = Boolean(interactive);
  const Comp = isInteractive ? 'button' : 'div';
  const hint = active ? 'Click again to clear' : 'Click to open';

  const hasMeta = count != null || countLabel || helper || children;

  const meta = hasMeta ? (
      <div className="mt-2 text-xs text-gray-500">
        {count != null ? (
          <span>
            <span className="font-semibold text-gray-700">{count}</span>
            {countLabel ? ` ${countLabel}` : ''}
          </span>
        ) : countLabel && !helper ? (
          <span>{countLabel}</span>
        ) : null}
        {helper ? <p className="mt-1 text-xs text-gray-500">{helper}</p> : null}
        {children}
        {isInteractive ? (
          <span className="mt-1 block text-[11px] text-gray-400">{hint}</span>
        ) : null}
      </div>
    ) : isInteractive ? (
      <span className="mt-2 block text-[11px] text-gray-400">{hint}</span>
    ) : null;

  return (
    <Comp
      type={isInteractive ? 'button' : undefined}
      onClick={isInteractive ? onClick : undefined}
      aria-pressed={isInteractive ? active : undefined}
      title={
        title ||
        (isInteractive
          ? active
            ? `Clear ${label} filter`
            : `Show ${label}`
          : undefined)
      }
      className={cn(
        'group relative w-full rounded-2xl border border-white/50 bg-white/80 text-left shadow-lg backdrop-blur-sm transition-all duration-300',
        isInteractive &&
          'hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color)]',
        isInteractive && active && 'ring-2 ring-[var(--primary-color)] ring-offset-2',
        className
      )}
    >
      <div
        className={cn(
          'absolute left-0 top-0 h-1 w-full overflow-hidden rounded-t-2xl bg-gradient-to-r',
          barClassName
        )}
      />
      <div className="flex items-start justify-between gap-3 p-5 sm:p-6">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-600 sm:text-sm">
              {label}
            </p>
            {isInteractive && active ? (
              <span className="shrink-0 rounded-full bg-[var(--admin-accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--primary-color)]">
                Active
              </span>
            ) : null}
          </div>
          <div
            className={cn(
              'min-w-0 break-words text-xl font-bold leading-tight text-gray-900 sm:text-2xl lg:text-3xl tabular-nums',
              valueClassName
            )}
            title={typeof value === 'string' || typeof value === 'number' ? String(value) : undefined}
          >
            {value}
          </div>
          {meta}
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
    </Comp>
  );
}
