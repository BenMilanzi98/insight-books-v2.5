import { cn } from '@/lib/utils';

/**
 * Standard page header: title, description, actions.
 * Does not change routes or permissions — callers pass actions.
 */
export default function PageHeader({
  title,
  description,
  breadcrumb,
  status,
  actions,
  className,
  children,
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
          <div className="mb-1 text-sm text-[var(--text-muted)]">{breadcrumb}</div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">
            {title}
          </h1>
          {status}
        </div>
        {description ? (
          <p className="mt-1 max-w-3xl text-sm text-[var(--text-secondary)]">{description}</p>
        ) : null}
        {children}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
