'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { cn } from '@/lib/utils';

/**
 * Notification centre UI foundation — empty by design in Phase 2.
 * No fake production alerts.
 */
export default function AdminNotificationCentre({ className }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus?.();
      }
    };
    const onClick = (e) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        !buttonRef.current?.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  return (
    <div className={cn('relative', className)}>
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--admin-radius)] text-[var(--admin-text-muted)] hover:bg-[var(--admin-surface-muted)] hover:text-[var(--admin-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-focus-ring)]"
        aria-label={t('admin-shell.notifications.trigger')}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-5 w-5" aria-hidden />
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={t('admin-shell.notifications.title')}
          className="absolute right-0 z-[var(--z-dropdown,40)] mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-[var(--admin-radius)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-lg"
        >
          <h2 className="text-sm font-semibold text-[var(--admin-text)]">
            {t('admin-shell.notifications.title')}
          </h2>
          <p className="mt-2 text-sm text-[var(--admin-text-muted)]">
            {t('admin-shell.notifications.empty')}
          </p>
          <p className="mt-1 text-xs text-[var(--admin-text-muted)]">
            {t('admin-shell.notifications.notImplemented')}
          </p>
        </div>
      ) : null}
    </div>
  );
}
