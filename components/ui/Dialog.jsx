'use client';

import { useEffect, useId, useRef } from 'react';
import {
  Dialog as HDialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  DialogDescription,
  Transition,
  TransitionChild,
} from '@headlessui/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Button from './Button';

/**
 * Canonical system modal.
 * - Opaque panel (page content never bleeds through)
 * - Heavy blurred + darkened backdrop
 * Prefer this (or ConfirmDialog) for all new/edited modals.
 */
export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  initialFocus,
  hideClose = false,
  panelClassName,
  showAccent = true,
}) {
  const titleId = useId();
  const closeRef = useRef(null);
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-[min(96vw,72rem)]',
  };

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <Transition show={open}>
      <HDialog
        className="relative z-[var(--z-modal)]"
        onClose={onClose}
        initialFocus={initialFocus || closeRef}
        data-ib-modal="true"
      >
        <TransitionChild
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          {/* Unified system scrim — blur + darken so page content is not readable */}
          <DialogBackdrop className="ib-modal-backdrop fixed inset-0" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto p-3 sm:p-4">
          <div className="flex min-h-full items-end justify-center sm:items-center">
            <TransitionChild
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-2 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-2 sm:scale-95"
            >
              <DialogPanel
                className={cn(
                  'ib-modal-panel relative flex w-full flex-col overflow-hidden',
                  'max-h-[min(92vh,900px)] sm:my-8',
                  showAccent &&
                    'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gradient-to-r before:from-blue-500 before:via-sky-500 before:to-indigo-500',
                  sizes[size] || sizes.md,
                  panelClassName
                )}
                aria-labelledby={title ? titleId : undefined}
                data-ib-modal-panel="true"
              >
                {(title || !hideClose) && (
                  <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border-default)] px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      {title ? (
                        <DialogTitle
                          id={titleId}
                          className="text-base font-semibold text-[var(--text-primary)] sm:text-lg"
                        >
                          {title}
                        </DialogTitle>
                      ) : null}
                      {description ? (
                        <DialogDescription className="mt-1 text-sm text-[var(--text-secondary)]">
                          {description}
                        </DialogDescription>
                      ) : null}
                    </div>
                    {!hideClose ? (
                      <Button
                        ref={closeRef}
                        variant="ghost"
                        size="compact"
                        className="min-h-10 min-w-10 px-0"
                        aria-label="Close dialog"
                        onClick={onClose}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    ) : (
                      <span ref={closeRef} tabIndex={-1} className="sr-only" />
                    )}
                  </div>
                )}
                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
                {footer ? (
                  <div className="shrink-0 border-t border-[var(--border-default)] px-4 py-3 sm:px-5">
                    {footer}
                  </div>
                ) : null}
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </HDialog>
    </Transition>
  );
}

/** Alias — prefer importing Modal for new code. */
export { Dialog as Modal };
