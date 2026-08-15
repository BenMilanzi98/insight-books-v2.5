'use client';
import { tt } from '@/lib/i18n/runtime';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminModal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  size = 'md',
}) {
  const titleId = useId();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus?.();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const width =
    size === 'lg' ? 'max-w-2xl' : size === 'sm' ? 'max-w-md' : 'max-w-lg';

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label={tt('Close dialog')}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-[1] flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-lg outline-none',
          width,
          className
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-3">
          {title ? (
            <h2 id={titleId} className="text-base font-semibold text-[var(--admin-text)]">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--admin-radius)] text-[var(--admin-text-muted)] hover:bg-[var(--admin-surface-muted)]"
            aria-label={tt('Close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--admin-border)] px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
