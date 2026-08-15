'use client';
import { tt } from '@/lib/i18n/runtime';

import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminDrawer({
  open,
  onClose,
  title,
  children,
  footer,
  side = 'right',
  className,
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

  return (
    <div className="fixed inset-0 z-[var(--z-modal)]">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label={tt('Close panel')}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={cn(
          'absolute top-0 flex h-[100dvh] w-full max-w-md flex-col bg-[var(--admin-surface)] shadow-xl outline-none transition-transform duration-200 ease-[var(--motion-ease)]',
          side === 'left' ? 'left-0 border-r border-[var(--admin-border)]' : 'right-0 border-l border-[var(--admin-border)]',
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
