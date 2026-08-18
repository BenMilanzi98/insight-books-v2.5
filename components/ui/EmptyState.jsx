'use client';

import { tx } from '@/lib/i18n/runtime';
import { cn } from '@/lib/utils';
import Button from './Button';

export default function EmptyState({
  icon,
  title = {tt('Nothing here yet')},
  description,
  actionLabel,
  onAction,
  actionHref,
  className,
  children,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] px-4 py-10 text-center',
        className
      )}
    >
      {icon ? <div className="mb-3 text-[var(--text-muted)]">{icon}</div> : null}
      <h3 className="text-base font-semibold text-[var(--text-primary)]">{tx(title)}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-[var(--text-secondary)]">{tx(description)}</p>
      ) : null}
      {children}
      {actionLabel && (onAction || actionHref) ? (
        <div className="mt-4">
          {actionHref ? (
            <a href={actionHref} className="inline-flex">
              <Button type="button">{tx(actionLabel)}</Button>
            </a>
          ) : (
            <Button type="button" onClick={onAction}>
              {tx(actionLabel)}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
