'use client';

import { useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils';

export default function AdminConfirmationDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus?.();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const confirmClass =
    tone === 'danger'
      ? 'bg-[var(--status-danger)] hover:bg-red-700'
      : 'bg-[var(--action-primary)] hover:bg-[var(--action-primary-hover)]';

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="ib-modal-backdrop absolute inset-0"
        aria-label="Dismiss dialog"
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className="ib-modal-panel relative z-10 w-full max-w-md p-5"
      >
        <h2 id={titleId} className="text-lg font-semibold text-[var(--text-primary)]">
          {title}
        </h2>
        {description ? (
          <p id={descId} className="mt-2 text-sm text-[var(--text-secondary)]">
            {description}
          </p>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-[var(--radius-md)] border border-[var(--border-default)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60',
              confirmClass
            )}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
